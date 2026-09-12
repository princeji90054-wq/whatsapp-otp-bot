const app = require('./index.js');
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
