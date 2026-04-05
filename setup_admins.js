const pool = require("./config/db");
const bcrypt = require("bcryptjs");

async function run() {
    try {
        console.log("Iniciando creación/actualización de administradores...");
        
        // Ensure users table exists just in case
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(100) DEFAULT 'admin'
            );
        `);

        console.log("Tabla users validada.");

        // Hashear contraseñas
        const hash1 = await bcrypt.hash('josemiguel1997', 10);
        const hash2 = await bcrypt.hash('jose1997', 10);

        // Insertar usuario correo
        await pool.query(`
            INSERT INTO users (username, password, role) 
            VALUES ($1, $2, 'admin')
            ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;
        `, ['josemrojasamaya@gmail.com', hash1]);

        // Insertar usuario cédula
        await pool.query(`
            INSERT INTO users (username, password, role) 
            VALUES ($1, $2, 'admin')
            ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;
        `, ['604380270', hash2]);

        console.log("USUARIOS CREADOS O ACTUALIZADOS EXITOSAMENTE.");
    } catch(e) {
        console.error("Error DB:", e);
        process.exit(1);
    } finally {
        pool.end();
    }
}
run();
