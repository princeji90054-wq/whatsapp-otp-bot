const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('Scan this QR code:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp successfully connected and ready!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Android App se OTP bhejne ke liye API Route
app.post('/send-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        
        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: 'Phone number and OTP are required' });
        }

        // WhatsApp number format theek karna (jaise 919876543210@s.whatsapp.net)
        const recipient = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
        const message = `Aapka OTP code hai: *${otp}*`;

        await sock.sendMessage(recipient, { text: message });

        res.status(200).json({ success: true, message: 'OTP sent successfully!' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ success: false, message: 'Failed to send OTP', error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('WhatsApp OTP Bot API is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    connectToWhatsApp();
});
