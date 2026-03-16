const db = require('../models');
const RegistrationToken = db.RegistrationToken;
const Candidate = db.Candidate;
const ElectionVoter = db.ElectionVoter;
const MerkleTreeService = require('../utils/merkleTree');
const dkgController = require('./dkgController');
const blockchainService = require('../utils/blockchainService');
const { ethers } = require('ethers');

// Helper for Auto Merkle Root Generation
const generateMerkleRoot = async (election_id) => {
    console.log(`Starting Merkle Root generation for ${election_id}`);
    try {
        // 1. Check Blockchain Status
        const onChainElection = await blockchainService.getElectionDetails(election_id);
        if (!onChainElection || !onChainElection.initialized) {
            console.error(`Election ${election_id} not found on blockchain during Merkle Root generation.`);
            return;
        }

        // 2. Fetch used tokens with commitments
        const tokens = await RegistrationToken.findAll({
            where: {
                election_id,
                status: 'used'
            }
        });

        const commitments = tokens.map(t => t.commitment).filter(c => c).sort();
        console.log(`Debug: Commitments used for Merkle Root:`, commitments);
        let root = null;

        if (commitments.length > 0) {
            const merkleService = new MerkleTreeService(commitments);
            await merkleService.build();
            root = merkleService.getRoot();
        } else {
            root = '0x0000000000000000000000000000000000000000000000000000000000000000';
        }

        // ===== FACE DATA MERKLE ROOT =====
        // Hash each encrypted face descriptor, then build a Merkle root
        const faceDescriptors = tokens
            .map(t => t.face_descriptor)
            .filter(f => f)
            .sort();

        let faceDatabaseHash = ethers.ZeroHash; // default if no face data

        if (faceDescriptors.length > 0) {
            // Hash each encrypted descriptor
            const faceLeaves = faceDescriptors.map(encDesc =>
                ethers.keccak256(ethers.toUtf8Bytes(encDesc))
            );
            console.log(`Debug: ${faceLeaves.length} face descriptor hashes for Merkle Root`);

            // Build Merkle tree from the hashed leaves
            const faceMerkleService = new MerkleTreeService(faceLeaves);
            await faceMerkleService.build();
            const faceRoot = faceMerkleService.getRoot();

            // Convert to bytes32 for the smart contract
            faceDatabaseHash = ethers.keccak256(ethers.toUtf8Bytes(faceRoot));
            console.log(`Face Database Hash (bytes32): ${faceDatabaseHash}`);
        } else {
            console.log('No face descriptors found, using ZeroHash for faceDatabaseHash.');
        }

        // Fetch Authorities count to dynamically calculate polynomial degree
        const authorities = await blockchainService.getAuthorities(election_id);
        const numAuthorities = authorities ? authorities.length : 1;

        // degree = numAuthorities - 2 (e.g. 4 authorities -> degree 2)
        // The blockchain automatically sets threshold = degree + 1 inside finalizeElectionSetup.
        const polynomial_degree = Math.max(1, numAuthorities - 2);

        await blockchainService.finalizeElectionSetup(election_id, polynomial_degree, root, faceDatabaseHash);

        console.log(`Merkle Root generated and finalized for ${election_id}: ${root}`);
        console.log(`Face Database Hash: ${faceDatabaseHash}`);
        console.log(`Election Crypto params set: Authorities=${numAuthorities}, Degree=${polynomial_degree} (Blockchain will set Threshold=${polynomial_degree + 1})`);

    } catch (error) {
        console.error(`Error generating Merkle Root for ${election_id}:`, error);
    }
};


exports.createElection = async (req, res) => {
    try {
        const {
            election_id,
            election_name,
            pre_election_start,
            pre_election_end,
            election_start,
            election_end,
            result_time,
            authorities
        } = req.body;
        // creator_name comes from the authenticated token
        const creator_name = req.username;
        const username = req.username; // For admin wallet creation

        // --- Date/Time Chronological Validation ---
        const now = new Date();
        const preStart = new Date(pre_election_start);
        const preEnd = new Date(pre_election_end);
        const start = new Date(election_start);
        const end = new Date(election_end);
        const resTime = new Date(result_time);

        if (preStart <= now) {
            return res.status(400).json({ message: 'Pre-election start time must be in the future.' });
        }
        if (preEnd <= preStart) {
            return res.status(400).json({ message: 'Pre-election end time must be after the start time.' });
        }
        if (start <= preEnd) {
            return res.status(400).json({ message: 'Election start time must be after the pre-election end time.' });
        }
        if (end <= start) {
            return res.status(400).json({ message: 'Election end time must be after the election start time.' });
        }
        if (resTime <= end) {
            return res.status(400).json({ message: 'Result time must be after the election end time.' });
        }
        // ------------------------------------------

        // [BLOCKCHAIN MIGRATION] Step 1: Check if election exists on blockchain
        const existingElection = await blockchainService.getElectionDetails(election_id);

        // Check if initialized (assuming existingElection is the struct returned by ethers)
        // If it returns defaults for non-existent key, initialized will be false.
        if (existingElection && existingElection.initialized) {
            return res.status(400).json({ message: 'Election ID already exists on blockchain' });
        }

        // [BLOCKCHAIN MIGRATION] Step 2: Create on chain if not used
        const toUnix = (date) => Math.floor(new Date(date).getTime() / 1000);
        await blockchainService.createElectionOnChain({
            electionId: election_id,
            electionName: election_name,
            creatorName: creator_name,
            preElectionStart: toUnix(pre_election_start),
            preElectionEnd: toUnix(pre_election_end),
            electionStart: toUnix(election_start),
            electionEnd: toUnix(election_end),
            resultTime: toUnix(result_time),
            authorities: authorities ? authorities.split(',').map(a => a.trim()) : []
        });

        res.status(201).json({ message: 'Election created successfully on Blockchain and Local DB' });
    } catch (error) {
        console.error("Error creating election:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.completeSetup = async (req, res) => {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    const fs = require('fs');
    const path = require('path');
    const SubmissionIPFS = db.SubmissionIPFS;

    const uploadToIPFS = async (dataString, hint = 'dag') => {
        const os = require('os');
        const tmpFileName = `${hint}_${Date.now()}.json`;
        const tmpFilePath = path.join(os.tmpdir(), tmpFileName);
        const dockerSafePath = tmpFilePath.replace(/\\/g, '/');
        fs.writeFileSync(tmpFilePath, dataString);
        try {
            await execPromise(`docker cp "${dockerSafePath}" node1:"/tmp/${tmpFileName}"`);
            const { stdout } = await execPromise(`docker exec node1 ipfs add -Q "/tmp/${tmpFileName}"`);
            const cid = stdout.trim();
            fs.unlinkSync(tmpFilePath);
            await execPromise(`docker exec node1 rm "/tmp/${tmpFileName}"`).catch(() => { });
            return cid;
        } catch (err) {
            if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
            throw err;
        }
    };

    const fetchFromIPFS = async (cid) => {
        const { stdout } = await execPromise(`docker exec node3 ipfs cat ${cid}`);
        return JSON.parse(stdout);
    };

    try {
        const { election_id } = req.body;

        // [BLOCKCHAIN] Verify election exists
        const onChainDetails = await blockchainService.getElectionDetails(election_id);
        if (!onChainDetails || !onChainDetails.initialized) {
            return res.status(404).json({ message: 'Election not found on blockchain' });
        }
        //if election already setup, prevent duplicate setup
        if (onChainDetails.setupDone) {
            return res.status(400).json({ message: 'Election setup already completed on blockchain' });
        }

        // ── Step 1: Fetch all APPROVED submissions ───────────────────────────────
        const approvedSubmissions = await SubmissionIPFS.findAll({
            where: { election_id, status: 'approved' }
        });

        if (approvedSubmissions.length === 0) {
            return res.status(400).json({ message: 'No approved submissions found for this election.' });
        }

        console.log(`[CompleteSetup] Found ${approvedSubmissions.length} approved submissions for ${election_id}`);

        // ── Step 2: Build a DAG JSON from approved_cids and upload it to IPFS ───
        const dagLinks = approvedSubmissions.map(s => ({
            submission_id: s.id,
            username: s.username,
            role: s.role,
            form_cid: s.ipfs_cid,
            approved_cid: s.approved_cid
        }));

        const dagJson = {
            election_id,
            created_at: new Date().toISOString(),
            total: dagLinks.length,
            links: dagLinks
        };

        console.log(`[CompleteSetup] Uploading DAG to IPFS...`);
        const dagRootCid = await uploadToIPFS(JSON.stringify(dagJson), `dag_${election_id}`);
        console.log(`[CompleteSetup] DAG Root CID: ${dagRootCid}`);

        // ── Step 3: Extract approved CANDIDATES and store in DB ──────────────────
        const approvedCandidates = approvedSubmissions.filter(s => s.role === 'candidate');
        const candidateNames = [];

        // Clear previous candidates for this election first (idempotent)
        await Candidate.destroy({ where: { election_id } });

        for (const sub of approvedCandidates) {
            try {
                const formData = await fetchFromIPFS(sub.ipfs_cid);
                const candidateName = formData.fullName || sub.username;
                candidateNames.push(candidateName);

                await Candidate.create({
                    election_id,
                    candidate_name: candidateName,
                    symbol_cid: formData.symbolImageCid || null,
                    photo_cid: formData.photoImageCid || null,
                    submission_username: sub.username
                });

                console.log(`[CompleteSetup] Stored candidate: ${candidateName}`);
            } catch (ipfsErr) {
                console.error(`[CompleteSetup] Failed to fetch IPFS data for ${sub.ipfs_cid}: ${ipfsErr.message}`);
            }
        }

        console.log(`[CompleteSetup] Stored ${candidateNames.length} candidates: ${candidateNames.join(', ')}`);

        // ── Step 4: Post DAG root + candidates to blockchain ────────────────────
        console.log(`[CompleteSetup] Calling storePreElectionDAG on blockchain...`);
        await blockchainService.storePreElectionDAG(election_id, dagRootCid, candidateNames);
        console.log(`[CompleteSetup] storePreElectionDAG complete.`);

        // ── Step 5: Generate Merkle Root (voter registration commitments) ────────
        console.log(`[CompleteSetup] Generating Merkle Root...`);
        await generateMerkleRoot(election_id);
        console.log(`[CompleteSetup] Merkle Root generated.`);

        res.json({
            message: 'Pre-election setup complete. DAG published to IPFS, candidates stored, blockchain updated, Merkle Root generated.',
            dag_root_cid: dagRootCid,
            candidate_count: candidateNames.length,
            candidates: candidateNames
        });

    } catch (error) {
        console.error('[CompleteSetup] Error:', error);
        res.status(500).json({ message: error.message });
    }
};


exports.setupElection = async (req, res) => {
    try {
        const { election_id, candidates, start_time, end_time, result_time, authorities } = req.body;
        // creator_name comes from the authenticated token
        const creator_name = req.username;

        // [BLOCKCHAIN MIGRATION] Step 1: Verify Creator and Existence on Chain
        const onChainDetails = await blockchainService.getElectionDetails(election_id);

        if (!onChainDetails || !onChainDetails.initialized) {
            return res.status(404).json({ message: 'Election not found on blockchain' });
        }

        if (onChainDetails.creatorName !== creator_name) {
            return res.status(403).json({ message: 'Unauthorized: Only the creator can setup the election.' });
        }

        if (onChainDetails.setupDone) {
            return res.status(400).json({ message: 'Election already setup on blockchain' });
        }

        // check that start_time < end_time < result_time
        if (new Date(start_time) >= new Date(end_time) || new Date(end_time) >= new Date(result_time)) {
            return res.status(400).json({ message: 'Invalid time configuration. Ensure start_time < end_time < result_time.' });
        }
        // start time must be in the future
        if (new Date(start_time) <= new Date()) {
            return res.status(400).json({ message: 'Start time must be in the future.' });
        }
        //atleast 2 authorities if authorities provided
        if (authorities && authorities.length > 0 && authorities.length < 2) {
            return res.status(400).json({ message: 'At least 2 authorities are required.' });
        }

        // [BLOCKCHAIN MIGRATION] Step 2: Verify Authorities Uniqueness on Chain
        // Fetch current on-chain authorities to ensure we aren't adding duplicates
        const onChainAuthorities = await blockchainService.getAuthorities(election_id);
        // onChainAuthorities is an array of structs/arrays. We need to check names.
        // Assuming the struct has authorityName property.

        const existingAuthNames = new Set(onChainAuthorities.map(a => a.authorityName));

        // Check incoming authorities
        if (authorities && authorities.length > 0) {
            for (const auth of authorities) {
                if (existingAuthNames.has(auth.username)) {
                    console.warn(`[Blockchain Check] Authority ${auth.username} already exists on chain.`);
                    // Depending on requirements, we might skip or error. 
                    // The prompt says "if no call that setupElectiononchain".
                    // So if YES (exists), we should probably stop or skip. 
                    // Let's assume strict check: fail if duplicate.
                    return res.status(400).json({ message: `Authority ${auth.username} already exists on blockchain.` });
                }
            }
        }

        /* [DATABASE DEPRECATION]
        const election = await Election.findByPk(election_id);
        if (!election) return res.status(404).json({ message: 'Election not found' });

        // Update election details
        election.start_time = start_time;
        election.end_time = end_time;
        election.result_time = result_time;

        await election.save();

        // Store Authority Wallets
        if (authorities && authorities.length > 0) {
            // Start ID from 2 because Admin is ID 1
            let authCounter = 2;

            for (const auth of authorities) {
                if (auth.username) {
                    // Check if wallet exists
                    const existingWallet = await Wallet.findOne({
                        where: {
                            username: auth.username,
                            election_id
                        }
                    });

                    if (existingWallet) {
                        // Check if wallet exists with admin role
                        const existingAdminWallet = await Wallet.findOne({
                            where: {
                                username: auth.username,
                                election_id,
                                role: 'admin' // Explicitly check for admin role
                            }
                        });

                        if (existingAdminWallet) {
                            console.warn(`[Constraint Violation] User ${auth.username} is Admin. Cannot be Authority.`);
                            continue;
                        }

                        // Check if already Authority (prevent duplicates)
                        const existingAuthRole = await Wallet.findOne({
                            where: {
                                username: auth.username,
                                election_id,
                                role: 'authority'
                            }
                        });
                        if (existingAuthRole) {
                            console.log(`Debug: User ${auth.username} already has authority role. Skipping.`);
                            continue;
                        }
                    }

                    // Create Authority Role
                    console.log(`Debug: Creating Authority ${authCounter} for ${auth.username}`);
                    await Wallet.create({
                        username: auth.username,
                        election_id,
                        role: 'authority',
                        authority_id: authCounter++
                    });
                }
            }
        }
        */
        if (candidates && candidates.length > 0) {
            const candidateData = candidates.map(c => ({
                election_id,
                candidate_name: c.candidate_name,
                symbol_name: c.symbol_name
            }));
            await Candidate.bulkCreate(candidateData);
        }

        // res.json({ message: 'Election setup updated', election });

        // ------------------------------------------------------------------
        // [BLOCKCHAIN] Sync Setup with Smart Contract (Phase 2)
        // ------------------------------------------------------------------
        try {
            // 1. Prepare Data for Blockchain
            const toUnix = (date) => Math.floor(new Date(date).getTime() / 1000);

            // Extract Candidate Names
            const candidateNames = (candidates || []).map(c => c.candidate_name);

            // Extract Authority Names (excluding Admin who is Creator/Auth 1)
            const authorityNames = (authorities || []).map(a => a.username);

            const setupData = {
                electionId: election_id,
                startTime: toUnix(start_time),
                endTime: toUnix(end_time),
                resultTime: toUnix(result_time),
                threshold: 3, // Hardcoded as per request
                candidateNames: candidateNames,
                authorityNames: authorityNames
            };

            // Call Blockchain Service
            await blockchainService.setupElectionOnChain(setupData);

            console.log(`[Blockchain] Setup synced for ${election_id}`);

            // ------------------------------------------------------------------
            // [BLOCKCHAIN] Verify Storage (User Request)
            // ------------------------------------------------------------------
            /*
            console.log("---------------------------------------------------");
            console.log("[Blockchain Debug] Verifying On-Chain Storage...");

            const onChainDetails = await blockchainService.getElectionDetails(election_id);
            const onChainAuthorities = await blockchainService.getAuthorities(election_id);
            
            // ... logging code ...
            */

            res.json({ message: 'Election setup synced to blockchain' });

        } catch (bcError) {
            console.error("[Blockchain] Setup Sync Failed:", bcError.message);
            res.status(500).json({ message: bcError.message });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.startRegistration = async (req, res) => {
    try {
        const { election_id } = req.body;
        const bcDetails = await blockchainService.getElectionDetails(election_id);
        if (!bcDetails || !bcDetails.initialized) return res.status(404).json({ message: 'Election not found on blockchain' });

        res.json({ message: 'Registration started. Phase timing is determined strictly on-chain.', election: { status: 'registration' } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.closeRegistration = async (req, res) => {
    try {
        const { election_id } = req.body;
        await generateMerkleRoot(election_id);
        res.json({ message: 'Registration closed manually' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMerkleRoot = async (req, res) => {
    try {
        const { election_id } = req.params;
        const bcDetails = await blockchainService.getElectionDetails(election_id);
        if (!bcDetails || !bcDetails.initialized) return res.status(404).json({ message: 'Election not found on blockchain' });

        res.json({ merkle_root: bcDetails.registrationMerkleRoot || '0x' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMerkleWitness = async (req, res) => {
    try {
        const { election_id, commitment } = req.body;

        const tokens = await RegistrationToken.findAll({
            where: {
                election_id,
                status: 'used'
            }
        });

        const commitments = tokens.map(t => t.commitment).filter(c => c);
        const merkleService = new MerkleTreeService(commitments);
        await merkleService.build();

        const proof = merkleService.getProof(commitment);

        res.json({ proof });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getElection = async (req, res) => {
    try {
        const { election_id } = req.params;

        const bcDetails = await blockchainService.getElectionDetails(election_id);
        if (!bcDetails || !bcDetails.initialized) return res.status(404).json({ message: 'Election not found on blockchain' });

        let bcElectionPK = null;
        if (bcDetails.electionPublicKey && bcDetails.electionPublicKey !== '0x') {
            bcElectionPK = bcDetails.electionPublicKey;
        }

        // [BLOCKCHAIN MIGRATION] Get the mathematically authoritative Tally
        const blockchainTally = await blockchainService.getEncryptedTally(election_id);

        const toNumber = (bigintVal) => bigintVal ? Number(bigintVal) : null;
        const responseObj = {
            election_id: bcDetails.electionId,
            election_name: bcDetails.electionName,
            creator_name: bcDetails.creatorName,
            start_time: toNumber(bcDetails.startTime),
            end_time: toNumber(bcDetails.endTime),
            result_time: toNumber(bcDetails.resultTime),
            pre_election_start: toNumber(bcDetails.preelectionDataStartTime),
            pre_election_end: toNumber(bcDetails.preelectionDataEndTime),
            ElectionCrypto: bcElectionPK ? { election_pk: bcElectionPK } : {}
        };

        // Override local DB tally with the blockchain's official flat array split
        if (blockchainTally && blockchainTally.c1.length > 0) {
            responseObj.encrypted_tally = blockchainTally; 
        }

        res.json(responseObj);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getElectionsByWallet = async (req, res) => {
    try {
        const username = req.username; // From JWT token

        // Fetch directly from Blockchain Events (ElectionCreated event)
        const elections = await blockchainService.getElectionsByCreator(username);

        res.json(elections);
    } catch (error) {
        console.error("Error fetching admin elections from blockchain:", error);
        res.status(500).json({ message: error.message });
    }
};


exports.getVoterElections = async (req, res) => {
    try {
        const username = req.params.username;
        const now = Math.floor(Date.now() / 1000);

        // 1. Fetch voter election IDs from DB
        const voterRows = await ElectionVoter.findAll({
            where: { username },
            attributes: ['election_id']
        });
        const allIds = voterRows.map(r => String(r.election_id));

        if (allIds.length === 0) return res.json([]);

        const results = [];
        for (const electionId of allIds) {
            try {
                const details = await blockchainService.getElectionDetails(electionId);
                const startUnix = details ? Number(details.startTime) : 0;
                const endUnix = details ? Number(details.endTime) : 0;

                let status;
                if (startUnix === 0 || endUnix === 0) status = 'upcoming';
                else if (startUnix > now) status = 'upcoming';
                else if (endUnix > now) status = 'ongoing';
                else status = 'completed';

                results.push({
                    election_id: electionId,
                    election_name: details ? details.electionName : electionId,
                    creator_name: details ? details.creatorName : '',
                    start_time: startUnix > 0 ? new Date(startUnix * 1000).toISOString() : null,
                    end_time: endUnix > 0 ? new Date(endUnix * 1000).toISOString() : null,
                    status,
                    user_role: 'voter'
                });
            } catch (err) {
                console.warn(`[VoterElections] Error for ${electionId}:`, err.message);
            }
        }
        res.json(results);
    } catch (error) {
        console.error('Error in getVoterElections:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

exports.getAuthorityElections = async (req, res) => {
    try {
        const username = req.params.username;
        const now = Math.floor(Date.now() / 1000);
        const authorityMap = {};

        // 1. Scan blockchain for authority status
        try {
            const filter = blockchainService.contract.filters.ElectionCreated();
            const events = await blockchainService.contract.queryFilter(filter);

            for (const event of events) {
                const electionId = String(event.args[0]);
                try {
                    const authorities = await blockchainService.getAuthorities(electionId);
                    const match = authorities.find(a => a.authorityName === username);
                    if (match) {
                        authorityMap[electionId] = Number(match.authorityId);
                    }
                } catch (e) { /* skip */ }
            }
        } catch (err) {
            console.warn('[AuthorityElections] Blockchain query failed:', err.message);
        }

        const allIds = Object.keys(authorityMap);
        if (allIds.length === 0) return res.json([]);

        const results = [];
        for (const electionId of allIds) {
            try {
                const details = await blockchainService.getElectionDetails(electionId);
                const startUnix = details ? Number(details.startTime) : 0;
                const endUnix = details ? Number(details.endTime) : 0;

                let status;
                if (startUnix === 0 || endUnix === 0) status = 'upcoming';
                else if (startUnix > now) status = 'upcoming';
                else if (endUnix > now) status = 'ongoing';
                else status = 'completed';

                results.push({
                    election_id: electionId,
                    election_name: details ? details.electionName : electionId,
                    creator_name: details ? details.creatorName : '',
                    start_time: startUnix > 0 ? new Date(startUnix * 1000).toISOString() : null,
                    end_time: endUnix > 0 ? new Date(endUnix * 1000).toISOString() : null,
                    status,
                    user_role: 'authority',
                    my_authority_id: authorityMap[electionId]
                });
            } catch (err) {
                console.warn(`[AuthorityElections] Error for ${electionId}:`, err.message);
            }
        }
        res.json(results);
    } catch (error) {
        console.error('Error in getAuthorityElections:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};




exports.getElectionCommitments = async (req, res) => {
    try {
        const { election_id } = req.params;

        // 1. Fetch Election from Blockchain for Merkle Root
        const bcDetails = await blockchainService.getElectionDetails(election_id);
        if (!bcDetails || !bcDetails.initialized) {
            return res.status(404).json({ success: false, message: 'Election not found on blockchain' });
        }

        const merkle_root = bcDetails.registrationMerkleRoot || '0x';

        // 2. Fetch ALL used tokens for this election
        const tokens = await RegistrationToken.findAll({
            where: {
                election_id,
                status: 'used'
            }
        });

        // 3. Extract and SORT commitments (Must match backend generation logic)
        const commitments = tokens
            .map(t => t.commitment)
            .filter(c => c)
            .sort();

        console.log(`[API] Serving ${commitments.length} commitments for ${election_id}`);

        res.json({
            success: true,
            election_id,
            merkle_root,
            commitments
        });

    } catch (error) {
        console.error("Error fetching election commitments:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCandidatesByElection = async (req, res) => {
    try {
        const { election_id } = req.params;
        const candidates = await Candidate.findAll({
            where: { election_id }
        });

        if (candidates && candidates.length > 0) {
            return res.json(candidates);
        }

        // Fallback to blockchain if candidates table is empty
        const bcDetails = await blockchainService.getElectionDetails(election_id);
        if (bcDetails && bcDetails.candidateNames && bcDetails.candidateNames.length > 0) {
            const bcCandidates = bcDetails.candidateNames.map((name, index) => ({
                id: index + 1,
                election_id,
                candidate_name: name,
                symbol_name: "U/A" // Unknown/Auto for blockchain generic symbols
            }));
            return res.json(bcCandidates);
        }

        res.json([]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// [BLOCKCHAIN] Fetch final results from smart contract
exports.getFinalResult = async (req, res) => {
    try {
        const { election_id } = req.params;

        // 1. Verify election status on blockchain
        const bcDetails = await blockchainService.getElectionDetails(election_id);
        if (!bcDetails || !bcDetails.initialized) {
            return res.status(404).json({ message: 'Election not found on blockchain' });
        }

        if (!bcDetails.completed) {
            return res.status(400).json({ 
                message: 'Election results are not yet available.',
                status: 'pending',
                result_time: Number(bcDetails.resultTime) 
            });
        }

        const result = await blockchainService.contract.getFinalResult(election_id);

        const candidates = result[0]; // string[]
        const counts = result[1];     // BigInt[]

        const data = candidates.map((name, i) => ({
            candidate_name: name,
            vote_count: Number(counts[i])
        }));

        res.json(data);
    } catch (error) {
        console.error('[Result] Error fetching final result from blockchain:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.endPreElectionPhase = async (req, res) => {
    try {
        const { election_id } = req.params;
        const db = require('../models');
        const SubmissionIPFS = db.SubmissionIPFS;
        const Candidate = db.Candidate;
        const crypto = require('crypto');

        // 1. Fetch all approved submissions
        const approvedSubmissions = await SubmissionIPFS.findAll({
            where: { election_id, status: 'approved' }
        });

        // 2. Build Master DAG and store in IPFS
        const cids = approvedSubmissions.map(s => s.ipfs_cid);
        const dagContent = JSON.stringify({ election_id, voters: cids });

        const fs = require('fs');
        const path = require('path');
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        const os = require('os');
        const tmpFileName = `dag_${election_id}_${Date.now()}.json`;
        const tmpFilePath = path.join(os.tmpdir(), tmpFileName);
        const dockerSafePath = tmpFilePath.replace(/\\/g, '/');
        fs.writeFileSync(tmpFilePath, dagContent);

        let ipfsDagRoot = "";
        try {
            await execPromise(`docker cp "${dockerSafePath}" node1:"/tmp/${tmpFileName}"`);
            const { stdout } = await execPromise(`docker exec node1 ipfs add -Q "/tmp/${tmpFileName}"`);
            ipfsDagRoot = stdout.trim();

            fs.unlinkSync(tmpFilePath);
            await execPromise(`docker exec node1 rm "/tmp/${tmpFileName}"`);
        } catch (ipfsError) {
            if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
            console.error("IPFS DAG Upload Error:", ipfsError);
            throw new Error("Failed to upload DAG to IPFS: " + ipfsError.message);
        }

        // 3. Fetch candidates
        const candidates = await Candidate.findAll({ where: { election_id } });
        const candidateNames = candidates.map(c => c.candidate_name);

        // 4. Store DAG and Candidates on Blockchain
        await blockchainService.storePreElectionDAG(election_id, ipfsDagRoot, candidateNames);

        res.json({ success: true, message: "Pre-election phase ended. DAG pushed to blockchain.", dagRoot: ipfsDagRoot });
    } catch (error) {
        console.error("Error ending pre-election phase:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
