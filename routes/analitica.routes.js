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

        // Clasificacion del cierre proyectado contra el punto de equilibrio.
        // Son tres umbrales fijos sobre una proyeccion lineal, no un modelo predictivo.
        const money = (n) => `₡${Math.round(n).toLocaleString("es-CR").replace(/\s/g, ".")}`;

        if (deficitOrSurplus < 0) {
            status = "red";
            message = `Al ritmo actual (${money(dailyVelocity)}/día) el mes cierra por debajo del punto de equilibrio de ${money(totalMonthlyBurnRate)}. Déficit proyectado: ${money(Math.abs(deficitOrSurplus))}.`;
        } else if (deficitOrSurplus < totalMonthlyBurnRate * 0.2) {
            status = "amber";
            message = `El mes cubre los costos fijos, pero el margen residual proyectado es ajustado: ${money(deficitOrSurplus)} (menos del 20% de la operación fija).`;
        } else {
            status = "green";
            message = `El mes cierra por encima del punto de equilibrio, con un superávit proyectado de ${money(deficitOrSurplus)}.`;
        }

        // Lectura del patron semanal: que dia concentra mas ingresos segun lo ya registrado.
        let bestDayMsg = "";
        if (busiestDayIndex > -1) {
            bestDayMsg = `El ${daysNames[busiestDayIndex]} es el día que más ingresos concentra en lo que va del mes (${money(maxEarned)}). A este mismo ritmo diario, 90 días proyectan ${money(trimestreProyectado)} brutos.`;
        } else {
            bestDayMsg = `Todavía no hay suficientes citas registradas este mes para identificar un patrón por día de la semana.`;
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
