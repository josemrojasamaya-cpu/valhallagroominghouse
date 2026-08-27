/**
 * seed_demo.js — Carga datos de ejemplo para mostrar el sistema funcionando.
 *
 * Genera un mes de operacion realista de la barberia: servicios, empleados,
 * citas repartidas en lo que va del mes, metas, gastos fijos, un prestamo
 * con pagos y movimientos en el libro mayor.
 *
 * Uso:  node seed_demo.js
 *
 * Los datos son ficticios. El script LIMPIA las tablas operativas antes de
 * insertar, para que se pueda correr varias veces sin acumular basura.
 * No toca la tabla de usuarios: las credenciales de acceso se mantienen.
 */

const pool = require("./config/db");

// Precios en colones, en el rango real de una barberia en Costa Rica.
const SERVICIOS = [
  { nombre: "Corte clásico",          precio: 9000,  categoria: "barbero" },
  { nombre: "Corte + barba",          precio: 14000, categoria: "barbero" },
  { nombre: "Afeitado con navaja",    precio: 8000,  categoria: "barbero" },
  { nombre: "Manicura",               precio: 7500,  categoria: "masajista" },
  { nombre: "Masaje descontracturante", precio: 22000, categoria: "masajista" },
  { nombre: "Limpieza facial",        precio: 18000, categoria: "facial" },
  { nombre: "Sesión de entrenamiento", precio: 12000, categoria: "gym" },
];

const EMPLEADOS = ["Andrés Villalobos", "Kevin Mora", "Sofía Jiménez"];

const CLIENTES = [
  ["Carlos Ramírez",   "8712-4590"],
  ["Diego Solano",     "6045-1183"],
  ["Marco Vargas",     "7238-9902"],
  ["Luis Fernández",   "8390-7741"],
  ["Javier Castro",    "6612-3308"],
  ["Andrea Rojas",     "8877-2214"],
  ["Fabián Núñez",     "7104-6650"],
  ["Esteban Quirós",   "6529-8837"],
];

// Generador pseudoaleatorio con semilla fija: el seed produce siempre los
// mismos datos, asi la demo es reproducible y las capturas no cambian.
let semilla = 20260426;
function rand() {
  semilla = (semilla * 1103515245 + 12345) % 2147483648;
  return semilla / 2147483648;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

async function seed() {
  const hoy = new Date();
  const mes = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();
  const diaActual = hoy.getDate();

  try {
    console.log("Limpiando datos operativos previos...");
    // El orden respeta las llaves foraneas.
    await pool.query("DELETE FROM loan_payments");
    await pool.query("DELETE FROM ledger_transactions");
    await pool.query("DELETE FROM appointments");
    await pool.query("DELETE FROM goals");
    await pool.query("DELETE FROM salaries");
    await pool.query("DELETE FROM loans");
    await pool.query("DELETE FROM fixed_expenses");
    await pool.query("DELETE FROM services");
    await pool.query("DELETE FROM employees");

    // ── Servicios ────────────────────────────────────────────────
    const serviciosIds = [];
    for (const s of SERVICIOS) {
      const r = await pool.query(
        "INSERT INTO services (nombre, precio, categoria) VALUES ($1,$2,$3) RETURNING id, precio",
        [s.nombre, s.precio, s.categoria]
      );
      serviciosIds.push(r.rows[0]);
    }
    console.log(`  ${serviciosIds.length} servicios`);

    // ── Empleados y salarios ─────────────────────────────────────
    const empleadosIds = [];
    for (const nombre of EMPLEADOS) {
      const r = await pool.query(
        "INSERT INTO employees (nombre) VALUES ($1) RETURNING id",
        [nombre]
      );
      empleadosIds.push(r.rows[0].id);
    }
    // Salario base; la comision por meta se calcula aparte en el ERP.
    for (const id of empleadosIds) {
      await pool.query(
        "INSERT INTO salaries (empleado_id, monto_fijo) VALUES ($1,$2)",
        [id, 250000]
      );
    }
    console.log(`  ${empleadosIds.length} empleados con salario base`);

    // ── Citas del mes en curso ───────────────────────────────────
    // Se reparten entre el dia 1 y hoy, con mas volumen viernes y sabado,
    // que es el patron real de una barberia.
    const horas = ["09:00","10:00","11:00","13:00","14:00","15:00","16:00","17:00"];
    let totalCitas = 0;

    for (let dia = 1; dia <= diaActual; dia++) {
      const fecha = new Date(anio, mes - 1, dia);
      const diaSemana = fecha.getDay(); // 0 domingo, 6 sabado
      if (diaSemana === 0) continue;    // domingo cerrado

      // Viernes (5) y sabado (6) concentran mas citas.
      let cantidad = diaSemana === 5 ? 6 : diaSemana === 6 ? 7 : 3;
      cantidad += Math.floor(rand() * 2);

      const usadas = new Set();
      for (let i = 0; i < cantidad; i++) {
        const hora = pick(horas);
        const empleado = pick(empleadosIds);
        const clave = `${hora}-${empleado}`;
        if (usadas.has(clave)) continue; // evita choque de horario
        usadas.add(clave);

        const [nombre, telefono] = pick(CLIENTES);
        const servicio = pick(serviciosIds);
        const fechaStr = `${anio}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;

        await pool.query(
          `INSERT INTO appointments (cliente_nombre, cliente_telefono, servicio_id, empleado_id, fecha, hora)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [nombre, telefono, servicio.id, empleado, fechaStr, hora]
        );
        totalCitas++;
      }
    }
    console.log(`  ${totalCitas} citas del mes en curso`);

    // ── Metas mensuales ──────────────────────────────────────────
    // Una alcanzable, una ajustada y una fuera de alcance, para que el panel
    // muestre los tres estados (cumplida / en progreso / en riesgo).
    const metas = [25, 40, 70];
    for (let i = 0; i < empleadosIds.length; i++) {
      await pool.query(
        "INSERT INTO goals (empleado_id, cantidad, mes, anio) VALUES ($1,$2,$3,$4)",
        [empleadosIds[i], metas[i], mes, anio]
      );
    }
    console.log(`  ${metas.length} metas mensuales`);

    // ── Gastos fijos ─────────────────────────────────────────────
    const gastos = [
      ["Alquiler del local",      450000, 1],
      ["Electricidad y agua",      85000, 15],
      ["Internet y telefonía",     35000, 10],
      ["Insumos y productos",     120000, 5],
      ["Publicidad en redes",      50000, 20],
    ];
    for (const [nombre, monto, dia] of gastos) {
      await pool.query(
        "INSERT INTO fixed_expenses (nombre, monto, categoria, dia_pago) VALUES ($1,$2,$3,$4)",
        [nombre, monto, "general", dia]
      );
      await pool.query(
        "INSERT INTO ledger_transactions (tipo, monto, descripcion) VALUES ($1,$2,$3)",
        ["GASTO_FIJO", -monto, `Registro gasto: ${nombre}`]
      );
    }
    console.log(`  ${gastos.length} gastos fijos`);

    // ── Préstamo con historial de pagos ──────────────────────────
    const montoInicial = 3500000;
    const cuota = 175000;
    const tasaAnual = 18;

    const prestamo = await pool.query(
      `INSERT INTO loans (descripcion, monto_inicial, monto_actual, tasa_interes_anual, plazo_meses, cuota_mensual, dia_pago)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      ["Remodelación del local — Banco Nacional", montoInicial, montoInicial, tasaAnual, 24, cuota, 5]
    );
    const loanId = prestamo.rows[0].id;

    // Cuatro cuotas ya pagadas, con el desglose capital/interes real.
    let saldo = montoInicial;
    for (let i = 0; i < 4; i++) {
      const interes = saldo * ((tasaAnual / 100) / 12);
      const capital = cuota - interes;
      saldo -= capital;

      await pool.query(
        `INSERT INTO loan_payments (loan_id, monto_pagado, monto_capital, monto_interes, es_extraordinario)
         VALUES ($1,$2,$3,$4,$5)`,
        [loanId, cuota, capital, interes, false]
      );
      await pool.query(
        "INSERT INTO ledger_transactions (tipo, monto, descripcion) VALUES ($1,$2,$3)",
        ["PAGO_CUOTA_PRESTAMO", -cuota, `Abono Préstamo #${loanId}: Remodelación del local`]
      );
    }
    await pool.query("UPDATE loans SET monto_actual = $1 WHERE id = $2", [saldo, loanId]);
    console.log(`  1 préstamo con 4 cuotas pagadas (saldo ₡${Math.round(saldo).toLocaleString("es-CR")})`);

    console.log("\nDatos de ejemplo cargados. Entrá al panel para verlos.");
  } catch (err) {
    console.error("Error cargando datos de ejemplo:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
