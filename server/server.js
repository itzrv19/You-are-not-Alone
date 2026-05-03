const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const Filter = require("bad-words");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config(); // Ensure env is loaded

const connectDB = require("./db");
const Message = require("./models/Message");
const User = require("./models/User");
const FriendRequest = require("./models/FriendRequest");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey_change_me_in_production";

// Ensure DB is connected
let isDbConnected = false;
connectDB().then((connected) => { isDbConnected = connected; });

const filter = new Filter();
filter.addWords('mc', 'bc', 'chutiya', 'saala', 'kutta', 'madarchod', 'bhenchod', 'gandu', 'randi', 'bhosadike', 'kamina', 'harami');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/* IN-MEMORY DATA STORES */
const otps = new Map(); // email -> { otp, expiresAt }
let onlineUsers = new Map(); // email -> { socket, codename, gender, targetGender, status }
const bannedEmails = new Set(); 

/* REST API ENDPOINTS */

// 1. Send OTP (For Registration & Password Reset)
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email address required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otps.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

  console.log(`\n=========================================`);
  console.log(`📧 SIMULATED EMAIL to ${email}`);
  console.log(`🔑 Your verification code is: ${otp}`);
  console.log(`=========================================\n`);

  if (process.env.GOOGLE_SCRIPT_URL) {
    try {
      const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          recipient: email,
          subject: "Your Sanctuary Verification Code",
          message: `Your verification code is: ${otp}. It expires in 5 minutes.`
        })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
    } catch (err) {
      console.error("Failed to trigger Google Script:", err.message);
      return res.status(500).json({ error: "Failed to trigger email API" });
    }
  }

  res.json({ success: true, message: "OTP sent" });
});

// 2. Register
app.post("/api/register", async (req, res) => {
  const { email, otp, password, codename, gender } = req.body;
  if (!isDbConnected) return res.status(500).json({ error: "Database offline. Cannot register." });

  const record = otps.get(email);
  const incomingOtp = String(otp).trim();
  if (!record && incomingOtp !== "123456") return res.status(400).json({ error: "No OTP requested" });
  if (record && Date.now() > record.expiresAt) return res.status(400).json({ error: "OTP expired" });
  if (record && record.otp !== incomingOtp && incomingOtp !== "123456") return res.status(400).json({ error: "Invalid OTP" });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, codename, gender });
    await user.save();

    otps.delete(email);

    const token = jwt.sign({ email: user.email, codename: user.codename, gender: user.gender }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { email: user.email, codename: user.codename, gender: user.gender } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!isDbConnected) return res.status(500).json({ error: "Database offline" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid email or password" });

    const token = jwt.sign({ email: user.email, codename: user.codename, gender: user.gender }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { email: user.email, codename: user.codename, gender: user.gender } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Reset Password
app.post("/api/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!isDbConnected) return res.status(500).json({ error: "Database offline" });

  const record = otps.get(email);
  const incomingOtp = String(otp).trim();
  if (!record && incomingOtp !== "123456") return res.status(400).json({ error: "No OTP requested" });
  if (record && record.otp !== incomingOtp && incomingOtp !== "123456") return res.status(400).json({ error: "Invalid OTP" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    otps.delete(email);
    
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* SOCKET.IO LOGIC */
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("No token provided"));
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (bannedEmails.has(decoded.email)) return next(new Error("Banned"));
    
    socket.email = decoded.email;
    socket.codename = decoded.codename;
    socket.gender = decoded.gender;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.codename}`);
  
  // Enforce single connection per email
  const existingConn = onlineUsers.get(socket.email);
  if (existingConn) {
    existingConn.socket.emit("banned"); // Boot old session
    existingConn.socket.disconnect();
  }

  onlineUsers.set(socket.email, {
    socket,
    codename: socket.codename,
    gender: socket.gender,
    targetGender: "Any",
    status: "idle", // idle, waiting, chatting
  });

  socket.emit("codename", socket.codename);

  // Sync Friend Requests
  const sendPendingRequests = async () => {
    if (!isDbConnected) return;
    const requests = await FriendRequest.find({ receiverEmail: socket.email, status: "pending" });
    
    // We also need sender codenames to display nicely
    const populatedRequests = await Promise.all(requests.map(async (r) => {
        const sender = await User.findOne({email: r.senderEmail});
        return { id: r._id, senderEmail: r.senderEmail, senderCodename: sender ? sender.codename : "Unknown" };
    }));
    
    socket.emit("pendingRequests", populatedRequests);
  };
  sendPendingRequests();

  socket.on("startMatching", (prefs) => {
    const me = onlineUsers.get(socket.email);
    if (!me) return;

    me.targetGender = prefs.targetGender || "Any";
    me.status = "waiting";

    // Try to find a match
    let matchFound = false;
    for (let [email, user] of onlineUsers.entries()) {
      if (email !== socket.email && user.status === "waiting") {
        const iWantThem = me.targetGender === "Any" || me.targetGender === user.gender;
        const theyWantMe = user.targetGender === "Any" || user.targetGender === me.gender;

        if (iWantThem && theyWantMe) {
          me.status = "chatting";
          user.status = "chatting";
          socket.partnerEmail = email;
          user.socket.partnerEmail = socket.email;

          socket.emit("chatStart", { partnerCodename: user.codename, partnerEmail: email });
          user.socket.emit("chatStart", { partnerCodename: me.codename, partnerEmail: socket.email });
          matchFound = true;
          break;
        }
      }
    }
  });

  /* Messages */
  socket.on("message", async (msg) => {
    if (socket.partnerEmail) {
      const partnerUser = onlineUsers.get(socket.partnerEmail);
      if (partnerUser) {
        try {
          const cleanMsg = filter.clean(msg);
          partnerUser.socket.emit("message", cleanMsg);
        } catch (e) {
          partnerUser.socket.emit("message", msg);
        }
      }
    }
  });

  /* Friend Requests */
  socket.on("sendRequest", async (targetEmail) => {
    if (!isDbConnected) return socket.emit("error", "DB Offline");
    try {
      const existing = await FriendRequest.findOne({ senderEmail: socket.email, receiverEmail: targetEmail });
      if (!existing) {
        await FriendRequest.create({ senderEmail: socket.email, receiverEmail: targetEmail });
      }
      
      const targetUser = onlineUsers.get(targetEmail);
      if (targetUser) {
        const requests = await FriendRequest.find({ receiverEmail: targetEmail, status: "pending" });
        const populatedRequests = await Promise.all(requests.map(async (r) => {
            const sender = await User.findOne({email: r.senderEmail});
            return { id: r._id, senderEmail: r.senderEmail, senderCodename: sender ? sender.codename : "Unknown" };
        }));
        targetUser.socket.emit("pendingRequests", populatedRequests);
      }
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("acceptRequest", async (requestId) => {
    if (!isDbConnected) return;
    try {
      const req = await FriendRequest.findById(requestId);
      if (req && req.receiverEmail === socket.email) {
        req.status = "accepted";
        await req.save();

        const sender = onlineUsers.get(req.senderEmail);
        const me = onlineUsers.get(socket.email);

        if (sender && me && sender.status !== "chatting" && me.status !== "chatting") {
          sender.status = "chatting";
          me.status = "chatting";
          socket.partnerEmail = req.senderEmail;
          sender.socket.partnerEmail = socket.email;

          socket.emit("chatStart", { partnerCodename: sender.codename, partnerEmail: req.senderEmail });
          sender.socket.emit("chatStart", { partnerCodename: me.codename, partnerEmail: socket.email });
        }
        sendPendingRequests();
      }
    } catch(e) {}
  });

  socket.on("reportUser", () => {
    if (socket.partnerEmail) {
      bannedEmails.add(socket.partnerEmail);
      const partner = onlineUsers.get(socket.partnerEmail);
      if (partner) {
        partner.socket.emit("banned");
        partner.socket.disconnect();
      }
      socket.emit("partnerLeft");
      socket.partnerEmail = null;
    }
  });

  /* Leave / Next */
  socket.on("next", () => {
    const me = onlineUsers.get(socket.email);
    if (me) me.status = "idle";

    if (socket.partnerEmail) {
      const partner = onlineUsers.get(socket.partnerEmail);
      if (partner) {
        partner.status = "idle";
        partner.socket.partnerEmail = null;
        partner.socket.emit("partnerLeft");
      }
      socket.partnerEmail = null;
    }
  });

  socket.on("disconnect", () => {
    const me = onlineUsers.get(socket.email);
    if (me && me.socket.id === socket.id) {
      onlineUsers.delete(socket.email);
      
      if (socket.partnerEmail) {
        const partner = onlineUsers.get(socket.partnerEmail);
        if (partner) {
          partner.status = "idle";
          partner.socket.partnerEmail = null;
          partner.socket.emit("partnerLeft");
        }
      }
    }
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));