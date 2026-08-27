/**
 * setup_catalogo.js — deja el catálogo listo para operar.
 *
 *  1. Agrega la columna `puesto` a employees si no existe. Sin ella todos los
 *     profesionales caían en "barbero" y las demás categorías salían vacías.
 *  2. Carga los servicios de las cinco áreas del negocio.
 *  3. Carga el equipo con su puesto.
 *
 * Es idempotente: se puede correr varias veces sin duplicar.
 *
 *   node setup_catalogo.js
 */

const pool = require("./config/db");

const SERVICIOS = [
  // Barbería
  ["Corte clásico",              9000,  "barbero"],
  ["Corte + barba",              14000, "barbero"],
  ["Afeitado con navaja",        8000,  "barbero"],
  ["Perfilado de barba",         6500,  "barbero"],
  ["Corte infantil",             7000,  "barbero"],
  // Manicurista
  ["Manicura clásica",           7500,  "manicurista"],
  ["Pedicura spa",               11000, "manicurista"],
  ["Manicura + pedicura",        16000, "manicurista"],
  ["Esmaltado semipermanente",   12000, "manicurista"],
  // Masajista
  ["Masaje descontracturante",   22000, "masajista"],
  ["Masaje relajante 60 min",    18000, "masajista"],
  ["Masaje deportivo",           25000, "masajista"],
  ["Piedras calientes",          28000, "masajista"],
  // Psicología / Nutrición
  ["Consulta psicológica",       25000, "psicologa"],
  ["Plan nutricional",           30000, "psicologa"],
  ["Seguimiento nutricional",    15000, "psicologa"],
  // Gimnasio
  ["Sesión de entrenamiento",    12000, "gym"],
  ["Evaluación física",          15000, "gym"],
  ["Plan mensual personalizado", 45000, "gym"],
];

const EQUIPO = [
  ["Andrés Villalobos", "barbero"],
  ["Kevin Mora",        "barbero"],
  ["Diego Cascante",    "barbero"],
  ["Sofía Jiménez",     "manicurista"],
  ["Valeria Chaves",    "manicurista"],
  ["Mariana Solís",     "masajista"],
  ["Rodrigo Alfaro",    "masajista"],
  ["Dra. Laura Vega",   "psicologa"],
  ["Óscar Ramírez",     "gym"],
];

async function main() {
  try {
    console.log("Preparando catálogo de Valhalla…\n");

    // ── 1. Esquema ──────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        precio DECIMAL(10,2) NOT NULL,
        categoria VARCHAR(80)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL
      );
    `);
    // La columna que faltaba. Sin ella el filtro por área no puede funcionar.
    await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS puesto VARCHAR(80);`);
    console.log("  esquema verificado (employees.puesto disponible)");

    // ── 2. Servicios ────────────────────────────────────────
    let nuevosServicios = 0;
    for (const [nombre, precio, categoria] of SERVICIOS) {
      const r = await pool.query(
        `INSERT INTO services (nombre, precio, categoria)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (SELECT 1 FROM services WHERE nombre = $1)
         RETURNING id`,
        [nombre, precio, categoria]
      );
      if (r.rowCount) nuevosServicios++;
    }
    console.log(`  servicios: ${nuevosServicios} nuevos de ${SERVICIOS.length}`);

    // ── 3. Equipo ───────────────────────────────────────────
    let nuevosEmpleados = 0, actualizados = 0;
    for (const [nombre, puesto] of EQUIPO) {
      const existe = await pool.query("SELECT id, puesto FROM employees WHERE nombre = $1", [nombre]);
      if (existe.rowCount === 0) {
        await pool.query("INSERT INTO employees (nombre, puesto) VALUES ($1,$2)", [nombre, puesto]);
        nuevosEmpleados++;
      } else if (!existe.rows[0].puesto) {
        await pool.query("UPDATE employees SET puesto = $1 WHERE id = $2", [puesto, existe.rows[0].id]);
        actualizados++;
      }
    }
    console.log(`  equipo: ${nuevosEmpleados} nuevos, ${actualizados} con puesto asignado`);

    // ── 4. Empleados heredados sin puesto ───────────────────
    // Los que ya existían antes de que la columna existiera quedan como
    // barberos, que es el area original del negocio.
    const huerfanos = await pool.query(
      "UPDATE employees SET puesto = 'barbero' WHERE puesto IS NULL OR puesto = '' RETURNING id"
    );
    if (huerfanos.rowCount) {
      console.log(`  ${huerfanos.rowCount} empleado(s) sin puesto asignados a barbería`);
    }

    // ── Resumen ─────────────────────────────────────────────
    const resumen = await pool.query(`
      SELECT categoria, COUNT(*) n FROM services GROUP BY categoria ORDER BY categoria
    `);
    console.log("\nServicios por área:");
    resumen.rows.forEach(r => console.log(`  ${String(r.categoria).padEnd(14)} ${r.n}`));

    const equipo = await pool.query(`
      SELECT puesto, COUNT(*) n FROM employees GROUP BY puesto ORDER BY puesto
    `);
    console.log("\nProfesionales por área:");
    equipo.rows.forEach(r => console.log(`  ${String(r.puesto).padEnd(14)} ${r.n}`));

    console.log("\nCatálogo listo.");
  } catch (err) {
    console.error("Error preparando el catálogo:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
