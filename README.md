# You Are Not Alone - Anonymous Chat Platform

**You Are Not Alone** is a modern, full-stack anonymous chat application designed to provide a safe "sanctuary" for people to connect, share feelings, and find support without revealing their real identities.

## 🚀 Live Demo
- **Frontend:** [https://feeling-alone.vercel.app](https://feeling-alone.vercel.app)
- **Backend API:** [https://feeling-alone.onrender.com](https://feeling-alone.onrender.com)

## ✨ Features

### 🔐 Secure Authentication
- **Persistent Accounts:** Users can create an account with a unique codename and password.
- **Email OTP Verification:** 100% free email verification system using a Google Apps Script HTTP relay to bypass cloud provider SMTP blocks.
- **Password Reset:** Secure password recovery flow using Email OTP.

### 🎭 Anonymous Interaction
- **Codenames:** No real names or profile pictures. Every user is identified by a unique chosen codename.
- **Gender-Based Matching:** Find a match based on your preference (Male, Female, or Anyone).
- **Ephemeral Chats:** Chat history is wiped from the screen upon disconnection to ensure privacy.

### 🤝 Social Features
- **Friend Requests:** Found someone you connect with? Send them a friend request after the chat ends!
- **Recent Contacts:** The app remembers your last 10 conversations locally, allowing you to send requests even after leaving the chat.
- **Private Reconnection:** Once a request is accepted, both users are instantly placed in a private room.

### 🛡️ Safety & Quality
- **Profanity Filter:** Built-in Hindi/English bad-words filter for a cleaner experience.
- **Report System:** One-click reporting to ban abusive users instantly.
- **Strict Session Management:** Only one active session allowed per account—logging in elsewhere automatically terminates old connections.

## 🛠️ Technology Stack

### Frontend
- **React.js:** Single Page Application (SPA) architecture.
- **Socket.io-client:** Real-time, bidirectional communication.
- **CSS3:** Custom Vanilla CSS for a premium, responsive "Dark Mode" aesthetic.
- **Emoji-Picker-React:** For expressive anonymous communication.

### Backend
- **Node.js & Express:** Scalable backend API.
- **Socket.io:** Real-time event handling and matching engine.
- **Mongoose (MongoDB Atlas):** Persistent data storage for users and friend requests.
- **JWT (JSON Web Tokens):** Secure, stateless session management.
- **Bcrypt.js:** Industry-standard password hashing.

## ⚙️ How it Works

1. **The Handshake:** When a user logs in, the server generates a JWT. This token is used to authenticate the Socket.io connection.
2. **Matching Engine:** Users join a "waiting room" with their gender preferences. The server iterates through waiting users and pairs them if their criteria match (e.g., Male seeking Female).
3. **HTTP Email Relay:** To avoid the SMTP blocking common on free cloud tiers (like Render), the server sends a POST request to a Google Apps Script Web App, which then sends the OTP via the Google Mail API.
4. **Persistent State:** User profiles and pending requests are stored in MongoDB, while active chat sessions are managed in-memory for maximum speed.

## 🛠️ Local Setup

1. **Clone the repo:**
   ```bash
   git clone https://github.com/itzrv19/You-are-not-Alone.git
   ```

2. **Backend Setup:**
   ```bash
   cd server
   npm install
   # Create a .env file with:
   # MONGO_URI=your_mongodb_uri
   # GOOGLE_SCRIPT_URL=your_google_script_url
   # JWT_SECRET=your_secret
   npm start
   ```

3. **Frontend Setup:**
   ```bash
   cd client
   npm install
   npm start
   ```

## 🔒 Security Note
This repository includes a `.gitignore` to ensure that sensitive environment variables (`.env`) are never pushed to GitHub. Always use environment secrets on hosting platforms like Render or Vercel.

---
*Created with ❤️ to help people feel a little less alone.*
