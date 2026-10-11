const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const commands = require('./commands');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const chatId = msg.key.remoteJid;

        // حصر التشغيل على المجموعات فقط (تجاهل الخاص تماماً)
        if (!chatId.endsWith('@g.us')) return;

        const userName = msg.pushName || 'عضو';

        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || '';

        if (!text.startsWith('.')) return;

        const args = text.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        if (commands[commandName]) {
            await commands[commandName](sock, chatId, msg, args, userName);
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('🔄 إعادة الاتصال...');
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ Phantom-Bot متصل بنجاح وجاهز للعمل في المجموعات فقط!');
        }
    });
}

startBot();