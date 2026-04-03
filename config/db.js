const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "valhalla_barber",
    password: "valhalla123",
    port: 5432
});

module.exports = pool;