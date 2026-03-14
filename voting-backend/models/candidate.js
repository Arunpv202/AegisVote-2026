module.exports = (sequelize, DataTypes) => {
    const Candidate = sequelize.define('Candidate', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        election_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        candidate_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        symbol_cid: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'IPFS CID for the party symbol image'
        },
        photo_cid: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'IPFS CID for the candidate photo'
        },
        submission_username: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Username of the candidate who submitted the pre-election form'
        },
        vote_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        timestamps: false,
        underscored: true
    });
    return Candidate;
};
