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

// ===== WHATSAPP BOT =====

// Endpoint JSON: estado del QR para polling desde el navegador
app.get("/api/whatsapp/qr/status", (req, res) => {
    const qrData = whatsappService.getQR();
    const isReady = whatsappService.isConnected();
    res.json({ 
        ready: !!qrData, 
        connected: isReady,
        qr: qrData || null 
    });
});

// Página del QR con polling en JavaScript (sin recargas de página)
app.get("/api/whatsapp/qr", (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Valhalla Bot - Vincular WhatsApp</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0d0d0d; color:#fff; font-family:'Segoe UI',sans-serif;
         min-height:100vh; display:flex; flex-direction:column;
         align-items:center; justify-content:center; padding:20px; }
  h1 { color:#d4af37; font-size:2rem; margin-bottom:6px; }
  .creator { color:#888; font-size:.85rem; margin-bottom:30px; }
  .creator strong { color:#d4af37; }
  .spinner { border:5px solid #222; border-top:5px solid #d4af37;
             border-radius:50%; width:70px; height:70px;
             animation:spin .8s linear infinite; margin:20px auto; }
  @keyframes spin { to { transform:rotate(360deg); } }
  #status { color:#888; margin-top:14px; font-size:.85rem; }
  #qr-img { border:6px solid #d4af37; border-radius:14px;
            display:none; margin:10px auto; }
  .steps { background:#1a1a1a; border-radius:10px; padding:18px 22px;
           max-width:340px; text-align:left; margin-top:20px; display:none; }
  .steps li { color:#ccc; margin:7px 0; font-size:.9rem; }
  .steps strong { color:#d4af37; }
  .dot { display:inline-block; width:8px; height:8px; border-radius:50%;
         background:#d4af37; margin-right:6px; animation:pulse 1.2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;}50%{opacity:.3;} }
  .connected { color:#4caf50; font-size:1.1rem; display:none; }
</style>
</head>
<body>
  <h1>&#9876;&#65039; Valhalla Bot</h1>
  <p class="creator">Sistema creado por <strong>Jos&#233; Miguel Rojas Amaya</strong></p>

  <div id="spinner" class="spinner"></div>
  <img id="qr-img" width="270" height="270" alt="QR Code"/>
  <p id="status"><span class="dot"></span>Iniciando bot de WhatsApp&hellip;</p>
  <p class="connected" id="connected-msg">&#10003; Bot conectado. Puedes cerrar esta ventana.</p>
  <ol class="steps" id="steps">
    <li>Abre <strong>WhatsApp</strong> en tu celular</li>
    <li>Ve a <strong>Men&#250; (&#8942;) &rarr; Dispositivos vinculados</strong></li>
    <li>Toca <strong>Vincular un dispositivo</strong></li>
    <li>&#161;Apunta la c&#225;mara a este QR!</li>
  </ol>

<script>
var tries = 0;
var lastQR = null;

function poll() {
  tries++;
  fetch('/api/whatsapp/qr/status')
    .then(function(r){ return r.json(); })
    .then(function(data) {
      document.getElementById('status').innerHTML =
        '<span class="dot"></span>Verificando... intento ' + tries;

      if (data.connected) {
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('qr-img').style.display = 'none';
        document.getElementById('steps').style.display = 'none';
        document.getElementById('status').style.display = 'none';
        document.getElementById('connected-msg').style.display = 'block';
        return;
      }

      if (data.ready && data.qr) {
        if (data.qr !== lastQR) {
          lastQR = data.qr;
          document.getElementById('spinner').style.display = 'none';
          var img = document.getElementById('qr-img');
          img.src = data.qr;
          img.style.display = 'block';
          document.getElementById('steps').style.display = 'block';
          document.getElementById('status').textContent = 'Escanea el codigo QR ahora con tu celular';
        }
        setTimeout(poll, 5000);
      } else {
        setTimeout(poll, 2000);
      }
    })
    .catch(function(){ setTimeout(poll, 3000); });
}

poll();
</script>
</body>
</html>`);
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

// Capturar excepciones globales para que el bot nunca tire el servidor
process.on('uncaughtException', (err) => {
    console.error('⚠️ uncaughtException (servidor continúa):', err?.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('⚠️ unhandledRejection (servidor continúa):', reason?.message || reason);
});

app.listen(PORT, () => {
    console.log(`✅ Servidor Express corriendo en el puerto ${PORT}`);
    
    // Iniciar WhatsApp 5 segundos después del arranque
    setTimeout(() => {
        try {
            whatsappService.initializeWhatsApp();
        } catch (err) {
            console.error('❌ Error iniciando WhatsApp (servidor sigue activo):', err?.message);
        }
    }, 5000);
});