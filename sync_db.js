const { Pool } = require('pg');
require('dotenv').config();

// Configuración de conexiones
const localPool = new Pool({
    connectionString: "postgres://postgres:valhalla123@localhost:5432/valhalla_barber"
});

// La URL de Render se debe configurar en un archivo .env o variable de entorno para seguridad
const cloudPool = new Pool({
    connectionString: process.env.DATABASE_URL_CLOUD,
    ssl: { rejectUnauthorized: false }
});

async function syncDatabases() {
    try {
        console.log("🔄 Iniciando Sincronización Master (Local -> Cloud)...");

        // 1. Obtener tablas a sincronizar
        const tables = ['services', 'employees', 'appointments', 'users', 'goals', 'fixed_expenses', 'loans', 'loan_payments', 'business_funds', 'salaries', 'tax_profiles', 'ledger_transactions'];

        for (const table of tables) {
            console.log(`--- Sincronizando tabla: ${table} ---`);
            
            // Obtener datos locales
            const localData = await localPool.query(`SELECT * FROM ${table}`);
            
            if (localData.rows.length === 0) {
                console.log(`⚠️ Tabla ${table} vacía localmente. Saltando.`);
                continue;
            }

            // Limpiar tabla en la nube (Opcional, precaución con datos vivos)
            // await cloudPool.query(`TRUNCATE TABLE ${table} CASCADE`);

            // Insertar datos en la nube usando ON CONFLICT para no duplicar
            for (const row of localData.rows) {
                const columns = Object.keys(row).join(', ');
                const values = Object.values(row);
                const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
                
                const conflictUpdate = Object.keys(row)
                    .filter(k => k !== 'id')
                    .map(k => `${k} = EXCLUDED.${k}`)
                    .join(', ');

                const query = `
                    INSERT INTO ${table} (${columns}) 
                    VALUES (${placeholders}) 
                    ON CONFLICT (id) DO UPDATE SET ${conflictUpdate}
                `;

                await cloudPool.query(query, values);
            }
            console.log(`✅ ${table} sincronizada (${localData.rows.length} registros).`);
        }

        console.log("✨ SINCRONIZACIÓN COMPLETADA EXITOSAMENTE.");
        process.exit(0);
    } catch (err) {
        console.error("❌ ERROR CRÍTICO en la sincronización:", err);
        process.exit(1);
    }
}

if (!process.env.DATABASE_URL_CLOUD) {
    console.error("❌ ERROR: No se detectó DATABASE_URL_CLOUD en las variables de entorno.");
    process.exit(1);
}

syncDatabases();
