const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); // Import cookie-parser
const cors = require('cors');
const db = require('./models');
const electionRoutes = require('./routes/electionRoutes');
const tokenRoutes = require('./routes/tokenRoutes');
const dkgRoutes = require('./routes/dkgRoutes');
const authRoutes = require('./routes/authRoutes');
const blockExplorerRoutes = require('./routes/blockexplorer.routes');
const preElectionRoutes = require('./routes/preElectionRoutes');
const tokenController = require('./controllers/tokenController');
const electionController = require('./controllers/electionController');
const runTallyWorker = require('./workers/tallyWorker');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: true, // Allow any origin, reflecting the request origin
    credentials: true // Allow cookies
}));
app.use(cookieParser()); // Use cookie-parser
// 15MB limit to handle candidate forms with two base64-encoded images
app.use(bodyParser.json({ limit: '15mb' }));
app.use(bodyParser.urlencoded({ limit: '15mb', extended: true }));

// Routes
app.use('/api/elections', electionRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/dkg', dkgRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/blockexplorer', blockExplorerRoutes);
app.use('/api/pre-election', preElectionRoutes);

// Standalone routes as per prompt requirements
const { verifyToken } = require('./middleware/authJwt');
app.post('/api/register', verifyToken, tokenController.registerVoter);
app.post('/api/verify-face', tokenController.verifyFace);
app.post('/api/merkle/witness', electionController.getMerkleWitness);

// Sync Database and Start Server
// Using alter: true to update tables without dropping them if possible
db.sequelize.sync({ alter: true }).then(() => {
    console.log('Database synced');
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`[System] Backend initialized successfully.`);

        // Start Background Services
        runTallyWorker();
    });
}).catch(err => {
    console.error('Failed to sync database:', err);
});
