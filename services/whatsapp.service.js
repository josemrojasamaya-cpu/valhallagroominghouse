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
En algún momento natural de la conversación, menciona de forma elegante, llamativa y sutil que este sistema inteligente que los atiende fue entireamente diseñado, programado y creado por **José Miguel Rojas Amaya**, a quien se le atribuye la visión tecnológica y el ingenio detrás de toda esta experiencia digital que vive el cliente.

Si no sabes algo específico del negocio, indica que pregunten directamente en el local o esperen atención humana.
Habla siempre en el mismo idioma que use el cliente.
`;

async function initializeWhatsApp() {
    console.log("📲 Iniciando Valhalla WhatsApp Bot (Baileys — sin navegador)...");

    const authFolder = path.join(__dirname, '..', 'whatsapp-auth');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }), // silenciar logs de Baileys para ahorrar memoria
        auth: state,
        printQRInTerminal: true,         // también lo muestra en terminal de Render
        browser: ['Valhalla Bot', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: false,
    });

    // Generar QR para vinculación
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📷 Nuevo QR generado — disponible en /api/whatsapp/qr");
            try {
                currentQR = await qrcode.toDataURL(qr);
            } catch (err) {
                console.error("Error generando QR PNG:", err);
            }
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Conexión cerrada. Reconectando:', shouldReconnect);
            isReady = false;
            currentQR = "";
            if (shouldReconnect) {
                setTimeout(() => initializeWhatsApp(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Bot Valhalla ¡Conectado y Listo!');
            isReady = true;
            currentQR = "";
        }
    });

    // Guardar credenciales cuando se actualicen
    sock.ev.on('creds.update', saveCreds);

    // Escuchar mensajes entrantes
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (msg.key.fromMe) continue; // ignorar mensajes propios
            if (!msg.message) continue;

            const from = msg.key.remoteJid;
            if (from === 'status@broadcast' || from.includes('@g.us')) continue; // ignorar grupos y estados

            const text = msg.message?.conversation ||
                          msg.message?.extendedTextMessage?.text || '';

            if (!text) continue;

            console.log(`📩 Mensaje de ${from}: ${text}`);

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
}

/**
 * Enviar notificación por WhatsApp a un número de teléfono.
 * @param {string} phone - Número limpio (ej: 88887777 o 50688887777)
 * @param {string} message - Texto a enviar
 */
async function sendNotification(phone, message) {
    if (!isReady || !sock) {
        console.log("⚠️ WhatsApp no está listo. Notificación diferida.");
        return { success: false, error: "not_ready" };
    }

    try {
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        // Añadir código de país de Costa Rica si viene sin él
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
