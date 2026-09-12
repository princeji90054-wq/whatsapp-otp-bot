const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode-terminal');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());
app.use(cors());

let sock;

// Yahan apna MongoDB connection string daalein
const mongoUrl = "mongodb+srv://your_connection_string_here";
const dbName = "whatsapp_bot_db";

async function useMongoDBAuthState(db) {
    const coll = db.collection('auth_session');

    const writeData = async (data, id) => {
        const stringified = JSON.stringify(data, (key, value) => 
            value instanceof Buffer ? { type: 'Buffer', data: Array.from(value) } : value
        );
        await coll.updateOne({ _id: id }, { $set: { data: stringified } }, { upsert: true });
    };

    const readData = async (id) => {
        try {
            const result = await coll.findOne({ _id: id });
            if (!result) return null;
            return JSON.parse(result.data, (key, value) => {
                if (value !== null && typeof value === 'object' && value.type === 'Buffer') {
                    return Buffer.from(value.data);
                }
                return value;
            });
        } catch (error) {
            return null;
        }
    };

    const removeData = async (id) => {
        try {
            await coll.deleteOne({ _id: id });
        } catch (error) {}
    };

    const creds = await readData('creds') || {};

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category of Object.keys(data)) {
                        for (const id of Object.keys(data[category])) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(state.creds, 'creds')
    };
}

async function connectToWhatsApp() {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db(dbName);
    console.log('Connected to MongoDB Atlas successfully!');

    const { state, saveCreds } = await useMongoDBAuthState(db);
    
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

module.exports = app;