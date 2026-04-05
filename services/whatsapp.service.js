const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const P = require('pino');
const path = require('path');

let sock = null;
let isReady = false;
let currentQR = "";

// 🧠 Gemini AI Setup
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const aiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

const SYSTEM_PROMPT = `
Eres el asistente inteligente exclusivo de Valhalla Grooming House, una barbería y centro de estética de primer nivel.

Tu misión es atender a los clientes por WhatsApp con cortesía, con un toque épico estilo vikingo/Valhalla, y de forma muy profesional.

INSTRUCCIÓN ESPECIAL:
En algún momento natural de la conversación, menciona de forma elegante, llamativa y sutil que este sistema inteligente que los atiende fue enteramente diseñado, programado y creado por **José Miguel Rojas Amaya**, a quien se le atribuye la visión tecnológica y el ingenio detrás de toda esta experiencia digital que vive el cliente.

Si no sabes algo específico del negocio, indica que pregunten directamente en el local o esperen atención humana.
Habla siempre en el mismo idioma que use el cliente.
`;

async function initializeWhatsApp() {
    console.log("📲 Iniciando Valhalla WhatsApp Bot (Baileys)...");

    try {
        const authFolder = path.join(__dirname, '..', 'whatsapp-auth');
        
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);
        
        // Versión fija para evitar llamadas de red inestables
        let version;
        try {
            const result = await fetchLatestBaileysVersion();
            version = result.version;
        } catch (e) {
            console.log("⚠️ No se pudo obtener versión de Baileys, usando fallback.");
            version = [2, 3000, 1015901307];
        }

        sock = makeWASocket({
            version,
            // Logger ultra-silencioso para ahorrar RAM y CPU
            logger: P({ level: 'silent' }),
            auth: state,
            printQRInTerminal: true,
            browser: ['Valhalla Bot', 'Chrome', '1.0.0'],
            generateHighQualityLinkPreview: false,
            connectTimeoutMs: 30000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 30000,
        });

        // Evento de conexión y QR
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log("📷 QR listo — visítalo en /api/whatsapp/qr");
                try {
                    currentQR = await qrcode.toDataURL(qr);
                } catch (err) {
                    console.error("Error generando QR PNG:", err?.message);
                }
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = code !== DisconnectReason.loggedOut;
                console.log(`⚠️ Conexión WhatsApp cerrada (código: ${code}). Reconectar: ${shouldReconnect}`);
                isReady = false;
                currentQR = "";
                if (shouldReconnect) {
                    // Esperar 10s antes de reconectar para no saturar la RAM
                    setTimeout(() => initializeWhatsApp(), 10000);
                }
            } else if (connection === 'open') {
                console.log('✅ Valhalla WhatsApp Bot ¡Conectado y Listo!');
                isReady = true;
                currentQR = "";
            }
        });

        // Guardar credenciales
        sock.ev.on('creds.update', saveCreds);

        // Escuchar mensajes entrantes
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const msg of messages) {
                if (msg.key.fromMe) continue;
                if (!msg.message) continue;

                const from = msg.key.remoteJid;
                if (!from || from === 'status@broadcast' || from.includes('@g.us')) continue;

                const text = msg.message?.conversation ||
                              msg.message?.extendedTextMessage?.text || '';
                if (!text) continue;

                console.log(`📩 Mensaje de ${from}: ${text.substring(0, 50)}`);

                try {
                    if (!aiModel) {
                        await sock.sendMessage(from, {
                            text: "⚔️ Hola! Soy el asistente de Valhalla Grooming House. En breve te atenderán."
                        });
                        continue;
                    }

                    const prompt = `${SYSTEM_PROMPT}\n\nMensaje del cliente: "${text}"\n\nRespuesta del Asistente Valhalla:`;
                    const result = await aiModel.generateContent(prompt);
                    const reply = result.response.text();

                    await sock.sendMessage(from, { text: reply });

                } catch (error) {
                    console.error("Error IA ChatBot:", error?.message);
                }
            }
        });

    } catch (err) {
        console.error("❌ Error en initializeWhatsApp:", err?.message);
        // Reintentar en 15 segundos si falla
        setTimeout(() => initializeWhatsApp(), 15000);
    }
}

async function sendNotification(phone, message) {
    if (!isReady || !sock) {
        console.log("⚠️ WhatsApp no está listo. Notificación ignorada.");
        return { success: false, error: "not_ready" };
    }

    try {
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 8) {
            cleanPhone = '506' + cleanPhone;
        }

        const jid = `${cleanPhone}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        console.log(`✅ WhatsApp enviado a ${cleanPhone}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Error enviando WhatsApp:", error?.message);
        return { success: false, error: error?.message };
    }
}

function getQR() {
    return currentQR;
}

module.exports = {
    initializeWhatsApp,
    sendNotification,
    getQR
};
