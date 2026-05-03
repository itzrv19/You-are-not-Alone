import React, { useEffect, useState, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate, Navigate, Link } from "react-router-dom";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import "./App.css";
import logo from "./logo.png";

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
function LoginScreen({ setToken, setUser }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return alert("Fill all fields");
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        setUser(data.user);
        navigate("/app");
      } else alert(data.error);
    } catch (err) { alert("Server error"); }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <form className="auth-box glass" onSubmit={handleLogin}>
        <Header />
        <h2>Welcome Back</h2>
        <p>Log in to your sanctuary.</p>
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button type="submit" className="primary-btn" disabled={loading}>{loading?"Logging in...":"Login"}</button>
        <div style={{marginTop: 15, display: "flex", justifyContent: "space-between"}}>
          <Link to="/signup" style={{color: "#fff"}}>Create Account</Link>
          <Link to="/forgot-password" style={{color: "#aaa"}}>Forgot Password?</Link>
        </div>
      </form>
    </div>
  );
}

// --- SCREEN: SIGNUP STEP 1 (OTP) ---
function SignupScreen({ setSignupEmail }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) return alert("Valid email required");
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/send-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setSignupEmail(email);
        navigate("/signup-profile");
      } else alert(data.error);
    } catch (err) { alert("Error sending OTP"); }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <form className="auth-box glass" onSubmit={sendOtp}>
        <Header />
        <h2>Create Account</h2>
        <p>Verify your email to continue.</p>
        <input type="email" placeholder="Email Address" value={email} onChange={e=>setEmail(e.target.value)} required />
        <button type="submit" className="primary-btn" disabled={loading}>{loading?"Sending...":"Send Code"}</button>
        <Link to="/login" style={{display:"block", marginTop:15, color:"#fff", textAlign:"center"}}>Back to Login</Link>
      </form>
    </div>
  );
}

// --- SCREEN: SIGNUP STEP 2 (PROFILE) ---
function SignupProfileScreen({ signupEmail, setToken, setUser }) {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [codename, setCodename] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!signupEmail) navigate("/signup"); }, [signupEmail, navigate]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!otp || !password || !codename || !gender) return alert("Fill all fields");
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signupEmail, otp, password, codename, gender }),
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        setUser(data.user);
        navigate("/app");
      } else alert(data.error);
    } catch (err) { alert("Server error"); }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <form className="auth-box glass" onSubmit={handleRegister}>
        <Header />
        <h2>Setup Profile</h2>
        <p>Code sent to {signupEmail}</p>
        <input type="text" placeholder="6-digit Code" value={otp} onChange={e=>setOtp(e.target.value)} required />
        <input type="password" placeholder="Create Password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <input type="text" placeholder="Codename (e.g. LoneWolf)" value={codename} onChange={e=>setCodename(e.target.value)} required />
        <select value={gender} onChange={e=>setGender(e.target.value)} required>
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
        <button type="submit" className="primary-btn" disabled={loading}>{loading?"Registering...":"Complete Registration"}</button>
      </form>
    </div>
  );
}

// --- SCREEN: FORGOT PASSWORD ---
function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const sendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/send-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) setStep(2);
      else alert(data.error);
    } catch (err) { alert("Error sending OTP"); }
    setLoading(false);
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/reset-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Password reset successfully! Please login.");
        navigate("/login");
      } else alert(data.error);
    } catch (err) { alert("Server error"); }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-box glass">
        <Header />
        <h2>Reset Password</h2>
        {step === 1 ? (
          <form onSubmit={sendOtp}>
            <input type="email" placeholder="Email Address" value={email} onChange={e=>setEmail(e.target.value)} required />
            <button type="submit" className="primary-btn" disabled={loading}>{loading?"Sending...":"Send OTP"}</button>
          </form>
        ) : (
          <form onSubmit={resetPassword}>
            <p>Code sent to {email}</p>
            <input type="text" placeholder="6-digit Code" value={otp} onChange={e=>setOtp(e.target.value)} required />
            <input type="password" placeholder="New Password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required />
            <button type="submit" className="primary-btn" disabled={loading}>{loading?"Resetting...":"Reset Password"}</button>
          </form>
        )}
        <Link to="/login" style={{display:"block", marginTop:15, color:"#fff", textAlign:"center"}}>Back to Login</Link>
      </div>
    </div>
  );
}

// --- SCREEN: MAIN APP ---
function MainApp({ token, user, setToken, setUser }) {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);

  const [appView, setAppView] = useState("questions");
  const [chat, setChat] = useState([]);
  const [msg, setMsg] = useState("");
  const [partner, setPartner] = useState(null); // { codename, email }
  const [recentPartners, setRecentPartners] = useState(() => {
    const saved = localStorage.getItem("recentPartners");
    return saved ? JSON.parse(saved) : [];
  });
  const [showEmoji, setShowEmoji] = useState(false);
  const [requests, setRequests] = useState([]);
  const [isBanned, setIsBanned] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  const [form, setForm] = useState({ targetGender: "Any" });

  const addRecentPartner = (codename, email) => {
    setRecentPartners(prev => {
      const filtered = prev.filter(p => p.email !== email);
      const updated = [{ codename, email }, ...filtered].slice(0, 10); // Keep last 10
      localStorage.setItem("recentPartners", JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    if (!token || !user) {
      navigate("/login");
      return;
    }

    const newSocket = io(SERVER_URL, { auth: { token } });
    socketRef.current = newSocket;

    newSocket.on("chatStart", (data) => {
      setAppView("chat");
      setChat([]);
      setPartner({ codename: data.partnerCodename, email: data.partnerEmail });
      addRecentPartner(data.partnerCodename, data.partnerEmail);
      setShowSidebar(false);
    });

    newSocket.on("message", (m) => {
      setChat((prev) => [...prev, { text: m, sender: "other" }]);
    });

    newSocket.on("partnerLeft", () => {
      setChat((prev) => [...prev, { text: "Partner left the chat.", sender: "system" }]);
    });

    newSocket.on("pendingRequests", (reqs) => setRequests(reqs));

    newSocket.on("banned", () => setIsBanned(true));

    return () => newSocket.disconnect();
  }, [token, user, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (!user) return null; // Prevent crash before redirect

  if (isBanned) {
    return (
      <div className="auth-container">
        <div className="auth-box glass">
          <Header />
          <h2 style={{color: "red"}}>Account Banned</h2>
          <p>Your account has been suspended.</p>
        </div>
      </div>
    );
  }

  const handleFindSomeone = () => {
    socketRef.current.emit("startMatching", form);
    setAppView("waiting");
    setShowSidebar(false);
    setPartner(null);
    setChat([]);
  };

  const sendFriendRequest = () => {
    if (partner && partner.email) {
      socketRef.current.emit("sendRequest", partner.email);
      alert("Friend request sent!");
    }
  };

  const acceptRequest = (id) => {
    socketRef.current.emit("acceptRequest", id);
  };

  const handleReportUser = () => {
    if (window.confirm("Report and block this user?")) {
      socketRef.current.emit("reportUser");
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!msg.trim() || !socketRef.current || !partner) return;
    
    // Check if system message exists (partner left), don't allow sending
    if (chat.length > 0 && chat[chat.length-1].sender === "system") {
       return alert("Partner has left. You cannot send messages.");
    }

    socketRef.current.emit("message", msg);
    setChat((prev) => [...prev, { text: msg, sender: "me" }]);
    setMsg("");
  };

  const nextChat = () => {
    socketRef.current.emit("next");
    setAppView("questions");
    setShowSidebar(true);
  };

  const partnerHasLeft = chat.length > 0 && chat[chat.length-1].sender === "system";

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <div className={`sidebar ${showSidebar ? "active" : "hidden"}`}>
        <div className="sidebar-header">
          <div className="my-profile">
            <div className="avatar">{user.codename.charAt(0).toUpperCase()}</div>
            <div style={{display:"flex", flexDirection:"column", alignItems:"flex-start"}}>
              <span className="my-codename">{user.codename}</span>
              <span style={{fontSize:"0.8rem", color:"#aaa"}}>{user.gender}</span>
            </div>
          </div>
          <button className="danger-btn" style={{padding: "5px 10px"}} onClick={handleLogout}>Log Out</button>
        </div>

        <div className="user-list">
          <h3 className="section-title">Friend Requests ({requests.length})</h3>
          {requests.length === 0 && <p className="empty-text">No pending requests.</p>}
          {requests.map((r) => (
            <div key={r.id} className="user-item">
              <div className="avatar user-avatar">{r.senderCodename.charAt(0).toUpperCase()}</div>
              <div className="user-info">
                <span className="username">{r.senderCodename}</span>
                <button className="primary-btn" style={{padding:"5px", fontSize:"0.8rem", marginTop:"5px"}} onClick={() => acceptRequest(r.id)}>
                  Accept & Chat
                </button>
              </div>
            </div>
          ))}

          <h3 className="section-title" style={{marginTop: 15}}>Recent Contacts</h3>
          {recentPartners.length === 0 && <p className="empty-text">No recent chats.</p>}
          {recentPartners.map((rp, i) => (
            <div key={i} className="user-item">
              <div className="avatar user-avatar">{rp.codename.charAt(0).toUpperCase()}</div>
              <div className="user-info">
                <span className="username">{rp.codename}</span>
                <button className="primary-btn" style={{padding:"5px", fontSize:"0.8rem", marginTop:"5px", background:"#005c4b"}} onClick={() => {
                  if (socketRef.current) {
                    socketRef.current.emit("sendRequest", rp.email);
                    alert("Friend request sent to " + rp.codename + "!");
                  }
                }}>
                  Send Friend Request
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN AREA */}
      <div className={`main-area ${!showSidebar ? "active" : "hidden"}`}>
        
        {appView === "questions" && (
          <div className="welcome-screen">
             <button className="back-btn mobile-only" onClick={() => setShowSidebar(true)}>← Sidebar</button>
             <div className="glass panel">
               <img src={logo} alt="logo" className="large-logo" />
               <h2>Ready to connect?</h2>
               <div className="form-grid" style={{gridTemplateColumns:"1fr"}}>
                  <label style={{color:"#fff", textAlign:"left"}}>Who do you want to talk to?</label>
                  <select value={form.targetGender} onChange={(e) => setForm({ ...form, targetGender: e.target.value })}>
                    <option value="Any">Anyone</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
               </div>
               <button className="primary-btn pulse" style={{marginTop: 20}} onClick={handleFindSomeone}>Find a Match</button>
             </div>
          </div>
        )}

        {appView === "waiting" && (
          <div className="welcome-screen">
            <button className="back-btn mobile-only" onClick={nextChat}>← Cancel</button>
            <div className="loader"></div>
            <h2>Looking for someone...</h2>
            <p className="subtitle">Finding a match based on your preferences.</p>
            <button className="danger-btn" onClick={nextChat} style={{marginTop:20}}>Cancel</button>
          </div>
        )}

        {appView === "chat" && (
          <div className="chat-interface">
            <div className="chat-header">
              <button className="back-btn mobile-only" onClick={nextChat}>←</button>
              <div className="avatar partner-avatar">
                {partner ? partner.codename.charAt(0).toUpperCase() : "?"}
              </div>
              <div className="chat-header-info">
                <h3>{partner ? partner.codename : "Chat"}</h3>
                <span>{partnerHasLeft ? "Offline" : "Online"}</span>
              </div>
              
              <div style={{display:"flex", gap:"10px"}}>
                {!partnerHasLeft && (
                  <button className="danger-btn" onClick={handleReportUser} style={{background: "#f59e0b"}}>Report</button>
                )}
                {partnerHasLeft && partner && (
                  <button className="primary-btn" onClick={sendFriendRequest}>Add Friend</button>
                )}
                <button className="danger-btn" onClick={nextChat}>Leave</button>
              </div>
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
                <button type="button" className="emoji-btn" onClick={() => setShowEmoji(!showEmoji)} disabled={partnerHasLeft}>
                  😊
                </button>
                {showEmoji && (
                  <div className="emoji-picker-wrapper">
                    <EmojiPicker theme="dark" onEmojiClick={(emojiData) => {
                        setMsg((prev) => prev + emojiData.emoji);
                        setShowEmoji(false);
                      }} />
                  </div>
                )}
              </div>
              <input type="text" placeholder={partnerHasLeft ? "Partner disconnected..." : "Type a message"} value={msg} onChange={e => setMsg(e.target.value)} disabled={partnerHasLeft} />
              <button type="submit" disabled={partnerHasLeft || !msg.trim()}>
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
  // Initialize state from localStorage so refresh doesn't log you out
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [signupEmail, setSignupEmail] = useState("");

  // Keep localStorage synced
  const handleSetToken = (newToken) => {
    if (newToken) localStorage.setItem("token", newToken);
    else localStorage.removeItem("token");
    setToken(newToken);
  };

  const handleSetUser = (newUser) => {
    if (newUser) localStorage.setItem("user", JSON.stringify(newUser));
    else localStorage.removeItem("user");
    setUser(newUser);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<LoginScreen setToken={handleSetToken} setUser={handleSetUser} />} />
        <Route path="/signup" element={<SignupScreen setSignupEmail={setSignupEmail} />} />
        <Route path="/signup-profile" element={<SignupProfileScreen signupEmail={signupEmail} setToken={handleSetToken} setUser={handleSetUser} />} />
        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
        <Route path="/app" element={<MainApp token={token} user={user} setToken={handleSetToken} setUser={handleSetUser} />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;