const express = require('express');
const router = express.Router();
const preElectionController = require('../controllers/preElectionController');
const { verifyToken = (req, res, next) => next() } = require('../middleware/authJwt');

// Temporary fix if authJwt doesn't export verifyToken properly in some test environments
const authMiddleware = require('../middleware/authJwt');
const requireAuth = authMiddleware.verifyToken;

router.post('/submit', requireAuth, preElectionController.submitForm);
router.get('/my-status/:election_id', requireAuth, preElectionController.getMySubmissionStatus);
router.get('/:election_id/submissions', requireAuth, preElectionController.getSubmissionsByElection);
router.put('/submissions/:id', requireAuth, preElectionController.updateSubmissionStatus);
router.post('/submissions/:id/verify', requireAuth, preElectionController.verifySubmission);
router.get('/ipfs/:cid', requireAuth, preElectionController.getIPFSData);
router.get('/ipfs-image/:cid', preElectionController.getIPFSImage); // no auth — serves raw image bytes

module.exports = router;

