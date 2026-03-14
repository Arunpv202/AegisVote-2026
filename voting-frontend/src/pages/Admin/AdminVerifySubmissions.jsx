import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import {
    ArrowLeft, Search, Loader2, User, UserPlus,
    CheckCircle, XCircle, Key, FileText, ChevronRight,
    AlertCircle, Clock, Award, Zap
} from "lucide-react";
import useAuthStore from "../../store/useAuthStore";
import InlineMessage from "../../components/UI/InlineMessage";
import { openDB } from 'idb';

// ─── Voter/Candidate Detail Panel ──────────────────────────────────────────────
function SubmissionDetailPanel({ submission, onDecision, sessionKey, onKeyChange }) {
    const { token, username } = useAuthStore();
    const [ipfsData, setIpfsData] = useState(null);
    const [ipfsLoading, setIpfsLoading] = useState(false);
    const [ipfsError, setIpfsError] = useState(null);
    const [privateKey, setPrivateKey] = useState(sessionKey || "");
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [generatedToken, setGeneratedToken] = useState(null); // Added for the popup

    const labelMap = {
        fullName: "Full Name", dob: "Date of Birth", age: "Age",
        address: "Address", uuid: "UUID / Aadhar"
    };

    useEffect(() => {
        if (!submission) return;
        setIpfsData(null);
        setIpfsError(null);
        setIpfsLoading(true);
        setError(null);
        setSuccess(null);
        setPrivateKey(sessionKey || "");

        fetch(`/api/pre-election/ipfs/${submission.ipfs_cid}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => {
                if (!r.ok) throw new Error(`IPFS fetch failed (${r.status})`);
                return r.json();
            })
            .then(setIpfsData)
            .catch(e => setIpfsError(String(e)))
            .finally(() => setIpfsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submission?.id, token]);

    const handleVerify = async (decision) => {
        setError(null);
        const effectiveKey = privateKey || sessionKey;
        if (!effectiveKey) {
            setError("Please enter your private key to sign this decision.");
            return;
        }
        setActionLoading(true);
        try {
            const pk = effectiveKey.startsWith("0x") ? effectiveKey : "0x" + effectiveKey;
            const wallet = new ethers.Wallet(pk);
            const adminSignature = await wallet.signMessage(`${submission.id}:${decision}`);
            const res = await fetch(`/api/pre-election/submissions/${submission.id}/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ decision, adminSignature })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setSuccess(`${decision.toUpperCase()} ✓  Approval CID: ${data.approved_cid}`);
            onDecision(submission.id, decision, data.approved_cid);
        } catch (e) {
            setError(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAutoSign = async () => {
        try {
            const db = await openDB('VoterWalletDB', 1);
            const wallet = await db.get('wallets', username);
            if (wallet && wallet.private_key) {
                setPrivateKey(wallet.private_key);
                onKeyChange(wallet.private_key);
                setSuccess("Admin private key retrieved from Secure Storage.");
            } else {
                setError("No private key found in local storage. Please enter it manually.");
            }
        } catch (err) {
            console.error("Error accessing IndexedDB:", err);
            setError("Could not access local secure storage.");
        }
    };

    const handleGenerateToken = async () => {
        setActionLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch("/api/tokens/register-user", { // Fixed endpoint
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ election_id: submission.election_id, username: submission.username })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to generate token");
            setGeneratedToken(data.token.token); // Store token for popup
        } catch (e) {
            setError(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const closePopup = () => setGeneratedToken(null);

    const isDecided = submission?.status !== 'pending';
    const isCandidate = submission?.role === 'candidate';

    // Fields shown in the main grid (skip CIDs, username, role, image keys)
    const mainFields = ipfsData
        ? Object.entries(ipfsData).filter(([k]) =>
            k !== 'username' && k !== 'role' &&
            !k.toLowerCase().endsWith('cid') &&
            !k.toLowerCase().includes('image'))
        : [];

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Token Popup */}
            <AnimatePresence>
                {generatedToken && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl relative"
                        >
                            <button onClick={closePopup} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                                <XCircle size={24} />
                            </button>

                            <h3 className="text-2xl font-bold mb-2 text-center text-white">Voter Token Generated!</h3>
                            <p className="text-gray-400 text-center mb-6 text-sm">Use this secure, anonymous token. Share it OFFLINE.</p>

                            <div className="bg-black/50 p-4 rounded-xl border border-indigo-500/30 flex items-center justify-between gap-2 overflow-hidden mb-6">
                                <code className="text-indigo-400 font-mono text-lg truncate block w-full">{generatedToken}</code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(generatedToken).then(() => alert("Copied!")).catch(err => console.error("Copy failed", err));
                                    }}
                                    className="text-gray-400 hover:text-white"
                                    title="Copy to clipboard"
                                >
                                    <Key size={20} />
                                </button>
                            </div>

                            <button onClick={closePopup} className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">
                                Done
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${isCandidate ? 'bg-emerald-500/10' : 'bg-indigo-500/10'}`}>
                    {isCandidate
                        ? <UserPlus size={24} className="text-emerald-400" />
                        : <User size={24} className="text-indigo-400" />}
                </div>
                <div>
                    <h3 className="text-xl font-bold">{submission.username}</h3>
                    <span className={`text-xs font-bold uppercase tracking-widest ${isCandidate ? 'text-emerald-400' : 'text-indigo-400'}`}>
                        {submission.role}
                    </span>
                </div>
                {isDecided && (
                    <div className={`ml-auto px-3 py-1 rounded-full text-xs font-bold uppercase ${submission.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {submission.status}
                    </div>
                )}
            </div>

            {/* IPFS Data */}
            {ipfsLoading ? (
                <div className="flex-1 flex flex-col justify-center items-center gap-3 text-gray-500">
                    <Loader2 className="animate-spin text-indigo-400" size={32} />
                    <span className="text-sm">Loading form from IPFS...</span>
                </div>
            ) : ipfsError ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    {ipfsError}
                </div>
            ) : ipfsData ? (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">

                    {/* Text fields */}
                    {mainFields.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {mainFields.map(([key, val]) => (
                                <div key={key} className="bg-black/40 border border-white/5 p-3 rounded-xl">
                                    <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                                        {labelMap[key] || key}
                                    </span>
                                    <span className="text-sm font-medium text-white break-all">{String(val)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-600 text-sm py-4">No text fields found in form data.</p>
                    )}

                    {/* Candidate images */}
                    {isCandidate && (ipfsData.symbolImageCid || ipfsData.photoImageCid) && (
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold mb-2">Submitted Images</p>
                            <div className="grid grid-cols-2 gap-3">
                                {ipfsData.symbolImageCid && (
                                    <div className="bg-black/40 border border-emerald-500/20 p-3 rounded-xl space-y-2">
                                        <span className="block text-xs text-gray-500 uppercase font-bold">Party Symbol</span>
                                        <img
                                            src={`/api/pre-election/ipfs-image/${ipfsData.symbolImageCid}`}
                                            alt="Party Symbol"
                                            className="w-full max-h-28 object-contain rounded-lg bg-black/30"
                                            onError={e => { e.target.style.display = 'none'; }}
                                        />
                                        <span className="text-[10px] font-mono text-emerald-400 break-all">{ipfsData.symbolImageCid}</span>
                                    </div>
                                )}
                                {ipfsData.photoImageCid && (
                                    <div className="bg-black/40 border border-emerald-500/20 p-3 rounded-xl space-y-2">
                                        <span className="block text-xs text-gray-500 uppercase font-bold">Candidate Photo</span>
                                        <img
                                            src={`/api/pre-election/ipfs-image/${ipfsData.photoImageCid}`}
                                            alt="Candidate"
                                            className="w-full max-h-28 object-contain rounded-lg bg-black/30"
                                            onError={e => { e.target.style.display = 'none'; }}
                                        />
                                        <span className="text-[10px] font-mono text-emerald-400 break-all">{ipfsData.photoImageCid}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Form CID */}
                    <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                        <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Form IPFS CID</span>
                        <span className="text-xs font-mono text-gray-400 break-all">{submission.ipfs_cid}</span>
                    </div>
                </div>
            ) : null}

            {/* Actions */}
            {!isDecided && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                    <InlineMessage type="error" message={error} onClose={() => setError(null)} />
                    <InlineMessage type="success" message={success} />

                    {/* Admin Private Key */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-xs font-bold uppercase tracking-widest text-emerald-500">Signing Authority Key</label>
                            <button
                                type="button"
                                onClick={handleAutoSign}
                                className="text-[10px] font-bold uppercase tracking-tighter text-emerald-400 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                            >
                                <Zap size={10} /> Auto Sign
                            </button>
                        </div>
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="password"
                                placeholder={sessionKey ? "Private key saved for this session ●●●" : "Your admin private key (0x...)"}
                                value={privateKey}
                                onChange={e => {
                                    setPrivateKey(e.target.value);
                                    onKeyChange(e.target.value);
                                }}
                                className="w-full bg-emerald-900/10 border border-emerald-500/20 rounded-xl py-3 pl-11 pr-4 text-sm font-mono text-emerald-300 outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>
                    {sessionKey && !privateKey && (
                        <p className="text-xs text-emerald-600 text-center -mt-1">↑ Press Approve/Reject to use saved key</p>
                    )}

                    {/* Approve / Reject Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => handleVerify('approved')}
                            disabled={actionLoading}
                            className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                            {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                            Approve
                        </button>
                        <button
                            onClick={() => handleVerify('rejected')}
                            disabled={actionLoading}
                            className="flex items-center justify-center gap-2 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                            {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
                            Reject
                        </button>
                    </div>
                </div>
            )}

            {isDecided && submission.approved_cid && (
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl mt-4">
                    <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Approval Record CID</span>
                    <span className="text-xs font-mono text-emerald-400 break-all">{submission.approved_cid}</span>
                </div>
            )}

            {!isCandidate && (
                <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
                    {error && <InlineMessage type="error" message={error} onClose={() => setError(null)} />}
                    {success && <InlineMessage type="success" message={success} />}
                    <button
                        onClick={handleGenerateToken}
                        disabled={actionLoading || submission.status !== 'approved'}
                        className={`w-full flex items-center justify-center gap-2 py-3 font-bold rounded-xl transition-all ${submission.status === 'approved' ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                    >
                        {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <Key size={18} />}
                        Generate Voting Token
                    </button>
                    {!isDecided ? (
                        <p className="text-xs text-center text-yellow-500 font-bold">⚠️ You must Approve this voter first to unlock token generation.</p>
                    ) : submission.status === 'approved' ? (
                        <p className="text-xs text-center text-gray-400 font-bold">Use this to generate an anonymous voting token for the approved voter.</p>
                    ) : (
                        <p className="text-xs text-center text-red-500 font-bold">Cannot generate a token for a rejected submission.</p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminVerifySubmissions() {
    const navigate = useNavigate();
    const { token } = useAuthStore();

    const [electionId, setElectionId] = useState("");
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState("pending");
    const [setupLoading, setSetupLoading] = useState(false);
    const [setupResult, setSetupResult] = useState(null);
    const [setupError, setSetupError] = useState(null);
    const [sessionKey, setSessionKey] = useState("");

    const handleSearch = async (e) => {
        e?.preventDefault();
        if (!electionId.trim()) return;
        setLoading(true);
        setError(null);
        setSelected(null);
        setSubmissions([]);
        try {
            const res = await fetch(`/api/pre-election/${electionId.trim()}/submissions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to fetch submissions");
            setSubmissions(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDecision = (id, newStatus, approved_cid) => {
        setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: newStatus, approved_cid } : s));
        if (selected?.id === id) setSelected(s => ({ ...s, status: newStatus, approved_cid }));
    };

    const handleCompleteSetup = async () => {
        if (!window.confirm(`Complete pre-election setup for election "${electionId}"?\n\nThis will:\n• Build a DAG of all approved submissions\n• Store approved candidates in the database\n• Submit to the blockchain\n• Generate the voter Merkle Root\n\nThis action cannot be undone.`)) return;
        setSetupLoading(true);
        setSetupError(null);
        setSetupResult(null);
        try {
            const res = await fetch('/api/elections/complete-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ election_id: electionId.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setSetupResult(data);
        } catch (e) {
            setSetupError(e.message);
        } finally {
            setSetupLoading(false);
        }
    };

    const filtered = submissions.filter(s => {
        if (filter === "all") return true;
        if (filter === "pending") return s.status === "pending";
        if (filter === "voters") return s.role === "voter";
        if (filter === "candidates") return s.role === "candidate";
        return true;
    });

    const counts = {
        all: submissions.length,
        pending: submissions.filter(s => s.status === 'pending').length,
        voters: submissions.filter(s => s.role === 'voter').length,
        candidates: submissions.filter(s => s.role === 'candidate').length,
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 p-6 max-w-7xl mx-auto w-full flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate("/admin/dashboard")}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-all px-3 py-2 rounded-lg hover:bg-white/5">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-black tracking-tight">Verify Submissions</h1>
                        <p className="text-gray-400 text-sm">Review and approve voter &amp; candidate pre-election registrations</p>
                    </div>
                    {submissions.length > 0 && (
                        <button
                            onClick={handleCompleteSetup}
                            disabled={setupLoading || !!setupResult}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                        >
                            {setupLoading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                            {setupResult ? 'Setup Complete ✓' : 'Complete Setup'}
                        </button>
                    )}
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            type="text"
                            value={electionId}
                            onChange={e => setElectionId(e.target.value)}
                            placeholder="Enter Election ID..."
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm font-mono outline-none focus:border-indigo-500/50"
                        />
                    </div>
                    <button type="submit" disabled={loading || !electionId.trim()}
                        className="px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                        Search
                    </button>
                </form>

                <InlineMessage type="error" message={error} onClose={() => setError(null)} />
                {setupError && <InlineMessage type="error" message={setupError} onClose={() => setSetupError(null)} />}
                {setupResult && (
                    <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                        <p className="text-emerald-400 font-bold mb-1">✓ Pre-election setup complete!</p>
                        <p className="text-xs text-gray-400">DAG Root: <span className="font-mono text-emerald-300">{setupResult.dag_root_cid}</span></p>
                        <p className="text-xs text-gray-400">Candidates stored: <span className="text-white font-medium">{setupResult.candidate_count}</span> — {setupResult.candidates?.join(', ')}</p>
                    </div>
                )}

                {submissions.length > 0 && (
                    <>
                        {/* Filter Pills */}
                        <div className="flex gap-2 mb-4 flex-wrap">
                            {[
                                { key: "all", label: "All", icon: <FileText size={14} /> },
                                { key: "pending", label: "Pending", icon: <Clock size={14} /> },
                                { key: "voters", label: "Voters", icon: <User size={14} /> },
                                { key: "candidates", label: "Candidates", icon: <Award size={14} /> },
                            ].map(f => (
                                <button key={f.key} onClick={() => setFilter(f.key)}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${filter === f.key ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                                    {f.icon} {f.label}
                                    <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${filter === f.key ? 'bg-white/20' : 'bg-white/10'}`}>{counts[f.key]}</span>
                                </button>
                            ))}
                        </div>

                        {/* Two-Panel Layout */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 min-h-0">
                            {/* Left: Submission List */}
                            <div className="overflow-y-auto space-y-2 pr-1">
                                {filtered.length === 0 ? (
                                    <div className="text-center text-gray-500 py-10 text-sm">
                                        <AlertCircle className="mx-auto mb-2" size={24} />
                                        No entries match this filter.
                                    </div>
                                ) : filtered.map(s => (
                                    <motion.button
                                        key={s.id}
                                        whileHover={{ x: 2 }}
                                        onClick={() => setSelected(s)}
                                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${selected?.id === s.id
                                            ? 'bg-indigo-600/20 border-indigo-500/50'
                                            : 'bg-slate-900/40 border-white/5 hover:border-white/15'}`}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`p-2 rounded-xl shrink-0 ${s.role === 'candidate' ? 'bg-emerald-500/10' : 'bg-indigo-500/10'}`}>
                                                {s.role === 'candidate'
                                                    ? <UserPlus size={16} className="text-emerald-400" />
                                                    : <User size={16} className="text-indigo-400" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm truncate">{s.username}</p>
                                                <p className={`text-xs capitalize ${s.status === 'pending' ? 'text-yellow-400' : s.status === 'approved' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    ● {s.status}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-600 shrink-0" />
                                    </motion.button>
                                ))}
                            </div>

                            {/* Right: Detail Panel */}
                            <div className="bg-slate-900/40 border border-white/10 rounded-[2rem] p-6 overflow-y-auto">
                                <AnimatePresence mode="wait">
                                    {selected ? (
                                        <motion.div key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                                            <SubmissionDetailPanel
                                                submission={selected}
                                                onDecision={handleDecision}
                                                sessionKey={sessionKey}
                                                onKeyChange={setSessionKey}
                                            />
                                        </motion.div>
                                    ) : (
                                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                            className="flex flex-col items-center justify-center h-full text-gray-600">
                                            <FileText size={48} className="mb-4" />
                                            <p className="text-sm font-medium">Select a submission to review</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
