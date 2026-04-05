console.log("🔥 ESTE ES MI APP.JS REAL");
const express = require("express");
const path = require("path");

const app = express();

// importar rutas
const appointmentRoutes = require("./routes/appointments.routes");
const finanzasRoutes = require("./routes/finanzas.routes");
const analiticaRoutes = require("./routes/analitica.routes");

// importar servicios
const whatsappService = require("./services/whatsapp.service");


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

// Ver QR de WhatsApp en el navegador
app.get("/api/whatsapp/qr", (req, res) => {
    const qrData = whatsappService.getQR();
    if (!qrData) {
        return res.send(`<h2>El bot de WhatsApp ya está vinculado o aún no se ha generado el código. Revisa en la terminal.</h2>`);
    }
    res.send(`
        <html>
            <head><title>Vincular WhatsApp</title></head>
            <body style="text-align:center; padding: 50px; background:#111; color:#fff; font-family:sans-serif;">
                <h1>Escanea el código QR para vincular WhatsApp</h1>
                <img src="${qrData}" alt="QR Code" style="width: 300px; height: 300px; border: 10px solid white; border-radius: 10px;" />
                <p style="margin-top:20px;">Abre WhatsApp en tu celular -> Dispositivos vinculados -> Vincular un dispositivo</p>
                <script>setInterval(() => window.location.reload(), 10000);</script>
            </body>
        </html>
    `);
});

// Migrar Base de Datos Hosteada
app.get("/api/install/migrate", (req, res) => {
    const { exec } = require('child_process');
    exec('node setup_db.js && node setup_ledger.js', (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ status: "Error", message: err.message, stderr });
        }
        res.json({ status: "Éxito", details: "Base de Datos en Producción migradas a las nuevas tablas de Finanzas/Goals.", logs: stdout });
    });
});
// Migrar Administradores Puros
app.get("/api/install/admins", (req, res) => {
    const { exec } = require('child_process');
    exec('node setup_admins.js', (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ status: "Error", message: err.message, stderr });
        }
        res.json({ status: "Éxito", details: "Administradores sincronizados con bcrypt.", logs: stdout });
    });
});

app.get("/api/test", (req, res) => {
    res.send("FUNCIONA TEST");
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    
    // Iniciar WhatsApp Bot cuando el servidor arranca
    whatsappService.initializeWhatsApp();
});