const pg = require('pg');

module.exports = {
	url: process.env.DB_URI,
	host: process.env.POSTGRES_HOST,
	dialectModule: pg,
	dialect: 'postgres',
	pool: {
		min: 0,
		max: 10,
		idle: 10000,
	},
	define: {
		underscored: true,
		timestamps: false,
	},
};
