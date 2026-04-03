console.log("🔥 ESTE ES MI APP.JS REAL");
const express = require("express");
const path = require("path");

const app = express();

// importar rutas
const appointmentRoutes = require("./routes/appointments.routes");
const finanzasRoutes = require("./routes/finanzas.routes");
const analiticaRoutes = require("./routes/analitica.routes");

// permitir JSON
app.use(express.json());

// servir frontend
app.use(express.static(path.join(__dirname, "public")));

// usar rutas
app.use("/api", appointmentRoutes);
app.use("/api/finanzas", finanzasRoutes);
app.use("/api/finanzas/analitica", analiticaRoutes);

// prueba API
app.get("/api", (req, res) => {
    res.json({ message: "API Valhalla funcionando ⚔️" });
});
app.get("/api/test", (req, res) => {
    res.send("FUNCIONA TEST");
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});