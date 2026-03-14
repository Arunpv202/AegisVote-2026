module.exports = (sequelize, DataTypes) => {
    const SubmissionIPFS = sequelize.define('SubmissionIPFS', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        election_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false
        },
        role: {
            type: DataTypes.ENUM('voter', 'candidate'),
            allowNull: false,
            defaultValue: 'voter'
        },
        ipfs_cid: {
            type: DataTypes.STRING,
            allowNull: false
        },
        signature: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        approved_cid: {
            type: DataTypes.STRING,
            allowNull: true
        },
        token_generated: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected'),
            defaultValue: 'pending'
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'submission_ipfs',
        indexes: [
            {
                unique: true,
                fields: ['username', 'election_id', 'role'],
                name: 'unique_user_election_role_submission'
            }
        ]
    });
    return SubmissionIPFS;
};
