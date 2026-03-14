const { Sequelize, QueryTypes } = require('sequelize');
const config = require('./config/database.js');

const sequelize = new Sequelize(config.development.database, config.development.username, config.development.password, {
    host: config.development.host,
    dialect: config.development.dialect,
    logging: false
});

async function cleanup() {
    try {
        console.log("--- Starting Database Cleanup ---");

        // 1. Get all tables
        const tables = await sequelize.query("SHOW TABLES", { type: QueryTypes.SHOWTABLES });
        console.log("Found tables:", tables);

        // 2. Disable foreign key checks to allow truncation
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        for (const table of tables) {
            if (table.toLowerCase() === 'users') {
                console.log(`Skipping table: ${table}`);
                continue;
            }
            console.log(`Clearing table: ${table}`);
            await sequelize.query(`TRUNCATE TABLE \`${table}\``);
        }

        // 3. Re-enable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log("Data cleared from all tables except 'users'.");

        console.log("\nCleanup Complete.");
    } catch (error) {
        console.error("Cleanup failed:", error);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

cleanup();
