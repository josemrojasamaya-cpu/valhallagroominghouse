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

    const loadingPage = `
        <html>
        <head>
            <title>Valhalla Bot - Vincular WhatsApp</title>
            <meta http-equiv="refresh" content="3">
            <style>
                body { background:#111; color:#fff; font-family:sans-serif; text-align:center; padding:60px 20px; }
                .spinner { border: 6px solid #333; border-top: 6px solid #d4af37; border-radius:50%; width:60px; height:60px; animation: spin 1s linear infinite; margin: 30px auto; }
                @keyframes spin { to { transform: rotate(360deg); } }
                h1 { color: #d4af37; }
                p { color: #aaa; }
            </style>
        </head>
        <body>
            <h1>⚔️ Valhalla Bot</h1>
            <div class="spinner"></div>
            <p>Iniciando el bot... El código QR aparecerá aquí en unos segundos.</p>
            <p style="font-size:12px; color:#555;">Esta página se actualiza automáticamente cada 3 segundos.</p>
        </body>
        </html>`;

    const qrPage = `
        <html>
        <head>
            <title>Escanear QR - Valhalla Bot</title>
            <meta http-equiv="refresh" content="25">
            <style>
                body { background:#111; color:#fff; font-family:sans-serif; text-align:center; padding:40px 20px; }
                img { border: 8px solid #d4af37; border-radius:16px; }
                h1 { color: #d4af37; }
                .steps { background:#1a1a1a; border-radius:10px; padding:20px; max-width:400px; margin:20px auto; text-align:left; }
                .steps li { margin:8px 0; color:#ccc; }
            </style>
        </head>
        <body>
            <h1>⚔️ Vincular WhatsApp - Valhalla Bot</h1>
            <img src="${qrData}" alt="QR Code" width="280" height="280" />
            <div class="steps">
                <ol>
                    <li>Abre <strong>WhatsApp</strong> en tu celular</li>
                    <li>Ve a <strong>Menú (⋮) → Dispositivos vinculados</strong></li>
                    <li>Toca <strong>Vincular un dispositivo</strong></li>
                    <li>Apunta la cámara a este QR</li>
                </ol>
            </div>
            <p style="color:#555; font-size:12px;">El QR se renueva automáticamente cada 25 segundos</p>
        </body>
        </html>`;

    res.send(qrData ? qrPage : loadingPage);
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