const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('WhatsApp OTP Bot is Running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Yeh aapke purane index.js ko bhi sath me chalu kar dega
require('./index.js');
