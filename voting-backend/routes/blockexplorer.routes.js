const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authJwt');
const blockExplorerController = require('../controllers/blockexplorer');

// POST /api/blockexplorer/view
router.post('/view', verifyToken, blockExplorerController.viewElection);

// POST /api/blockexplorer/search
router.post('/search', verifyToken, blockExplorerController.searchByNullifier);

// GET /api/blockexplorer/my-submissions/:electionId
router.get('/my-submissions/:electionId', verifyToken, blockExplorerController.getMySubmissions);

module.exports = router;
