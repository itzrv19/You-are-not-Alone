const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.warn("⚠️ MONGO_URI is missing in .env file. Running with IN-MEMORY data only. Chats will not be persisted across server restarts.");
    return false;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected Successfully");
    return true;
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.warn("⚠️ Continuing with IN-MEMORY mode (Please whitelist your IP in MongoDB Atlas!)");
    return false;
  }
};

module.exports = connectDB;
