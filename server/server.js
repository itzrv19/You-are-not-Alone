const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const crypto = require("crypto");
const Filter = require("bad-words");
const connectDB = require("./db");
const Message = require("./models/Message");
const nodemailer = require("nodemailer");

// Attempt to connect to DB
let isDbConnected = false;
connectDB().then((connected) => { isDbConnected = connected; });

const filter = new Filter();
// Add common Hindi/Hinglish profanity
filter.addWords('mc', 'bc', 'chutiya', 'saala', 'kutta', 'madarchod', 'bhenchod', 'gandu', 'randi', 'bhosadike', 'kamina', 'harami');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

/* IN-MEMORY DATA STORES */
const otps = new Map(); // email -> { otp, expiresAt }
const sessions = new Map(); // token -> { email, codename }
let users = []; // list of online users: { token, socketId, codename, email }
let waitingUser = null;
const bannedEmails = new Set(); // list of banned emails

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* REST API ENDPOINTS */

// 1. Send Email OTP
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email address required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otps.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

  // Log to console for development testing
  console.log(`\n=========================================`);
  console.log(`📧 SIMULATED EMAIL to ${email}`);
  console.log(`🔑 Your verification code is: ${otp}`);
  console.log(`=========================================\n`);

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      await transporter.sendMail({
        from: `"You Are Not Alone" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your Sanctuary Verification Code",
        text: `Your verification code is: ${otp}. It expires in 5 minutes.`,
      });
    } catch (err) {
      console.error("Failed to send email:", err.message);
      return res.status(500).json({ error: "Failed to send email. Check server configuration." });
    }
  }

  res.json({ success: true, message: "OTP sent successfully" });
});

// 2. Verify Email OTP
app.post("/api/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  
  const record = otps.get(email);
  if (!record) return res.status(400).json({ error: "No OTP requested for this email" });
  if (Date.now() > record.expiresAt) return res.status(400).json({ error: "OTP expired" });
  
  const incomingOtp = String(otp).trim();
  // Bypass code 123456 allowed for dev
  if (record.otp !== incomingOtp && incomingOtp !== "123456") {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  otps.delete(email);

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { email, codename: null });

  res.json({ success: true, token });
});

// 3. Set Codename
app.post("/api/set-profile", (req, res) => {
  const { token, codename } = req.body;
  const session = sessions.get(token);
  
  if (!session) return res.status(401).json({ error: "Invalid session" });
  if (!codename || codename.trim() === "") return res.status(400).json({ error: "Codename required" });

  session.codename = codename.trim();
  res.json({ success: true, codename: session.codename });
});


/* SOCKET.IO REALTIME LOGIC */

// Middleware to authenticate socket connections
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));
  
  const session = sessions.get(token);
  if (!session || !session.codename) return next(new Error("Invalid session or profile incomplete"));

  if (bannedEmails.has(session.email)) {
    return next(new Error("Your account has been banned due to reports."));
  }

  socket.token = token;
  socket.codename = session.codename;
  socket.email = session.email;
  next();
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.codename} (${socket.id})`);

  // Add to online users
  users.push({
    token: socket.token,
    id: socket.id,
    codename: socket.codename,
    socket: socket,
  });

  // Broadcast updated user list (hide actual socket/token info, just send what's needed for UI)
  const broadcastUsers = () => {
    io.emit("usersList", users.map(u => ({
      id: u.id,
      codename: u.codename
    })));
  };
  broadcastUsers();

  socket.emit("codename", socket.codename);

  /* Random Matching */
  socket.on("startMatching", (preferences) => {
    // For MVP, we ignore preferences and just match with waiting user
    if (waitingUser && waitingUser !== socket) {
      socket.partner = waitingUser;
      waitingUser.partner = socket;

      socket.emit("chatStart", { partnerCodename: waitingUser.codename });
      waitingUser.emit("chatStart", { partnerCodename: socket.codename });

      waitingUser = null;
    } else {
      waitingUser = socket;
    }
  });

  /* Connection Requests */
  socket.on("connectionRequest", (targetUserId) => {
    const target = users.find((u) => u.id === targetUserId);
    if (target && target.socket && !target.socket.partner) {
      target.socket.emit("incomingRequest", {
        fromId: socket.id,
        codename: socket.codename
      });
    }
  });

  socket.on("acceptRequest", (fromId) => {
    const requester = users.find((u) => u.id === fromId);
    if (requester && requester.socket && !requester.socket.partner && !socket.partner) {
      socket.partner = requester.socket;
      requester.socket.partner = socket;

      socket.emit("chatStart", { partnerCodename: requester.codename });
      requester.socket.emit("chatStart", { partnerCodename: socket.codename });
    }
  });

  socket.on("declineRequest", (fromId) => {
    const requester = users.find((u) => u.id === fromId);
    if (requester && requester.socket) {
      requester.socket.emit("requestDeclined", socket.codename);
    }
  });

  /* Reporting */
  socket.on("reportUser", () => {
    if (socket.partner) {
      const badEmail = socket.partner.email;
      bannedEmails.add(badEmail); // Ban them
      
      socket.partner.emit("banned");
      socket.partner.disconnect(); // Boot them
      
      // Notify reporter
      socket.emit("partnerLeft");
      socket.partner = null;
    }
  });

  /* Messages */
  socket.on("message", async (msg) => {
    if (socket.partner) {
      try {
        const cleanMsg = filter.clean(msg);
        socket.partner.emit("message", cleanMsg);

        // Save to DB if connected (for 24h retention)
        if (isDbConnected) {
          await Message.create({
            senderId: socket.email, 
            receiverId: socket.partner.email,
            text: cleanMsg
          });
        }
      } catch (e) {
        // Fallback if filter fails for some reason
        socket.partner.emit("message", msg);
      }
    }
  });

  /* Leave Chat */
  socket.on("next", () => {
    if (socket.partner) {
      socket.partner.emit("partnerLeft");
      socket.partner.partner = null;
    }
    socket.partner = null;
  });

  /* Disconnect */
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.codename}`);

    users = users.filter((u) => u.id !== socket.id);
    broadcastUsers();

    if (socket.partner) {
      socket.partner.emit("partnerLeft");
      socket.partner.partner = null;
    }

    if (waitingUser === socket) {
      waitingUser = null;
    }
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));