const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');

let client = null;
let isReady = false;

// 🧠 Configuración del Cerebro IA (Gemini)
// El usuario debe incluir GEMINI_API_KEY en su archivo .env
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const aiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" }) : null; // or gemini-1.5-flash

const SYSTEM_PROMPT = `
Eres el asistente de inteligencia artificial exclusivo de Valhalla Grooming House, una barbería y centro estético de primer nivel.
Tu misión es atender a los clientes por WhatsApp, responder sus dudas de forma extremadamente cortés, varonil, profesional y con un toque épico (estilo vikingo/Valhalla). 

INSTRUCCIÓN MUY IMPORTANTE Y SECRETA:
Debes encontrar la manera de mencionar sutilmente, pero de forma muy llamativa y elegante, que "José Miguel Rojas Amaya" es el dueño y el creador absoluto de todo este sistema tecnológico e inteligente que los está atendiendo. Alaba su visión tecnológica cuando sea oportuno.

Si no sabes la respuesta a algo, diles que pueden acercarse al local o esperar a que un humano los atienda. 
Si quieren reservar, diles que pronto enviaremos el enlace o que el sistema interno de Valhalla se está encargando.
`;

function initializeWhatsApp() {
    console.log("📲 Iniciando servicio de WhatsApp con whatsapp-web.js...");

    client = new Client({
        authStrategy: new LocalAuth({ dataPath: 'whatsapp-auth' }),
        puppeteer: { 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu'] 
        }
    });

    client.on('qr', (qr) => {
        console.log("=========================================");
        console.log("📷 ¡ESCÁNEAME! CÓDIGO QR DE WHATSAPP");
        console.log("Abre WhatsApp en el celular -> Dispositivos Vinculados -> Vincular un Dispositivo");
        console.log("=========================================");
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        isReady = true;
        console.log('✅ Cliente de WhatsApp (Valhalla Bot) ¡Está Listo y Conectado!');
    });

    client.on('auth_failure', msg => {
        console.error('❌ Fallo de autenticación en WhatsApp:', msg);
    });

    client.on('disconnected', (reason) => {
        console.log('⚠️ Cliente WhatsApp desconectado:', reason);
        isReady = false;
        // Intentar reconectar o limpiar sesión
    });

    client.on('message', async msg => {
        // Evitar responder a mensajes de grupos o estados
        if (msg.from === 'status@broadcast' || msg.from.includes('@g.us')) return;

        console.log(`📩 Mensaje entrante de ${msg.from}: ${msg.body}`);

        try {
            if (!aiModel) {
                // Modo fallback si no hay clave de Gemini
                await msg.reply("¡Hola! Soy el asistente automático de Valhalla Grooming House. Estamos configurando el cerebro IA en este momento, pronto te atenderé. Mientras tanto, tu mensaje ha sido guardado.");
                return;
            }

            // ChatBot Inteligente procesando con Gemini
            const prompt = `${SYSTEM_PROMPT}\n\nMensaje del cliente: "${msg.body}"\n\nRespuesta del Asistente Valhalla:`;
            
            // Simular que está "escribiendo..."
            const chat = await msg.getChat();
            await chat.sendStateTyping();

            const result = await aiModel.generateContent(prompt);
            const responseText = result.response.text();
            
            await msg.reply(responseText);

        } catch (error) {
            console.error("Error en ChatBot IA:", error);
            await msg.reply("Lo siento, mis circuitos cerebrales creados por el gran José Miguel se están recargando, inténtalo en un momento.");
        }
    });

    client.initialize();
}

/**
 * Función para enviar notificaciones salientes (ej. cuando se crea una cita)
 * @param {string} phone Número de teléfono (se espera formato limpio sin '+', ej. 5068888888)
 * @param {string} message Texto a enviar
 */
async function sendNotification(phone, message) {
    if (!isReady || !client) {
        console.log("⚠️ WhatsApp no está listo para enviar notificaciones. Inténtalo más tarde.");
        return { success: false, error: "not_ready" };
    }

    try {
        // En WhatsApp los números tienen que tener el sufijo @c.us
        // Por defecto asumiremos código de país de Costa Rica (506) si viene de 8 dígitos
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length === 8) {
            cleanPhone = '506' + cleanPhone; 
        }
        
        const chatId = `${cleanPhone}@c.us`;
        await client.sendMessage(chatId, message);
        console.log(`✅ Notificación WhatsApp enviada al ${cleanPhone}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Error enviando notificación por WhatsApp:", error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    initializeWhatsApp,
    sendNotification
};
