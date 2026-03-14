const Sequelize = require('sequelize');
const config = require('../config/database.js');
const db = {};

const sequelize = new Sequelize(config.development.database, config.development.username, config.development.password, {
    host: config.development.host,
    dialect: config.development.dialect,
    logging: config.development.logging
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.User = require('./user')(sequelize, Sequelize); // Added User model
db.RegistrationToken = require('./registrationToken')(sequelize, Sequelize);
db.Candidate = require('./candidate')(sequelize, Sequelize);
db.EncryptedShare = require('./encryptedShare')(sequelize, Sequelize);
db.EncryptedVote = require('./encryptedVote')(sequelize, Sequelize);
db.DecryptionShare = require('./decryptionShare')(sequelize, Sequelize);
db.ElectionVoter = require('./ElectionVoter')(sequelize, Sequelize);
db.SubmissionIPFS = require('./submissionIPFS')(sequelize, Sequelize);

// Associations
db.User.hasMany(db.SubmissionIPFS, { foreignKey: 'username', sourceKey: 'username', constraints: false });
db.SubmissionIPFS.belongsTo(db.User, { foreignKey: 'username', targetKey: 'username', constraints: false });

module.exports = db;
