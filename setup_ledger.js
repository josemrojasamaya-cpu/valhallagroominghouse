const pool = require("./config/db");

async function setupDB() {
  try {
    console.log("Iniciando creación de tablas contables avanzadas...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tax_profiles (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        porcentaje DECIMAL(5, 2) NOT NULL,
        tipo_calculo VARCHAR(50) DEFAULT 'SOBRE_BRUTO',
        active BOOLEAN DEFAULT TRUE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ledger_transactions (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL,
        monto DECIMAL(12, 2) NOT NULL,
        descripcion VARCHAR(255),
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insertar un impuesto predeterminado (IVA de Tributación 13%) si no existe
    await pool.query(`
      INSERT INTO tax_profiles (nombre, porcentaje, tipo_calculo) 
      SELECT 'IVA (Tributación)', 13.00, 'SOBRE_BRUTO'
      WHERE NOT EXISTS (SELECT 1 FROM tax_profiles WHERE nombre = 'IVA (Tributación)');
    `);
    
    // Insertar el cajón de retención de impuestos en los fondos de negocio
    await pool.query(`
      INSERT INTO business_funds (nombre, balance_actual, tasa_asignacion, tipo)
      VALUES ('Retenciones Tributación (Hacienda)', 0, 0, 'impuestos')
      ON CONFLICT DO NOTHING;
    `);

    console.log("Tablas contables adicionales creadas con éxito.");
  } catch (err) {
    console.error("Error al crear tablas:", err);
  } finally {
    pool.end();
  }
}

setupDB();
