const { Sequelize } = require('sequelize');
const config = require('../config/database.js');

async function dropLegacyFK() {
    const sequelize = new Sequelize(
        config.development.database,
        config.development.username,
        config.development.password,
        {
            host: config.development.host,
            dialect: config.development.dialect,
            logging: console.log
        }
    );

    try {
        console.log('Attempting to drop legacy foreign key constraint: registration_tokens_ibfk_1');
        
        // This command drops the foreign key. 
        // We use IF EXISTS logic or catch the error if it's already gone.
        await sequelize.query('ALTER TABLE `registration_tokens` DROP FOREIGN KEY `registration_tokens_ibfk_1`');
        
        console.log('Successfully dropped foreign key: registration_tokens_ibfk_1');
    } catch (error) {
        if (error.parent && error.parent.errno === 1091) {
            console.log('Constraint registration_tokens_ibfk_1 does not exist. It might have been dropped already.');
        } else {
            console.error('Error dropping foreign key:', error);
        }
    } finally {
        await sequelize.close();
    }
}

dropLegacyFK();
