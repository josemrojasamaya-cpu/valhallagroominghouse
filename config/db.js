const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgres://postgres:valhalla123@localhost:5432/valhalla_barber",
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});


module.exports = pool;