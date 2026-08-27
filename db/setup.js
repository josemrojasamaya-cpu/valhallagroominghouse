/**
 * db/setup.js — deja una base de datos lista para operar.
 *
 * Aplica el esquema completo (db/schema.sql) y carga el catálogo mínimo
 * para que el sitio funcione: servicios, profesionales y un usuario admin.
 *
 * Sirve tanto para la base local como para una en la nube: usa la misma
 * configuración que la aplicación (config/db.js), así que respeta
 * DATABASE_URL / DATABASE_URL_CLOUD.
 *
 *   node db/setup.js
 *
 * Es idempotente: no duplica nada si se corre varias veces.
 */

const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

const SERVICIOS = [
  // [nombre, precio, categoria, duracion en minutos]
  ["Corte clásico",              9000,  "barbero",     40],
  ["Corte + barba",              14000, "barbero",     60],
  ["Afeitado con navaja",        8000,  "barbero",     30],
  ["Perfilado de barba",         6500,  "barbero",     25],
  ["Corte infantil",             7000,  "barbero",     30],
  ["Manicura clásica",           7500,  "manicurista", 40],
  ["Pedicura spa",               11000, "manicurista", 55],
  ["Manicura + pedicura",        16000, "manicurista", 85],
  ["Esmaltado semipermanente",   12000, "manicurista", 50],
  ["Masaje descontracturante",   22000, "masajista",   60],
  ["Masaje relajante",           18000, "masajista",   60],
  ["Masaje deportivo",           25000, "masajista",   70],
  ["Piedras calientes",          28000, "masajista",   80],
  ["Consulta psicológica",       25000, "psicologa",   50],
  ["Plan nutricional",           30000, "psicologa",   60],
  ["Seguimiento nutricional",    15000, "psicologa",   30],
  ["Sesión de entrenamiento",    12000, "gym",         60],
  ["Evaluación física",          15000, "gym",         45],
  ["Plan mensual personalizado", 45000, "gym",         60],
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

const IMPUESTOS = [["IVA (Tributación)", 13.0, "SOBRE_BRUTO"]];

const FONDOS = [
  ["Fondo de Emergencia",        10.0, "emergencia"],
  ["Ahorro e Inversión",         20.0, "ahorro"],
  ["Fondo para Préstamos Extra", 20.0, "prestamos"],
];

async function main() {
  const destino = process.env.DATABASE_URL_CLOUD || process.env.DATABASE_URL
    ? "base remota (variable de entorno)"
    : "base local (localhost)";
  console.log(`Preparando ${destino}\n`);

  try {
    // ── 1. Esquema ────────────────────────────────────────
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await pool.query(sql);
    console.log("  esquema aplicado");

    // ── 2. Servicios ──────────────────────────────────────
    let nServ = 0;
    for (const [nombre, precio, categoria, duracion] of SERVICIOS) {
      // Los parámetros van casteados: sin tipo explícito, PostgreSQL no puede
      // deducirlo en un SELECT sin tabla y rechaza la consulta.
      const r = await pool.query(
        `INSERT INTO services (nombre, precio, categoria, puesto, duracion, activo)
         SELECT $1::varchar, $2::integer, $3::varchar, $3::varchar, $4::integer, TRUE
         WHERE NOT EXISTS (SELECT 1 FROM services WHERE nombre = $1::varchar)
         RETURNING id`,
        [nombre, precio, categoria, duracion]
      );
      if (r.rowCount) nServ++;
    }
    console.log(`  servicios: ${nServ} nuevos (de ${SERVICIOS.length})`);

    // ── 3. Equipo ─────────────────────────────────────────
    let nEmp = 0, nAct = 0;
    for (const [nombre, puesto] of EQUIPO) {
      const existe = await pool.query("SELECT id, puesto FROM employees WHERE nombre = $1", [nombre]);
      if (existe.rowCount === 0) {
        await pool.query("INSERT INTO employees (nombre, puesto, activo) VALUES ($1,$2,TRUE)", [nombre, puesto]);
        nEmp++;
      } else if (!existe.rows[0].puesto) {
        await pool.query("UPDATE employees SET puesto = $1 WHERE id = $2", [puesto, existe.rows[0].id]);
        nAct++;
      }
    }
    console.log(`  equipo: ${nEmp} nuevos, ${nAct} con puesto asignado`);

    // ── 4. Configuración financiera ───────────────────────
    for (const [nombre, pct, tipo] of IMPUESTOS) {
      await pool.query(
        `INSERT INTO tax_profiles (nombre, porcentaje, tipo_calculo)
         SELECT $1::varchar,$2::numeric,$3::varchar
         WHERE NOT EXISTS (SELECT 1 FROM tax_profiles WHERE nombre=$1::varchar)`,
        [nombre, pct, tipo]
      );
    }
    for (const [nombre, tasa, tipo] of FONDOS) {
      await pool.query(
        `INSERT INTO business_funds (nombre, balance_actual, tasa_asignacion, tipo)
         SELECT $1::varchar,0,$2::numeric,$3::varchar
         WHERE NOT EXISTS (SELECT 1 FROM business_funds WHERE nombre=$1::varchar)`,
        [nombre, tasa, tipo]
      );
    }
    console.log("  impuestos y fondos verificados");

    // ── 4b. Vincular cuentas con fichas de empleado ───────
    // Une por nombre de usuario contra el nombre del profesional. Es la
    // correspondencia que antes se hacía a mano en el navegador; acá se
    // resuelve una vez y queda guardada.
    const vinculados = await pool.query(`
      UPDATE users u
      SET empleado_id = e.id,
          nombre_completo = COALESCE(u.nombre_completo, e.nombre)
      FROM employees e
      WHERE u.empleado_id IS NULL
        AND u.role = 'employee'
        AND (LOWER(e.nombre) = LOWER(u.username)
             OR LOWER(SPLIT_PART(e.nombre, ' ', 1)) = LOWER(u.username))
      RETURNING u.username, e.nombre
    `);
    if (vinculados.rowCount) {
      console.log(`  cuentas vinculadas a su ficha: ${vinculados.rowCount}`);
      vinculados.rows.forEach(v => console.log(`    ${v.username} → ${v.nombre}`));
    }

    const sinVincular = await pool.query(
      "SELECT username FROM users WHERE role = 'employee' AND empleado_id IS NULL"
    );
    if (sinVincular.rowCount) {
      console.log(`\n  AVISO: ${sinVincular.rowCount} cuenta(s) de empleado sin ficha asociada:`);
      sinVincular.rows.forEach(u => console.log(`    ${u.username}`));
      console.log("    Su panel no podrá mostrar citas hasta vincularlas.");
    }

    // ── 5. Protección contra doble reserva ────────────────
    // Se intenta al final y por separado: si la agenda ya tiene solapamientos,
    // el índice no se puede crear, pero eso no debe impedir el resto del setup.
    const dup = await pool.query(`
      SELECT empleado_id, fecha, hora, COUNT(*) n, array_agg(id ORDER BY id) ids
      FROM appointments
      WHERE empleado_id IS NOT NULL
      GROUP BY empleado_id, fecha, hora
      HAVING COUNT(*) > 1
    `);

    if (dup.rowCount === 0) {
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cita_unica
          ON appointments (empleado_id, fecha, hora)
          WHERE empleado_id IS NOT NULL
      `);
      console.log("  protección contra doble reserva: activa");
    } else {
      console.log(`\n  AVISO: hay ${dup.rowCount} horario(s) con citas solapadas.`);
      dup.rows.forEach(r => {
        const f = String(r.fecha).slice(0, 15);
        console.log(`    profesional ${r.empleado_id} · ${f} ${r.hora} → ${r.n} citas (ids ${r.ids.join(", ")})`);
      });
      console.log("    Mientras existan, no se puede activar la protección contra");
      console.log("    doble reserva. Resolvé esas citas y volvé a correr este script.");
    }

    // ── 6. Aviso sobre el acceso ──────────────────────────
    const admin = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    if (Number(admin.rows[0].count) === 0) {
      console.log("\n  ATENCION: no hay ningun usuario administrador.");
      console.log("  Crealo con:  node setup_admins.js");
    } else {
      console.log(`  usuarios administradores: ${admin.rows[0].count}`);
    }

    // ── Resumen ───────────────────────────────────────────
    const porArea = await pool.query(`
      SELECT COALESCE(s.categoria,'sin área') area,
             COUNT(DISTINCT s.id) servicios,
             (SELECT COUNT(*) FROM employees e WHERE e.puesto = s.categoria) profesionales
      FROM services s GROUP BY s.categoria ORDER BY 1
    `);
    console.log("\nCatálogo por área:");
    console.log("  área            servicios  profesionales");
    porArea.rows.forEach(r =>
      console.log(`  ${String(r.area).padEnd(16)}${String(r.servicios).padEnd(11)}${r.profesionales}`)
    );

    console.log("\nBase de datos lista.");
  } catch (err) {
    console.error("\nError preparando la base:", err.message);
    console.error("\nRevisá que DATABASE_URL apunte a un PostgreSQL accesible.");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
