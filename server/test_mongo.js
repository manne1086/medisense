
require('dotenv').config();
const mongoose = require('mongoose');

console.log("Testing MongoDB Connection...");
console.log("URI:", process.env.MONGO_URI ? "Found (Hidden for security)" : "NOT FOUND");

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB Connection Successful!");
        console.log("Closing connection...");
        mongoose.connection.close();
    })
    .catch(err => {
        console.error("❌ MongoDB Connection Failed:");
        console.error(err);
        process.exit(1);
    });
