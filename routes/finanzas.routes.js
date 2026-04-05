const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// ==========================================
// RESUMEN MATEMÁTICO DEL MES ACTUAL
// ==========================================
router.get("/resumen", async (req, res) => {
    try {
        const date = new Date();
        const currentMonth = date.getMonth() + 1; // 1-12
        const currentYear = date.getFullYear();

        // 1. OBTENER INGRESOS BRUTOS DEL MES (precio viene de services)
        const ingresosQuery = await pool.query(`
            SELECT COALESCE(s.precio, 0) as precio
            FROM appointments a
            LEFT JOIN services s ON a.servicio_id = s.id
            WHERE EXTRACT(MONTH FROM a.fecha::date) = $1
            AND EXTRACT(YEAR FROM a.fecha::date) = $2
        `, [currentMonth, currentYear]);

        let ingresoBruto = ingresosQuery.rows.reduce((acc, curr) => {
            return acc + Number(curr.precio || 0);
        }, 0);

        // 2. EXTRAER IMPUESTOS (HACIENDA)
        const taxesQuery = await pool.query("SELECT * FROM tax_profiles WHERE active = TRUE");
        let totalRetencionTributaria = 0;
        
        taxesQuery.rows.forEach(tax => {
            if (tax.tipo_calculo === 'SOBRE_BRUTO') {
                totalRetencionTributaria += ingresoBruto * (Number(tax.porcentaje) / 100);
            }
        });

        const ingresoPostImpuestos = ingresoBruto - totalRetencionTributaria;

        // 3. OBTENER GASTOS FIJOS, SALARIOS Y PRÉSTAMOS
        const fixedExpensesQuery = await pool.query(`SELECT sum(monto) as total FROM fixed_expenses WHERE active = TRUE`);
        const salariesQuery = await pool.query(`SELECT sum(monto_fijo) as total FROM salaries`);
        const loansQuotasQuery = await pool.query(`SELECT sum(cuota_mensual) as total FROM loans WHERE active = TRUE`);
        
        let totalGastosFijos = 0;
        totalGastosFijos += Number(fixedExpensesQuery.rows[0].total || 0);
        totalGastosFijos += Number(salariesQuery.rows[0].total || 0);
        totalGastosFijos += Number(loansQuotasQuery.rows[0].total || 0);

        // 4. GANANCIA DEL NEGOCIO (Antes de distribución del dueño)
        const gananciaNegocio = ingresoPostImpuestos - totalGastosFijos;

        // 5. DISTRIBUCIÓN DEL DUEÑO (Regla explícita del usuario)
        // 20% Ahorro, 20% Préstamo Extra, 60% Para el Dueño Mínimo Variable
        let fondoAhorro = 0;
        let fondoPrestamoExtra = 0;
        let bolsaDueno = 0;

        if (gananciaNegocio > 0) {
            fondoAhorro = gananciaNegocio * 0.20;
            fondoPrestamoExtra = gananciaNegocio * 0.20;
            bolsaDueno = gananciaNegocio * 0.60;
        }

        // 6. CÁLCULO DE BONOS / COMISIONES DE EMPLEADOS
        const employeesPerformances = await pool.query(`
            SELECT 
                e.id, 
                e.nombre,
                COALESCE(g.cantidad, 9999) as meta,
                COUNT(a.id) as citas_realizadas,
                SUM(COALESCE(s.precio, 0)) as monto_generado
            FROM employees e
            LEFT JOIN goals g ON e.id = g.empleado_id AND g.mes = $1 AND g.anio = $2
            LEFT JOIN appointments a ON e.id = a.empleado_id 
                AND EXTRACT(MONTH FROM a.fecha::date) = $1
                AND EXTRACT(YEAR FROM a.fecha::date) = $2
            LEFT JOIN services s ON a.servicio_id = s.id
            GROUP BY e.id, e.nombre, g.cantidad
        `, [currentMonth, currentYear]);

        let totalComisiones = 0;
        const performanceDetails = employeesPerformances.rows.map(emp => {
            const hasGoal = emp.meta !== 9999;
            const cumplioMeta = emp.citas_realizadas >= emp.meta;
            const generated = Number(emp.monto_generado || 0);
            
            // "Los bonos se van a pagar del 60% restante que me quedaría a mi como dueño puro"
            const comision = (hasGoal && cumplioMeta) ? (generated * 0.40) : 0;
            totalComisiones += comision;

            return {
                nombre: emp.nombre,
                realizadas: Number(emp.citas_realizadas),
                meta: hasGoal ? emp.meta : "Sin meta",
                cumplioMeta,
                generado: generated,
                comision
            };
        });

        // 7. GANANCIA FINAL BOLSILLO DEL DUEÑO (Restando bonos de los empleados)
        const gananciaFinalLiquidaDueno = bolsaDueno - totalComisiones;

        res.json({
            ingresoBruto,
            totalRetencionTributaria,
            ingresoPostImpuestos,
            totalGastosFijos,
            gananciaNegocio,
            fondoAhorro,
            fondoPrestamoExtra,
            bolsaDuenoBruta: bolsaDueno,
            totalComisiones,
            gananciaFinalLiquidaDueno,
            detalles_empleados: performanceDetails
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al generar resumen financiero riguroso" });
    }
});


// ==========================================
// GASTOS FIJOS (CRUD)
// ==========================================
router.get("/gastos", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM fixed_expenses WHERE active = TRUE ORDER BY dia_pago");
        res.json(result.rows);
    } catch (error) { res.status(500).send("Error"); }
});

router.post("/gastos", async (req, res) => {
    try {
        const { nombre, monto, categoria, dia_pago } = req.body;
        const result = await pool.query(
            "INSERT INTO fixed_expenses (nombre, monto, categoria, dia_pago) VALUES ($1, $2, $3, $4) RETURNING *",
            [nombre, monto, categoria, dia_pago]
        );
        // Ledger
        await pool.query("INSERT INTO ledger_transactions (tipo, monto, descripcion) VALUES ($1, $2, $3)", 
            ['GASTO_FIJO', -monto, `Registro gasto: ${nombre}`]);
            
        res.json(result.rows[0]);
    } catch (error) { res.status(500).send("Error"); }
});

router.delete("/gastos/:id", async (req, res) => {
    try {
        await pool.query("DELETE FROM fixed_expenses WHERE id = $1", [req.params.id]);
        res.json({ message: "Eliminado" });
    } catch (error) { res.status(500).send("Error"); }
});


// ==========================================
// PRÉSTAMOS (CRUD)
// ==========================================
router.get("/prestamos", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM loans WHERE active = TRUE");
        res.json(result.rows);
    } catch (error) { res.status(500).send("Error"); }
});

router.post("/prestamos", async (req, res) => {
    try {
        let { descripcion, monto_inicial, tasa_interes_anual, plazo_meses, cuota_mensual, dia_pago } = req.body;
        
        monto_inicial = Number(monto_inicial) || 0;
        tasa_interes_anual = Number(tasa_interes_anual) || 0.00;
        plazo_meses = Number(plazo_meses) || 1;
        cuota_mensual = Number(cuota_mensual) || 0;
        dia_pago = Number(dia_pago) || 1;

        const result = await pool.query(
            `INSERT INTO loans 
            (descripcion, monto_inicial, monto_actual, tasa_interes_anual, plazo_meses, cuota_mensual, dia_pago) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING * `,
            [descripcion, monto_inicial, monto_inicial, tasa_interes_anual, plazo_meses, cuota_mensual, dia_pago]
        );
        res.json(result.rows[0]);
    } catch (error) { 
        console.error("Error insertando prestamo:", error);
        res.status(500).json({ message: "Error", error: error.message }); 
    }
});

router.post("/prestamos/:id/pagos", async (req, res) => {
    try {
        const loanId = req.params.id;
        const { monto_pagado, es_extraordinario } = req.body;

        const loanQ = await pool.query("SELECT * FROM loans WHERE id = $1", [loanId]);
        if (loanQ.rows.length === 0) return res.status(404).send("No encontrado");

        const loan = loanQ.rows[0];
        
        let monto_interes = 0;
        let monto_capital = 0;

        if (es_extraordinario) {
            // El abono extra va 100% al capital y no genera intereses en el momento del pago
            monto_capital = monto_pagado; 
        } else {
            // Interés simple mensual 
            monto_interes = Number(loan.monto_actual) * ((Number(loan.tasa_interes_anual) / 100) / 12);
            monto_capital = Number(monto_pagado) - monto_interes;
        }

        const newBalance = Number(loan.monto_actual) - monto_capital;

        await pool.query(
            "INSERT INTO loan_payments (loan_id, monto_pagado, monto_capital, monto_interes, es_extraordinario) VALUES ($1, $2, $3, $4, $5)",
            [loanId, monto_pagado, monto_capital, monto_interes, es_extraordinario]
        );

        await pool.query(
            "UPDATE loans SET monto_actual = $1 WHERE id = $2",
            [newBalance > 0 ? newBalance : 0, loanId]
        );

        // Ledger
        const tipoLedger = es_extraordinario ? 'ABONO_EXTRA_PRESTAMO' : 'PAGO_CUOTA_PRESTAMO';
        await pool.query("INSERT INTO ledger_transactions (tipo, monto, descripcion) VALUES ($1, $2, $3)", 
            [tipoLedger, -monto_pagado, `Abono Préstamo #${loanId}: ${loan.descripcion}`]);

        res.json({ message: "Pago registrado", newBalance });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error"); 
    }
});


// ==========================================
// SALARIOS FIJOS
// ==========================================
router.get("/salarios", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.*, e.nombre 
            FROM salaries s 
            JOIN employees e ON s.empleado_id = e.id
        `);
        res.json(result.rows);
    } catch (error) { res.status(500).send("Error"); }
});

router.post("/salarios", async (req, res) => {
    try {
        const { empleado_id, monto_fijo } = req.body;
        await pool.query(
            "INSERT INTO salaries (empleado_id, monto_fijo) VALUES ($1, $2)",
            [empleado_id, monto_fijo]
        );
        // Ledger
        await pool.query("INSERT INTO ledger_transactions (tipo, monto, descripcion) VALUES ($1, $2, $3)", 
            ['SALARIO_ADMIN', -monto_fijo, `Asignación de salario a emp#${empleado_id}`]);
            
        res.json({ message: "Salario registrado" });
    } catch (error) { res.status(500).send("Error"); }
});

router.delete("/salarios/:id", async (req, res) => {
    try {
        await pool.query("DELETE FROM salaries WHERE id = $1", [req.params.id]);
        res.json({ message: "Eliminado" });
    } catch (error) { res.status(500).send("Error"); }
});

// ==========================================
// CONFIGURACIÓN DE IMPUESTOS (HACIENDA)
// ==========================================
router.get("/impuestos", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM tax_profiles WHERE active = TRUE");
        res.json(result.rows);
    } catch (error) { res.status(500).send("Error"); }
});

router.post("/impuestos", async (req, res) => {
    try {
        const { nombre, porcentaje, tipo_calculo } = req.body;
        const result = await pool.query(
            "INSERT INTO tax_profiles (nombre, porcentaje, tipo_calculo) VALUES ($1, $2, $3) RETURNING *",
            [nombre, porcentaje, tipo_calculo || 'SOBRE_BRUTO']
        );
        res.json(result.rows[0]);
    } catch (error) { res.status(500).send("Error"); }
});

// ==========================================
// LIBRO MAYOR (LEDGER CONTABLE)
// ==========================================
router.get("/ledger", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM ledger_transactions ORDER BY fecha DESC LIMIT 100");
        res.json(result.rows);
    } catch (error) { res.status(500).send("Error"); }
});

module.exports = router;
