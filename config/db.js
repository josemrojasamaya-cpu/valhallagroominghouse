const { Pool } = require("pg");

const dbUrl = process.env.DATABASE_URL_CLOUD || process.env.DATABASE_URL || "postgres://postgres:valhalla123@localhost:5432/valhalla_barber";

const pool = new Pool({
    connectionString: dbUrl,
    ssl: (process.env.DATABASE_URL_CLOUD || process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false
});


module.exports = pool;