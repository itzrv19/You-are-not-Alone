const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  text: String,
  createdAt: { type: Date, default: Date.now, expires: 86400 } // TTL Index: Expires in 24 hours (86400 seconds)
});

module.exports = mongoose.model("Message", MessageSchema);
