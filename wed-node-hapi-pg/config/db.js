const pg = require('pg');

module.exports = {
  url:
    process.env.DB_URI ||
    `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
  host: process.env.DB_HOST,
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
