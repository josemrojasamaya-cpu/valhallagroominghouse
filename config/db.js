const { Pool } = require("pg");

/**
 * Conexión a PostgreSQL.
 *
 * Orden de preferencia:
 *   1. DATABASE_URL        — nombre estándar, el que usan Render, Neon,
 *                            Railway, Supabase y Heroku por defecto.
 *   2. DATABASE_URL_CLOUD  — nombre propio de este proyecto, se mantiene
 *                            por compatibilidad.
 *   3. localhost           — desarrollo en la máquina del autor.
 *
 * Antes DATABASE_URL_CLOUD tenía prioridad, y eso hacía que una variable
 * vieja apuntando a una base ya inexistente tapara a la correcta.
 */
const dbUrl =
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_CLOUD ||
    "postgres://postgres:valhalla123@localhost:5432/valhalla_barber";

const esRemota = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_CLOUD);

const pool = new Pool({
    connectionString: dbUrl,
    ssl: esRemota ? { rejectUnauthorized: false } : false,
    // Sin límite de espera, una base caída deja las peticiones colgadas
    // hasta que el navegador se rinde, sin decir por qué.
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
    max: 10
});

// El host se registra sin credenciales para poder diagnosticar a qué base
// se está conectando sin exponer usuario ni contraseña en los logs.
function hostVisible(url) {
    try {
        const u = new URL(url);
        return `${u.hostname}${u.pathname}`;
    } catch {
        return "(cadena de conexión no interpretable)";
    }
}

console.log(`[DB] destino: ${hostVisible(dbUrl)} ${esRemota ? "(remota)" : "(local)"}`);

// Un fallo de conexión debe verse en el log del servidor, no solo cuando
// una petición falla más adelante.
pool.on("error", (err) => {
    console.error("[DB] error en el pool de conexiones:", err.message);
});

pool.query("SELECT 1")
    .then(() => console.log("[DB] conexión verificada"))
    .catch((err) => {
        console.error("[DB] NO SE PUDO CONECTAR:", err.message);
        console.error("[DB] Revisá que DATABASE_URL apunte a una base viva.");
        console.error("[DB] Con la base caída, el sitio carga pero ninguna");
        console.error("[DB] consulta funciona: citas, servicios ni inicio de sesión.");
    });

module.exports = pool;
