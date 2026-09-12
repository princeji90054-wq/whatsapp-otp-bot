const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());
app.use(cors());

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) {
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('WhatsApp Bot connected successfully!');
        } else if (connection === 'close') {
            console.log('Connection closed, reconnecting...');
            connectToWhatsApp();
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

connectToWhatsApp();

app.get('/', (req, res) => {
    res.send('WhatsApp OTP Bot API is running!');
});

app.post('/send-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: 'Phone and OTP required' });
        }

        const recipient = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
        const message = `Aapka OTP code hai: *${otp}*`;
        
        await sock.sendMessage(recipient, { text: message });
        res.status(200).json({ success: true, message: 'OTP sent successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});