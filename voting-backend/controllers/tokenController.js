const db = require('../models');
const RegistrationToken = db.RegistrationToken;
const Wallet = db.Wallet;
const User = db.User; // Added User model
const SubmissionIPFS = db.SubmissionIPFS; // Added SubmissionIPFS model
const crypto = require('crypto');
const CryptoJS = require('crypto-js');

// Face data encryption key from .env
const FACE_ENCRYPTION_KEY = process.env.FACE_DATA_ENCRYPTION_KEY;

const ElectionVoter = db.ElectionVoter; // Added ElectionVoter model

exports.generateTokenForUser = async (req, res) => {
    try {
        console.log("Receive register-user request:", req.body);
        const { election_id, username } = req.body;

        if (!election_id || !username) {
            return res.status(400).json({ message: "Election ID and username are required" });
        }

        const submission = await SubmissionIPFS.findOne({
            where: { election_id, username, role: 'voter', status: 'approved' }
        });

        if (!submission) {
            return res.status(404).json({ message: "Approved voter submission not found." });
        }
        if (submission.token_generated) {
            return res.status(400).json({ message: "A token has already been generated for this user." });
        }

        const tokenString = crypto.randomBytes(16).toString('hex');

        const token = await RegistrationToken.create({
            token: tokenString,
            election_id,
            status: 'unused'
        });

        submission.token_generated = true;
        await submission.save();

        res.status(201).json({ message: 'Token generated', token: token });
    } catch (error) {
        console.error("Error in generateTokenForUser:", error);
        if (error.name === 'SequelizeForeignKeyConstraintError' || error?.original?.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ message: `Election ID '${req.body.election_id}' does not exist. Please create a new election.` });
        }
        res.status(500).json({ message: error.message });
    }
};

exports.registerVoter = async (req, res) => {
    try {
        let { election_id, token, commitment, face_descriptor } = req.body;
        election_id = election_id?.trim();
        token = token?.trim();

        // User should be authenticated via verified header if we want to extract username securely
        // The prompt says "take the username from the jwt token".
        // Assuming secure route with verifyToken middleware.
        const username = req.username;

        if (!username) {
            return res.status(401).json({ message: "Unauthorized: Token required" });
        }

        const registration = await RegistrationToken.findOne({
            where: { token, election_id }
        });

        if (!registration) {
            return res.status(404).json({ message: 'Invalid token' });
        }

        if (registration.status === 'used') {
            return res.status(400).json({ message: 'Token already used' });
        }

        // New: Strict Verification that user (from JWT) has an approved form for this election
        const submission = await SubmissionIPFS.findOne({
            where: { election_id, username, role: 'voter' }
        });

        if (!submission) {
            return res.status(403).json({ message: "No pre-election submission found. You must submit a registration form first." });
        }
        if (submission.status !== 'approved') {
            return res.status(403).json({ message: `Your registration form status is '${submission.status}'. It must be 'approved' to register.` });
        }

        // Check if user already entered election (prevent double entry for "viewing" purposes if needed)
        // Prompt says: "store the username and election id in the new table"
        const existingVoter = await ElectionVoter.findOne({
            where: { election_id, username }
        });

        if (existingVoter) {
            return res.status(400).json({ message: 'You have already registered for this election.' });
        }

        // Update token
        registration.commitment = commitment;
        registration.status = 'used';
        registration.used_at = new Date();

        // Encrypt and store face descriptor if provided
        if (face_descriptor && Array.isArray(face_descriptor)) {
            if (!FACE_ENCRYPTION_KEY) {
                console.error('[Register] FACE_DATA_ENCRYPTION_KEY not set in .env');
                return res.status(500).json({ message: 'Server configuration error: face encryption key missing.' });
            }
            const descriptorJSON = JSON.stringify(face_descriptor);
            const encryptedDescriptor = CryptoJS.AES.encrypt(descriptorJSON, FACE_ENCRYPTION_KEY).toString();
            registration.face_descriptor = encryptedDescriptor;
            console.log('[Register] Face descriptor encrypted and stored.');
        }

        await registration.save();

        // New Table Entry
        await ElectionVoter.create({
            election_id,
            username
        });

        // Also add to Wallet as 'voter' role to maintain compatibility with getParticipatingElections logic 
        // if that one still relies on Wallet or if we want to shift entirely. 
        // Prompt says "in registerVoter... atlast store the username and election id in the new table".
        // It does NOT explicitly say "remove wallet entry". 
        // However, getParticipatingElections checks RegistrationToken (voter_id) OR Wallet (authority).
        // If we want "Voter" role to strictly come from RegistrationToken/ElectionVoter, 
        // we might NOT need Wallet.role='voter' anymore.
        // BUT `getParticipatingElections` logic I wrote earlier:
        // "Find Elections via RegistrationToken (Role: Voter)" -> checks `voter_id`.
        // So Wallet 'voter' role is redundant there.
        // Let's stick to the prompt: store in NEW table. 
        // I will NOT add to Wallet unless strictly needed for other things.

        res.json({ message: 'Voter registered successfully' });
    } catch (error) {
        console.error("Error in registerVoter:", error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== FACE VERIFICATION ====================
exports.verifyFace = async (req, res) => {
    try {
        const { election_id, descriptor, commitment } = req.body;

        if (!election_id || !descriptor || !Array.isArray(descriptor) || !commitment) {
            return res.status(400).json({ success: false, message: 'election_id, descriptor (array), and commitment are required.' });
        }

        if (!FACE_ENCRYPTION_KEY) {
            return res.status(500).json({ success: false, message: 'Server configuration error.' });
        }

        // Look up registration by commitment + election_id (anonymous — no user identity needed)
        const registration = await RegistrationToken.findOne({
            where: { election_id: election_id.trim(), commitment: commitment }
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Registration not found for this election.' });
        }

        if (!registration.face_descriptor) {
            return res.status(400).json({ success: false, message: 'No face data stored for this registration.' });
        }

        // Decrypt stored descriptor
        let storedDescriptor;
        try {
            const bytes = CryptoJS.AES.decrypt(registration.face_descriptor, FACE_ENCRYPTION_KEY);
            const decryptedJSON = bytes.toString(CryptoJS.enc.Utf8);
            storedDescriptor = JSON.parse(decryptedJSON);
        } catch (decryptErr) {
            console.error('[VerifyFace] Failed to decrypt stored descriptor:', decryptErr);
            return res.status(500).json({ success: false, message: 'Failed to process stored face data.' });
        }

        // Compare descriptors using Euclidean distance
        if (storedDescriptor.length !== descriptor.length) {
            return res.status(400).json({ success: false, message: 'Descriptor dimension mismatch.' });
        }

        let sumSquares = 0;
        for (let i = 0; i < storedDescriptor.length; i++) {
            const diff = storedDescriptor[i] - descriptor[i];
            sumSquares += diff * diff;
        }
        const distance = Math.sqrt(sumSquares);

        console.log(`[VerifyFace] Euclidean distance: ${distance.toFixed(4)} (threshold: 0.45)`);

        if (distance < 0.45) {
            return res.json({ success: true, message: 'Face verification passed.', distance: distance.toFixed(4) });
        } else {
            return res.json({ success: false, message: 'Face verification failed. Identity mismatch.', distance: distance.toFixed(4) });
        }

    } catch (error) {
        console.error('[VerifyFace] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
