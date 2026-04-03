const pool = require("./config/db");

async function setupDB() {
  try {
    console.log("Iniciando creación de tablas financieras...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS fixed_expenses (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        monto DECIMAL(10, 2) NOT NULL,
        categoria VARCHAR(100),
        frecuencia VARCHAR(50) DEFAULT 'Mensual',
        dia_pago INT NOT NULL,
        active BOOLEAN DEFAULT TRUE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS loans (
        id SERIAL PRIMARY KEY,
        descripcion VARCHAR(255) NOT NULL,
        monto_inicial DECIMAL(12, 2) NOT NULL,
        monto_actual DECIMAL(12, 2) NOT NULL,
        tasa_interes_anual DECIMAL(5, 2) NOT NULL,
        plazo_meses INT NOT NULL,
        cuota_mensual DECIMAL(10, 2) NOT NULL,
        dia_pago INT NOT NULL,
        active BOOLEAN DEFAULT TRUE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS loan_payments (
        id SERIAL PRIMARY KEY,
        loan_id INT REFERENCES loans(id) ON DELETE CASCADE,
        monto_pagado DECIMAL(10, 2) NOT NULL,
        monto_capital DECIMAL(10, 2) NOT NULL,
        monto_interes DECIMAL(10, 2) NOT NULL,
        es_extraordinario BOOLEAN DEFAULT FALSE,
        fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS business_funds (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) UNIQUE NOT NULL,
        balance_actual DECIMAL(12, 2) DEFAULT 0,
        tasa_asignacion DECIMAL(5, 2) NOT NULL,
        tipo VARCHAR(50) 
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS salaries (
        id SERIAL PRIMARY KEY,
        empleado_id INT REFERENCES employees(id) ON DELETE CASCADE,
        monto_fijo DECIMAL(10, 2) NOT NULL,
        periodicidad VARCHAR(50) DEFAULT 'Mensual'
      );
    `);

    // Insert inicial de fondos si no existen
    await pool.query(`
      INSERT INTO business_funds (nombre, balance_actual, tasa_asignacion, tipo)
      VALUES 
        ('Fondo de Emergencia', 0, 10.00, 'emergencia'),
        ('Ahorro e Inversión', 0, 20.00, 'ahorro'),
        ('Fondo para Préstamos Extra', 0, 10.00, 'prestamos')
      ON CONFLICT DO NOTHING;
    `);

    console.log("Tablas creadas y fondos inicializados exitosamente.");
  } catch (err) {
    console.error("Error al crear tablas financieras:", err);
  } finally {
    pool.end();
  }
}

setupDB();
