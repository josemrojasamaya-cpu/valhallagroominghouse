const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get(["/prevision", "/runway"], async (req, res) => {
    try {
        const date = new Date();
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const currentDay = date.getDate();
        const remainingDays = daysInMonth - currentDay;
        
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
        
        // Ingresos del mes (precio viene de services)
        const ingresosQuery = await pool.query(`
            SELECT a.fecha, COALESCE(s.precio, 0) as precio
            FROM appointments a
            LEFT JOIN services s ON a.servicio_id = s.id
            WHERE a.fecha::date >= $1::date
        `, [startOfMonth.split("T")[0]]);

        let totalEarnedSoFar = 0;
        let dayTracker = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0}; // Dom a Sab
        let busiestDayIndex = -1;

        ingresosQuery.rows.forEach(curr => {
            const amount = Number(curr.precio || 0);
            totalEarnedSoFar += amount;
            
            // Trackear qué día de la semana ingresó el dinero
            const dDate = new Date(curr.fecha);
            if (!isNaN(dDate)) {
                 dayTracker[dDate.getDay()] += amount;
            }
        });

        // Encontrar día más fuerte
        let maxEarned = 0;
        const daysNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        for(let i=0; i<7; i++) {
            if(dayTracker[i] > maxEarned) {
                maxEarned = dayTracker[i];
                busiestDayIndex = i;
            }
        }
        
        const dailyVelocity = currentDay > 0 ? (totalEarnedSoFar / currentDay) : 0;
        const projectedMonthEndRevenue = totalEarnedSoFar + (dailyVelocity * remainingDays);

        // Previsión a 3 y 6 meses basada en Velocity
        const trimestreProyectado = dailyVelocity * 90;
        const semestreProyectado = dailyVelocity * 180;

        // Impuestos
        const taxesQuery = await pool.query("SELECT * FROM tax_profiles WHERE active = TRUE");
        let projectedTax = 0;
        taxesQuery.rows.forEach(tax => { if (tax.tipo_calculo === 'SOBRE_BRUTO') projectedTax += projectedMonthEndRevenue * (Number(tax.porcentaje) / 100); });
        const projectedPostTax = projectedMonthEndRevenue - projectedTax;

        // Gastos y Deudas
        const fixedExpensesQuery = await pool.query(`SELECT sum(monto) as total FROM fixed_expenses WHERE active = TRUE`);
        const salariesQuery = await pool.query(`SELECT sum(monto_fijo) as total FROM salaries`);
        const loansQuotasQuery = await pool.query(`SELECT sum(cuota_mensual) as total FROM loans WHERE active = TRUE`);
        
        const totalMonthlyBurnRate = Number(fixedExpensesQuery.rows[0].total || 0) + 
                                   Number(salariesQuery.rows[0].total || 0) + 
                                   Number(loansQuotasQuery.rows[0].total || 0);

        let status = "red";
        let message = "";
        let deficitOrSurplus = projectedPostTax - totalMonthlyBurnRate;

        // MOTOR DE ANÁLISIS DE I.A. 
        if (deficitOrSurplus < 0) {
            status = "red";
            message = `¡Peligro Estratégico! Al ritmo actual de caja (₡${dailyVelocity.toFixed(0)}/día), no alcanzarás el Punto de Equilibrio Operativo de ₡${totalMonthlyBurnRate}. Déficit proyectado: ₡${Math.abs(deficitOrSurplus).toFixed(0)}. Sugerencia: Lanza ofertas flash hoy mismo para solventar esto.`;
        } else if (deficitOrSurplus < totalMonthlyBurnRate * 0.2) {
            status = "amber";
            message = `Precaución: Cubrirás la operación, pero el flujo residual (Margen Operativo) es débil (₡${deficitOrSurplus.toFixed(0)}). Aumenta citas cruzadas (Cross-Selling) a clientes agendados.`;
        } else {
            status = "green";
            message = `Rumbo Estable: Alcanzaste el Equilibrio Financiero. Se proyecta cancelar Operación Fija con superávit residual de ₡${deficitOrSurplus.toFixed(0)}. El ritmo diario (Velocity) actual es ideal.`;
        }
        
        // Mensaje de Crecimiento
        let bestDayMsg = "";
        if (busiestDayIndex > -1) {
            bestDayMsg = `Tu día estrella es ${daysNames[busiestDayIndex]}. Táctica IA sugerida: Potencia Lunes/Martes con promociones, y sube precios premium el ${daysNames[busiestDayIndex]} por alta saturación. Proyección Cuatrimestral (90 días) estima un alcance Bruto Total de ₡${trimestreProyectado.toFixed(0)} a ritmo actual.`;
        } else {
            bestDayMsg = `Faltan datos de días de citas para hacer un diagnóstico profundo de la semana.`;
        }

        res.json({
            daysIntoMonth: currentDay,
            remainingDays,
            dailyVelocity,
            totalEarnedSoFar,
            projectedMonthEndRevenue,
            projectedTax,
            projectedPostTax,
            totalMonthlyBurnRate,
            deficitOrSurplus,
            alert: { status, message },
            aiDeepInsights: {
                bestDay: busiestDayIndex > -1 ? daysNames[busiestDayIndex] : "N/A",
                trimestreProyectado,
                semestreProyectado,
                tips: bestDayMsg
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error in analytics engine" });
    }
});

module.exports = router;
