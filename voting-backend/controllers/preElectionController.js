const db = require('../models');
const SubmissionIPFS = db.SubmissionIPFS;
const User = db.User;
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const os = require('os');
const blockchainService = require('../utils/blockchainService');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Helper: Upload a buffer/string to IPFS via Docker node1.
 * Returns the CID string.
 */
async function uploadToIPFS(dataString, tmpFileHint = 'tmp') {
    const tmpFileName = `${tmpFileHint}_${Date.now()}.json`;
    // Use OS temp dir so nodemon never triggers a restart on these files
    const tmpFilePath = path.join(os.tmpdir(), tmpFileName);
    const dockerSafePath = tmpFilePath.replace(/\\/g, '/');
    fs.writeFileSync(tmpFilePath, dataString);
    try {
        await execPromise(`docker cp "${dockerSafePath}" node1:"/tmp/${tmpFileName}"`);
        const { stdout } = await execPromise(`docker exec node1 ipfs add -Q "/tmp/${tmpFileName}"`);
        const cid = stdout.trim();
        fs.unlinkSync(tmpFilePath);
        await execPromise(`docker exec node1 rm "/tmp/${tmpFileName}"`).catch(() => { });
        console.log(`[IPFS] Uploaded ${tmpFileHint} → CID: ${cid}`);
        return cid;
    } catch (err) {
        console.error(`[IPFS] uploadToIPFS failed for ${tmpFileHint}:`, err.message);
        if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
        throw err;
    }
}

/**
 * Helper: Upload a Base64 image string to IPFS.
 * Writes it as raw bytes so the CID represents the image.
 * Returns the CID.
 */
async function uploadBase64ImageToIPFS(base64String, label) {
    const matches = base64String.match(/^data:(.+);base64,(.+)$/);
    if (!matches) throw new Error(`Invalid base64 image for ${label}`);
    const ext = matches[1].split('/')[1] || 'bin';
    const imgBuffer = Buffer.from(matches[2], 'base64');

    const tmpFileName = `${label}_${Date.now()}.${ext}`;
    // Use OS temp dir so nodemon never triggers a restart on these files
    const tmpFilePath = path.join(os.tmpdir(), tmpFileName);
    const dockerSafePath = tmpFilePath.replace(/\\/g, '/');
    fs.writeFileSync(tmpFilePath, imgBuffer);
    try {
        await execPromise(`docker cp "${dockerSafePath}" node1:"/tmp/${tmpFileName}"`);
        const { stdout } = await execPromise(`docker exec node1 ipfs add -Q "/tmp/${tmpFileName}"`);
        const cid = stdout.trim();
        fs.unlinkSync(tmpFilePath);
        await execPromise(`docker exec node1 rm "/tmp/${tmpFileName}"`).catch(() => { });
        console.log(`[IPFS] Uploaded image ${label} → CID: ${cid}`);
        return cid;
    } catch (err) {
        console.error(`[IPFS] uploadBase64ImageToIPFS failed for ${label}:`, err.message);
        if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
        throw err;
    }
}

exports.submitForm = async (req, res) => {
    try {
        const { election_id, user_type, form_data, signature } = req.body;
        const username = req.username; // From verifyToken middleware

        if (!election_id || !form_data || !signature) {
            return res.status(400).json({ message: "election_id, form_data, and signature are required." });
        }

        // ── 0. Pre-Election Phase Validation ─────────────────────────────────
        // Forms can only be submitted BEFORE the pre-election phase ends on-chain
        const onChainElection = await blockchainService.getElectionDetails(election_id);
        
        if (!onChainElection || !onChainElection.initialized) {
            return res.status(404).json({ message: "Election not found on the blockchain." });
        }
        
        // onChainElection.preelectionDataEndTime is a BigInt (Unix timestamp in seconds)
        const preElectionEndTimeMs = Number(onChainElection.preelectionDataEndTime) * 1000;
        
        if (Date.now() >= preElectionEndTimeMs) {
            return res.status(403).json({ 
                message: "Pre-election registration phase has ended. You can no longer submit forms for this election." 
            });
        }

        const role = user_type === 'candidate' ? 'candidate' : 'voter';

        // ── 1. Duplicate Submission Check (per role) ────────────────────────
        // A user may submit ONE voter form AND ONE candidate form for the same
        // election, but not two voter forms or two candidate forms.
        const existingSubmission = await SubmissionIPFS.findOne({
            where: { username, election_id, role }
        });
        if (existingSubmission) {
            return res.status(409).json({
                message: `You have already submitted a ${role} registration form for this election.`
            });
        }

        // ── 2. Required Field Validation & Size Checks ───────────────────────
        if (role === 'candidate') {
            const requiredFields = { fullName: 'Full Name', age: 'Age', address: 'Address', symbolImage: 'Party Symbol Image', photoImage: 'Candidate Photo' };
            const missing = Object.entries(requiredFields).filter(([k]) => !form_data[k]).map(([, label]) => label);
            if (missing.length > 0) {
                return res.status(400).json({ message: `Missing required candidate fields: ${missing.join(', ')}.` });
            }
            if (isNaN(parseInt(form_data.age)) || parseInt(form_data.age) < 18) {
                return res.status(400).json({ message: "Candidate age must be 18 or above." });
            }

            // A base64 string's real bytes ≈ (base64_length * 3) / 4. 
            // Reject if either image exceeds our 2MB (2,097,152 bytes) limit safely.
            const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
            
            const symbolSizeBytes = (form_data.symbolImage.length * 3) / 4 - 
                (form_data.symbolImage.indexOf('=') > 0 ? (form_data.symbolImage.length - form_data.symbolImage.indexOf('=')) : 0);
            
            const photoSizeBytes = (form_data.photoImage.length * 3) / 4 - 
                (form_data.photoImage.indexOf('=') > 0 ? (form_data.photoImage.length - form_data.photoImage.indexOf('=')) : 0);

            if (symbolSizeBytes > MAX_IMAGE_SIZE_BYTES || photoSizeBytes > MAX_IMAGE_SIZE_BYTES) {
                return res.status(400).json({ message: "File constraint error: One or both of the uploaded images exceed the 2MB system limit. Please compress them and try again." });
            }

        } else {
            const requiredFields = { fullName: 'Full Name', dob: 'Date of Birth', address: 'Address' };
            const missing = Object.entries(requiredFields).filter(([k]) => !form_data[k]).map(([, label]) => label);
            if (missing.length > 0) {
                return res.status(400).json({ message: `Missing required voter fields: ${missing.join(', ')}.` });
            }
        }

        // ── 3. Fetch user's stored public key from DB ────────────────────────
        const user = await User.findOne({ where: { username } });
        if (!user || !user.public_key) {
            return res.status(403).json({
                message: "No public key found for this user. Please re-register or contact support."
            });
        }
        const storedPublicKey = user.public_key; // Ethereum address (0x...)

        // ── 4. Verify Signature ──────────────────────────────────────────────
        // The frontend signed JSON.stringify(rawFormData) with the private key.
        // We recover the signer address and compare it to the stored public key.
        // This guarantees the content has NOT been tampered with since signing:
        // any change to form_data fields would produce a different message hash
        // and a different recovered address.
        let recoveredAddress;
        try {
            const messageString = JSON.stringify(form_data);
            recoveredAddress = ethers.verifyMessage(messageString, signature);
        } catch (sigErr) {
            console.error("[PreElection] Signature recovery failed:", sigErr);
            return res.status(400).json({ message: "Malformed signature - could not recover signer." });
        }

        if (recoveredAddress.toLowerCase() !== storedPublicKey.toLowerCase()) {
            return res.status(403).json({
                message: `Signature verification failed. The form content does not match the signature, or the wrong private key was used.`
            });
        }

        // ── 4. Build final JSON for IPFS ─────────────────────────────────────
        let finalFormData = { ...form_data };

        if (role === 'candidate') {
            // Candidate: upload images first, embed CIDs in JSON, then upload JSON.
            if (!form_data.symbolImage || !form_data.photoImage) {
                return res.status(400).json({ message: "Candidate form requires symbolImage and photoImage." });
            }

            console.log("[PreElection] Uploading candidate party symbol to IPFS...");
            const symbolCid = await uploadBase64ImageToIPFS(form_data.symbolImage, `symbol_${username}`);

            console.log("[PreElection] Uploading candidate photo to IPFS...");
            const photoCid = await uploadBase64ImageToIPFS(form_data.photoImage, `photo_${username}`);

            // Replace raw base64 with CIDs in the JSON stored on IPFS
            finalFormData = {
                fullName: form_data.fullName,
                age: form_data.age,
                address: form_data.address,
                symbolImageCid: symbolCid,    // CID pointing to raw image
                photoImageCid: photoCid,      // CID pointing to raw image
                role: 'candidate'
            };
        } else {
            finalFormData = {
                fullName: form_data.fullName,
                dob: form_data.dob,
                address: form_data.address,
                role: 'voter'
            };
        }

        // ── 5. Upload final JSON to IPFS ──────────────────────────────────────
        console.log("[PreElection] Uploading final form JSON to IPFS...");
        const ipfs_cid = await uploadToIPFS(JSON.stringify(finalFormData), `form_${election_id}_${username}`);

        // ── 6. Save to Database ───────────────────────────────────────────────
        const newSubmission = await SubmissionIPFS.create({
            election_id,
            username,
            role,
            ipfs_cid,
            signature,
            status: 'pending'
        });

        res.status(201).json({
            message: "Pre-election form signed, verified, and submitted successfully.",
            data: newSubmission
        });

    } catch (error) {
        // Unique constraint violation
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: "You have already submitted a form for this election." });
        }
        console.error("[PreElection] Error submitting form:", error);
        res.status(500).json({ message: error.message || "Internal server error" });
    }
};

exports.getSubmissionsByElection = async (req, res) => {
    try {
        const { election_id } = req.params;
        const username = req.username; // From JWT

        // 1. Fetch from blockchain
        const onChainElection = await blockchainService.getElectionDetails(election_id);
        if (!onChainElection || !onChainElection.initialized) {
            return res.status(404).json({ message: "Election not found on the blockchain." });
        }

        // 2. Verify creator
        if (onChainElection.creatorName !== username) {
            return res.status(403).json({ message: "Unauthorized. Only the election creator can verify submissions." });
        }

        // 3. Verify pre-election phase has ended
        const preElectionEndTimeMs = Number(onChainElection.preelectionDataEndTime) * 1000;
        if (Date.now() < preElectionEndTimeMs) {
            return res.status(400).json({ message: "The pre-election registration phase has not ended yet. You can only verify forms once the phase concludes." });
        }

        const submissions = await SubmissionIPFS.findAll({
            where: { election_id }
        });

        res.json(submissions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateSubmissionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const submission = await SubmissionIPFS.findByPk(id);
        if (!submission) {
            return res.status(404).json({ message: "Submission not found" });
        }

        submission.status = status;
        await submission.save();

        res.json({ message: "Status updated successfully", data: submission });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getIPFSData = async (req, res) => {
    try {
        const { cid } = req.params;
        try {
            const { stdout } = await execPromise(`docker exec node3 ipfs cat ${cid}`);
            res.json(JSON.parse(stdout));
        } catch (ipfsError) {
            console.error('[IPFS] getIPFSData error:', ipfsError.message);
            res.status(404).json({ message: 'IPFS CID not found: ' + ipfsError.message });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMySubmissionStatus = async (req, res) => {
    try {
        const { election_id } = req.params;
        const username = req.username;

        const submission = await SubmissionIPFS.findOne({
            where: { election_id, username, role: 'voter' }
        });

        if (!submission) {
            return res.json({ status: 'not_found' });
        }

        res.json({ 
            status: submission.status,
            id: submission.id,
            ipfs_cid: submission.ipfs_cid
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Serves a raw image stored in IPFS by CID.
 * Used by the admin panel to display candidate photos and party symbols.
 */
exports.getIPFSImage = async (req, res) => {
    try {
        const { cid } = req.params;
        const { stdout } = await execPromise(
            `docker exec node3 ipfs cat ${cid}`,
            { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 }
        );
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(stdout);
    } catch (error) {
        console.error('[IPFS] getIPFSImage error:', error.message);
        res.status(404).json({ message: 'Image not found in IPFS: ' + error.message });
    }
};

/**
 * Admin verifies a voter/candidate submission.
 * - Verifies admin's signature client-side signed over (submission_id + decision)
 * - Builds an approval record JSON and uploads it to IPFS
 * - Saves the resulting CID as approved_cid and updates status
 */
exports.verifySubmission = async (req, res) => {
    try {
        const { id } = req.params;
        const { decision, adminSignature } = req.body;
        const adminUsername = req.username;

        if (!decision || !adminSignature) {
            return res.status(400).json({ message: "decision and adminSignature are required." });
        }
        if (!['approved', 'rejected'].includes(decision)) {
            return res.status(400).json({ message: "decision must be 'approved' or 'rejected'." });
        }

        // Fetch the submission
        const submission = await SubmissionIPFS.findByPk(id);
        if (!submission) {
            return res.status(404).json({ message: "Submission not found." });
        }

        if (!submission.signature && submission.role === 'voter') {
            return res.status(400).json({ message: "Voter submission is missing a signature and cannot be verified." });
        }

        // Verify creator & time constraints
        const onChainElection = await blockchainService.getElectionDetails(submission.election_id);
        if (!onChainElection || !onChainElection.initialized) {
            return res.status(404).json({ message: "Election not found on the blockchain." });
        }
        if (onChainElection.creatorName !== adminUsername) {
            return res.status(403).json({ message: "Unauthorized. Only the election creator can verify submissions." });
        }
        //if election setup is done verification should not be allowed
        if (onChainElection.setupDone) {
            return res.status(400).json({ message: "Election setup is complete. Verification is not allowed." });
        }

        const preElectionEndTimeMs = Number(onChainElection.preelectionDataEndTime) * 1000;
        if (Date.now() < preElectionEndTimeMs) {
            return res.status(400).json({ message: "The pre-election registration phase has not ended yet. Verification is not allowed." });
        }

        // Fetch admin's stored public key
        const adminUser = await User.findOne({ where: { username: adminUsername } });
        if (!adminUser || !adminUser.public_key) {
            return res.status(403).json({ message: "Admin public key not found. Please re-register." });
        }

        // The frontend signs the string: `${id}:${decision}`
        const messageToVerify = `${id}:${decision}`;
        let recoveredAddress;
        try {
            recoveredAddress = ethers.verifyMessage(messageToVerify, adminSignature);
        } catch (sigErr) {
            return res.status(400).json({ message: "Malformed admin signature." });
        }

        if (recoveredAddress.toLowerCase() !== adminUser.public_key.toLowerCase()) {
            return res.status(403).json({
                message: `Admin signature verification failed. Expected key for '${adminUsername}' but got ${recoveredAddress}.`
            });
        }

        // Build approval record
        const approvalRecord = {
            form_cid: submission.ipfs_cid,
            submission_id: submission.id,
            username: submission.username,
            role: submission.role,
            decision: decision,
            admin: adminUsername,
            signature: adminSignature,
            timestamp: new Date().toISOString()
        };

        // Upload approval record to IPFS
        console.log("[PreElection] Uploading approval record to IPFS...");
        const approvedCid = await uploadToIPFS(JSON.stringify(approvalRecord), `approval_${id}`);

        // Update submission record
        submission.status = decision;
        submission.approved_cid = approvedCid;
        await submission.save();

        res.json({
            message: `Submission ${decision} successfully. Approval record stored in IPFS.`,
            approved_cid: approvedCid,
            data: submission
        });

    } catch (error) {
        console.error("[PreElection] Error verifying submission:", error);
        res.status(500).json({ message: error.message || "Internal server error" });
    }
};

