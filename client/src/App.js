import React, { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import "./App.css";
import logo from "./logo.png";

// Use environment variable for production, fallback to localhost for development
const SERVER_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";

const Header = () => (
  <div className="app-header">
    <img src={logo} alt="logo" className="logo" />
    <div className="brand">
      <h1>You Are <span>Not Alone</span></h1>
    </div>
  </div>
);

// --- SCREEN: LOGIN ---
function LoginScreen({ email, setEmail }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!email || !email.includes("@")) return alert("Please enter a valid email address.");
    
    setLoading(true);

    try {
      const res = await fetch(`${SERVER_URL}/api/send-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      
      if (data.success) {
        setLoading(false);
        navigate("/otp");
      } else {
        alert(data.error);
        setLoading(false);
      }
    } catch (err) { 
      console.error(err);
      setLoading(false);
      alert("Error sending Email. " + err.message); 
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box glass">
        <Header />
        <h2>Welcome Back</h2>
        <p>Enter your email address to receive a secure code.</p>
        <input 
          id="email"
          name="email"
          autoComplete="email"
          type="email" placeholder="you@example.com" 
          value={email} onChange={e => setEmail(e.target.value)} 
        />

        <button className="primary-btn" onClick={sendOtp} disabled={loading}>
          {loading ? "Sending..." : "Send Code"}
        </button>
      </div>
    </div>
  );
}

// --- SCREEN: OTP ---
function OtpScreen({ email, setToken }) {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email) navigate("/login");
  }, [email, navigate]);

  const verifyOtp = async () => {
    if (!otp) return;
    setLoading(true);

    try {
      const res = await fetch(`${SERVER_URL}/api/verify-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      
      if (data.success) {
        setToken(data.token);
        navigate("/profile");
      } else {
        alert(data.error);
        setLoading(false);
      }
    } catch (err) { 
      console.error(err);
      alert("Invalid code or server error."); 
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box glass">
        <Header />
        <h2>Verify Email</h2>
        <p>We've sent a 6-digit code to {email}</p>
        <input 
          id="otp"
          name="otp"
          autoComplete="one-time-code"
          type="text" placeholder="6-digit Code" 
          value={otp} onChange={e => setOtp(e.target.value)} 
        />
        <button className="primary-btn" onClick={verifyOtp} disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </button>
      </div>
    </div>
  );
}

// --- SCREEN: PROFILE ---
function ProfileScreen({ token, codename, setCodename }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  const setProfile = async () => {
    if (!codename) return alert("Enter a codename");
    try {
      const res = await fetch(`${SERVER_URL}/api/set-profile`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, codename }),
      });
      const data = await res.json();
      if (data.success) {
        navigate("/app");
      } else alert(data.error);
    } catch (err) { alert("Server error"); }
  };

  return (
    <div className="auth-container">
      <div className="auth-box glass">
        <Header />
        <h2>Choose a Codename</h2>
        <p>This is how others will know you.</p>
        <input 
          id="codename"
          name="codename"
          type="text" placeholder="E.g. LoneWolf99" 
          value={codename} onChange={e => setCodename(e.target.value)} 
        />
        <button className="primary-btn" onClick={setProfile}>Enter Sanctuary</button>
      </div>
    </div>
  );
}

// --- SCREEN: MAIN APP ---
function MainApp({ token, codename }) {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  const [appView, setAppView] = useState("questions");
  const [users, setUsers] = useState([]);
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState("");
  const [partnerCodename, setPartnerCodename] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [incomingReq, setIncomingReq] = useState(null);
  const [isBanned, setIsBanned] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const [form, setForm] = useState({
    mood: "", language: "", style: "", talkType: "",
  });

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    const newSocket = io(SERVER_URL, {
      auth: { token }
    });
    socketRef.current = newSocket;

    newSocket.on("usersList", (list) => setUsers(list));

    newSocket.on("chatStart", (data) => {
      setAppView("chat");
      setChat([]);
      setPartnerCodename(data.partnerCodename);
      setShowSidebar(false);
    });

    newSocket.on("message", (m) => {
      setChat((prev) => [...prev, { text: m, sender: "other" }]);
    });

    newSocket.on("partnerLeft", () => {
      setChat((prev) => [...prev, { text: "Partner left the chat.", sender: "system" }]);
      setPartnerCodename(null);
    });

    newSocket.on("incomingRequest", (reqData) => setIncomingReq(reqData));

    newSocket.on("requestDeclined", (name) => alert(`${name} declined your request.`));

    newSocket.on("banned", () => setIsBanned(true));

    return () => newSocket.disconnect();
  }, [token, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  if (isBanned) {
    return (
      <div className="auth-container">
        <div className="auth-box glass">
          <Header />
          <h2 style={{color: "red"}}>Account Banned</h2>
          <p>Your account has been permanently suspended due to reports of abusive behavior.</p>
        </div>
      </div>
    );
  }

  const handleFindSomeone = () => {
    socketRef.current.emit("startMatching", form);
    setAppView("waiting");
    setShowSidebar(false);
  };

  const handleStartDirectChat = (userId) => {
    socketRef.current.emit("connectionRequest", userId);
    alert("Request sent! Waiting for them to accept...");
  };

  const handleAcceptRequest = () => {
    socketRef.current.emit("acceptRequest", incomingReq.fromId);
    setIncomingReq(null);
  };

  const handleDeclineRequest = () => {
    socketRef.current.emit("declineRequest", incomingReq.fromId);
    setIncomingReq(null);
  };

  const handleReportUser = () => {
    if (window.confirm("Are you sure you want to report and block this user for bad behavior?")) {
      socketRef.current.emit("reportUser");
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!msg.trim() || !socketRef.current || !partnerCodename) return;
    socketRef.current.emit("message", msg);
    setChat((prev) => [...prev, { text: msg, sender: "me" }]);
    setMsg("");
  };

  const nextChat = () => {
    socketRef.current.emit("next");
    setAppView("questions");
    setPartnerCodename(null);
    setShowSidebar(true);
  };

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <div className={`sidebar ${showSidebar ? "active" : "hidden"}`}>
        <div className="sidebar-header">
          <div className="my-profile">
            <div className="avatar">{codename ? codename.charAt(0).toUpperCase() : "U"}</div>
            <span className="my-codename">{codename}</span>
          </div>
        </div>
        
        <div className="sidebar-search">
          <input type="text" placeholder="Search or start new chat" />
        </div>

        <div className="user-list">
          <h3 className="section-title">Online Sanctuary</h3>
          {users.length === 0 && <p className="empty-text">No one else is online right now.</p>}
          {users.map((u) => (
            <div key={u.id} className="user-item" onClick={() => handleStartDirectChat(u.id)}>
              <div className="avatar user-avatar">{u.codename.charAt(0).toUpperCase()}</div>
              <div className="user-info">
                <span className="username">{u.codename}</span>
                <span className="status">🟢 Online</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className={`main-area ${!showSidebar ? "active" : "hidden"}`}>
        
        {incomingReq && (
          <div className="request-modal-overlay">
            <div className="request-modal glass">
              <h3>Incoming Request</h3>
              <p><strong>{incomingReq.codename}</strong> wants to connect with you.</p>
              <div className="request-actions">
                <button className="primary-btn" onClick={handleAcceptRequest}>Accept</button>
                <button className="danger-btn" onClick={handleDeclineRequest}>Decline</button>
              </div>
            </div>
          </div>
        )}

        {appView === "questions" && (
          <div className="welcome-screen">
             <button className="back-btn mobile-only" onClick={() => setShowSidebar(true)}>← Back to Users</button>
             <div className="glass panel">
               <img src={logo} alt="logo" className="large-logo" />
               <h2>How are you feeling today?</h2>
               <div className="form-grid">
                  <select onChange={(e) => setForm({ ...form, mood: e.target.value })}>
                    <option value="">Mood</option>
                    <option>Happy</option>
                    <option>Sad</option>
                    <option>Stressed</option>
                  </select>
                  <select onChange={(e) => setForm({ ...form, language: e.target.value })}>
                    <option value="">Language</option>
                    <option>English</option>
                    <option>Hindi</option>
                  </select>
                  <select onChange={(e) => setForm({ ...form, style: e.target.value })}>
                    <option value="">Style</option>
                    <option>Casual</option>
                    <option>Deep</option>
                  </select>
                  <select onChange={(e) => setForm({ ...form, talkType: e.target.value })}>
                    <option value="">Talk Type</option>
                    <option>Listener</option>
                    <option>Talker</option>
                  </select>
               </div>
               <button className="primary-btn pulse" onClick={handleFindSomeone}>Find a Match</button>
             </div>
          </div>
        )}

        {appView === "waiting" && (
          <div className="welcome-screen">
            <div className="loader"></div>
            <h2>Looking for someone...</h2>
            <p className="subtitle">Finding the right connection based on your mood.</p>
          </div>
        )}

        {appView === "chat" && (
          <div className="chat-interface">
            <div className="chat-header">
              <button className="back-btn mobile-only" onClick={() => setShowSidebar(true)}>←</button>
              <div className="avatar partner-avatar">
                {partnerCodename ? partnerCodename.charAt(0).toUpperCase() : "?"}
              </div>
              <div className="chat-header-info">
                <h3>{partnerCodename || "Disconnected"}</h3>
                <span>{partnerCodename ? "online" : "offline"}</span>
              </div>
              {partnerCodename && (
                <button className="danger-btn" onClick={handleReportUser} style={{marginRight: "10px", background: "#f59e0b"}}>
                  Report 🚨
                </button>
              )}
              <button className="danger-btn" onClick={nextChat}>Leave</button>
            </div>

            <div className="chat-body">
              {chat.map((c, i) => (
                <div key={i} className={`msg-wrapper ${c.sender}`}>
                  <div className={`msg-bubble ${c.sender}`}>
                    {c.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form className="chat-footer" onSubmit={sendMessage}>
              <div className="emoji-container">
                <button 
                  type="button" 
                  className="emoji-btn"
                  onClick={() => setShowEmoji(!showEmoji)}
                  disabled={!partnerCodename}
                >
                  😊
                </button>
                {showEmoji && (
                  <div className="emoji-picker-wrapper">
                    <EmojiPicker 
                      theme="dark" 
                      onEmojiClick={(emojiData) => {
                        setMsg((prev) => prev + emojiData.emoji);
                        setShowEmoji(false);
                      }} 
                    />
                  </div>
                )}
              </div>
              <input 
                id="message"
                name="message"
                type="text" 
                placeholder="Type a message" 
                value={msg} 
                onChange={e => setMsg(e.target.value)}
                disabled={!partnerCodename}
              />
              <button type="submit" disabled={!partnerCodename || !msg.trim()}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path>
                </svg>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// --- ROOT APP ---
function App() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(null);
  const [codename, setCodename] = useState("");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginScreen email={email} setEmail={setEmail} />} />
        <Route path="/otp" element={<OtpScreen email={email} setToken={setToken} />} />
        <Route path="/profile" element={<ProfileScreen token={token} codename={codename} setCodename={setCodename} />} />
        <Route path="/app" element={<MainApp token={token} codename={codename} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;