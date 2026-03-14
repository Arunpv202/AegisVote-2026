import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  User,
  Flag,
  ArrowRight,
  ShieldCheck,
  Trophy,
  Loader2,
  KeyRound,
  X,
  ArrowLeft
} from "lucide-react";
import axios from "axios";
import * as snarkjs from "snarkjs";
import CryptoJS from "crypto-js";
import { ethers } from "ethers";
import { saveVoteHash } from "../../utils/voteHashStorage";

import useAuthStore from "../../store/useAuthStore";
import { getSecrets } from "../../utils/zkStorage";
import { getMerkleProof, encryptVote, generateCommitment, stringToField } from "../../utils/cryptoVoting";
import LoadingScreen from "../../components/UI/LoadingScreen";

export default function VotePage() {
  const navigate = useNavigate();
  const { election_id } = useParams();
  const { username } = useAuthStore(); // Use username instead of walletAddress

  const [voted, setVoted] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingVote, setProcessingVote] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [pendingCandidate, setPendingCandidate] = useState(null);

  // Election Public Key (Fetched from backend)
  const [electionPK, setElectionPK] = useState(null);
  const [merkleData, setMerkleData] = useState(null);

  useEffect(() => {
    const fetchElectionData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Candidates
        const candRes = await axios.get(`/api/elections/${election_id}/candidates`);
        setCandidates(candRes.data);

        // 2. Fetch Election Details (PK)
        const electionRes = await axios.get(`/api/elections/${election_id}`);
        // Response should now include ElectionCrypto
        if (electionRes.data.ElectionCrypto && electionRes.data.ElectionCrypto.election_pk) {
          setElectionPK(electionRes.data.ElectionCrypto.election_pk);
        } else {
          console.warn("[Vote] Election Public Key NOT found in response!", electionRes.data);
          setError("Election configuration incomplete (Missing Public Key)");
        }

        // 3. Fetch Commitments & Root
        const commRes = await axios.get(`/api/elections/${election_id}/commitments`);
        setMerkleData(commRes.data); // { commitments: [], merkle_root: ... }

      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load election data.");
      } finally {
        setLoading(false);
      }
    };

    if (election_id) {
      fetchElectionData();
    }
  }, [election_id]);

  const initiateVote = async (candidateName) => {
    if (processingVote) return;
    await processVote(candidateName);
  };

  const processVote = async (candidateName) => {
    if (processingVote) return;

    try {
      setProcessingVote(true);
      setSelectedCandidate(candidateName);
      setStatusMessage("Initializing Secure Voting Environment...");

      // 1. Get User Secrets directly
      console.log("[Vote] Step 1: Retrieving Secrets...");
      setStatusMessage("Loading Identity Credentials...");

      if (!username) {
        throw new Error("User session invalid. Please log in.");
      }

      // Retrieve Secrets without password
      const secrets = await getSecrets(election_id, null, username);

      if (!secrets || !secrets.zkSecret) {
        console.error("[Vote] Secrets retrieval failed. No credentials found.");
        throw new Error("No credentials found on this device for this election.");
      }
      console.log("[Vote] Secrets retrieved successfully.");

      // 2. Reconstruct Merkle Tree & Witness
      console.log("[Vote] Step 2: Reconstructing Merkle Tree...");
      setStatusMessage("Reconstructing Merkle Tree...");

      // Re-calculate Commitment to find index
      const commitment = await generateCommitment(secrets.zkSecret);

      // Generate Merkle Witness
      console.log("[Vote] Generating Merkle Proof...");
      const witness = await getMerkleProof(merkleData.commitments, commitment);
      console.log("[Vote] Witness generated");

      // 3. Generate Encryption (ElGamal)
      console.log("[Vote] Step 3: Encrypting Vote...");
      setStatusMessage("Encrypting Vote (Multi-Column ElGamal)...");

      if (!electionPK) {
        throw new Error("Election Public Key is missing. Cannot encrypt vote.");
      }

      const { encryptedVote, randomness, votes } = encryptVote(candidates, candidateName, electionPK);

      // -----------------------------------------------------------------------
      // GENERATE CHAUM-PEDERSEN PROOFS (VALIDITY)
      // -----------------------------------------------------------------------
      setStatusMessage("Generating Encryption Validity Proofs...");

      const { proveZeroOrOne, proveSumOfOne } = await import("../../utils/cryptoVoting");
      const { ristretto255 } = await import("@noble/curves/ed25519.js");

      const candidateProofs = [];
      let totalR = 0n;
      let sumC1 = ristretto255.Point.ZERO;
      let sumC2 = ristretto255.Point.ZERO;
      const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');

      for (let i = 0; i < encryptedVote.c1.length; i++) {
        const rVal = randomness[i];
        const vVal = votes[i];
        const c1Hex = encryptedVote.c1[i];
        const c2Hex = encryptedVote.c2[i];

        const proof = proveZeroOrOne(rVal, vVal, electionPK, c1Hex, c2Hex);
        candidateProofs.push(proof);

        totalR = (totalR + BigInt(rVal)) % CURVE_ORDER;
        sumC1 = sumC1.add(ristretto255.Point.fromHex(c1Hex));
        sumC2 = sumC2.add(ristretto255.Point.fromHex(c2Hex));
      }

      const sumProof = proveSumOfOne(totalR.toString(), electionPK, sumC1.toHex(), sumC2.toHex());
      const validityProofs = { candidateProofs, sumProof };

      // 4. Generate Nullifier (Poseidon)
      const { generateNullifier } = await import("../../utils/cryptoVoting");
      const nullifier = await generateNullifier(secrets.zkSecret, election_id);
      console.log("[Vote] Derived Nullifier:", nullifier);

      // 5. Generate ZK Proof
      console.log("[Vote] Step 5: Generating ZK Proof...");
      setStatusMessage("Generating Zero-Knowledge Proof...");

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        {
          root: merkleData.merkle_root,
          nullifier: nullifier,
          electionId: (await stringToField(election_id)).toString(),
          C1: encryptedVote.c1.map(c => c.startsWith("0x") ? c : "0x" + c),
          C2: encryptedVote.c2.map(c => c.startsWith("0x") ? c : "0x" + c),
          secret: BigInt(secrets.zkSecret.startsWith("0x") ? secrets.zkSecret : "0x" + secrets.zkSecret),
          pathElements: witness.pathElements,
          pathIndices: witness.pathIndices,
          votes: votes,
          r: randomness
        },
        "/circuits/vote.wasm",
        "/circuits/vote_final.zkey"
      );

      // 6. Submit Vote
      setStatusMessage("Broadcasting Vote to Blockchain...");

      await axios.post(`/api/elections/${election_id}/vote`, {
        proof,
        publicSignals,
        encryptedVote: {
          c1: encryptedVote.c1,
          c2: encryptedVote.c2
        },
        nullifier: nullifier,
        validityProofs: validityProofs
      });

      // 7. Compute & store encrypted vote hash locally (mirrors backend formula)
      setStatusMessage("Securing Your Vote Receipt...");
      try {
        const combinedString = encryptedVote.c1.join('') + encryptedVote.c2.join('');
        const voteHash = ethers.keccak256(ethers.toUtf8Bytes(combinedString));
        await saveVoteHash(election_id, voteHash, nullifier);
        console.log("[Vote] Vote hash stored in IndexedDB:", voteHash);
      } catch (hashErr) {
        // Non-fatal – user can still proceed
        console.warn("[Vote] Could not store vote hash:", hashErr);
      }

      setVoted(true);
      setProcessingVote(false);

      setTimeout(() => {
        navigate("/user/existing-elections");
      }, 3000);

    } catch (err) {
      console.error("Voting failed:", err);
      const backendMsg = err.response?.data?.message || err.message || "Voting failed";
      setError(backendMsg);
      setProcessingVote(false);
      setStatusMessage("");
    }
  };

  if (loading) return <LoadingScreen text="Loading Ballot..." />;

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 md:p-12 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Navigation Bar */}
        <div className="mb-12 flex justify-between items-center">
          <button
            onClick={() => navigate("/user/existing-elections")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-all group px-4 py-2 hover:bg-white/5 rounded-lg"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Elections</span>
          </button>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20"
          >
            <ShieldCheck size={16} className="text-indigo-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Authenticated Ballot</span>
          </motion.div>
        </div>

        {/* Header */}
        <header className="text-center mb-16 max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">Cast Your Vote</h1>
          <p className="text-gray-400 text-lg">Select one candidate below. This action performs a Zero-Knowledge Proof and is cryptographically irreversible once signed.</p>
        </header>

        {/* Error Message */}
        {error && (
          <div className="mb-10 max-w-2xl mx-auto p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-center flex items-center justify-center gap-3">
            <ShieldCheck size={20} />
            {error}
          </div>
        )}

        {/* Candidate Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {candidates.map((candidate, index) => (
            <motion.div
              key={candidate.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={!processingVote ? { y: -10, scale: 1.02, transition: { duration: 0.3 } } : {}}
              className={`bg-slate-900/40 backdrop-blur-2xl border ${selectedCandidate === candidate.candidate_name ? 'border-indigo-500 ring-4 ring-indigo-500/20' : 'border-white/10 hover:border-indigo-500/30'} rounded-[2.5rem] flex flex-col group relative overflow-hidden shadow-2xl transition-all duration-300 ${processingVote ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Candidate Photo (Top) */}
              <div className="w-full h-48 sm:h-56 md:h-64 relative overflow-hidden border-b border-white/5">
                {candidate.photo_cid ? (
                  <img
                    src={`/api/pre-election/ipfs-image/${candidate.photo_cid}`}
                    alt={candidate.candidate_name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(candidate.candidate_name) + "&background=random&size=256";
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-indigo-500/10 flex items-center justify-center">
                    <User size={64} className="text-indigo-400/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
              </div>

              {/* Content Section */}
              <div className="p-6 md:p-8 flex flex-col items-center text-center">
                {/* Symbol & Name Row */}
                <div className="flex flex-col items-center mb-6 w-full">
                  <div className="w-20 h-20 bg-white rounded-2xl border-2 border-indigo-500 overflow-hidden shadow-xl mb-4 flex items-center justify-center p-2">
                    {candidate.symbol_cid ? (
                      <img
                        src={`/api/pre-election/ipfs-image/${candidate.symbol_cid}`}
                        alt="Symbol"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-[10px] font-black text-indigo-600">SYMBOL</div>
                    )}
                  </div>
                  
                  <h3 className="text-xl md:text-2xl font-black text-white tracking-tight mb-2">
                    {candidate.candidate_name}
                  </h3>
                  
                  <div className="flex items-center justify-center gap-2 text-indigo-400 font-bold bg-indigo-500/10 py-1.5 px-4 rounded-full border border-indigo-500/20">
                    <span className="text-[10px] uppercase tracking-widest leading-none">Official Candidate</span>
                  </div>
                </div>

                <div className="h-px w-12 bg-indigo-500/30 mb-6" />

                <button
                  onClick={() => initiateVote(candidate.candidate_name)}
                  disabled={processingVote}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg hover:shadow-indigo-600/40 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  <span className="tracking-tight uppercase text-sm">Cast Selection</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Password Modal */}
        <AnimatePresence>
          {showPasswordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-slate-900 border border-white/10 p-10 rounded-[2.5rem] max-w-md w-full relative shadow-2xl"
              >
                <button onClick={() => setShowPasswordModal(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                  <X size={24} />
                </button>

                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/30">
                    <KeyRound size={32} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Confirm Identity</h3>
                  <p className="text-gray-400 text-sm">Enter your encryption password to authorize this vote. This decrypts your ZK-proof credentials locally.</p>
                </div>

                <div className="mb-8 relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                  <input
                    type="password"
                    autoFocus
                    className="w-full bg-black/40 border border-white/20 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-lg"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                  />
                </div>

                <button
                  onClick={handlePasswordSubmit}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20 text-lg flex items-center justify-center gap-2"
                >
                  <span>Sign & Vote</span>
                  <ShieldCheck size={20} />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Processing/Success Modal */}
        <AnimatePresence>
          {(processingVote || voted) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-900 border border-indigo-500/30 p-12 rounded-[3rem] max-w-sm w-full text-center shadow-[0_0_50px_rgba(79,70,229,0.15)] relative overflow-hidden"
              >
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-500/5 blur-3xl pointer-events-none" />

                {voted ? (
                  <>
                    <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 size={48} />
                    </div>
                    <h2 className="text-3xl font-black mb-3 text-white">Vote Cast!</h2>
                    <p className="text-gray-400 mb-8 leading-relaxed">Your private proof has been verified and your encrypted vote stored on the blockchain.</p>
                    <div className="flex items-center justify-center gap-3 text-sm text-indigo-300 font-mono animate-pulse bg-indigo-900/30 py-2 px-4 rounded-full w-fit mx-auto">
                      <Trophy size={16} /> Redirecting to Elections...
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-8 border border-indigo-500/30 relative">
                      <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin"></div>
                      <Loader2 size={40} className="animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-bold mb-4 text-white">Processing Vote</h2>
                    <p className="text-indigo-300 font-mono text-xs bg-indigo-900/30 py-2 px-4 rounded-lg inline-block">{statusMessage}</p>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}