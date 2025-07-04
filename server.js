require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const socketIO = require('socket.io');

// Local modules
const passportConfig = require('./middleware/passportConfig');
const authRoutes = require('./routes/auth');
const conferenceRoutes = require('./routes/conference');
const participantRoutes = require('./routes/participants');
const notificationRoutes = require('./routes/notifications');

// Initialize app & server
const app = express();
app.set('trust proxy', 1); // ✅ Trust Heroku/Render proxy to preserve cookies

const server = http.createServer(app);

// ==========================
// 🔐 MIDDLEWARE SETUP
// ==========================

// 1. Enable CORS with credentials
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));


// 2. Parse JSON and cookies
app.use(express.json());
app.use(cookieParser());


// 🔁 Shared session middleware
const sessionMiddleware = session({
  name: "connect.sid",
  secret: process.env.SESSION_SECRET || "yourFallbackSecret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: "none"
  }
});

app.use(sessionMiddleware); // ✅ use for Express



// 4. Passport initialization
app.use(passport.initialize());
app.use(passport.session());
passportConfig(passport); // Setup passport strategies

// ==========================
// 🔁 ROUTES
// ==========================
app.use('/api/auth', authRoutes);
app.use('/api/conference', conferenceRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/notifications', notificationRoutes);

// ==========================
// 📡 SOCKET.IO HANDLING
// ==========================
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL, // ✅ Your frontend origin (don't use '*')
    methods: ["GET", "POST"],
    credentials: true               // ✅ Allow cookies
  }
});

const rooms = {};
const participantNames = {}; // socket.id -> { name, roomId }

const lockedRooms = new Set(); // 🔒 Keeps track of locked rooms
const allowedParticipants = {}; // roomId => Set of allowed participant emails


const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);


io.use(wrap(sessionMiddleware)); // ✅ use the same instance as Express


// Apply Passport to Socket.IO
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

// Utility to get authenticated user info from a socket ID
function getUserBySocket(socketId) {
  const targetSocket = io.sockets.sockets.get(socketId);
  if (!targetSocket || !targetSocket.request || !targetSocket.request.user) {
    return null;
  }
  return targetSocket.request.user;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  /*socket.on("join-room", ({ roomId }) => {
    console.log("User info on join-room:", socket.request.user);
    const user = socket.request.user;
    
    if (!user) {
      socket.disconnect();
      return;
    }
   */

    socket.on("join-room", async ({ roomId }) => {
      console.log("User info on join-room:", socket.request.user);
      const user = socket.request.user;
    
      if (!user) {
        socket.disconnect();
        return;
      }
    
      const email = user.email;
      const name = user.name || "Anonymous";
    
      // Ensure MySQL connection
      const db = require('./db');
    
      try {
        const [existing] = await db.query(
          "SELECT id FROM participants WHERE conference_id = ? AND email = ?",
          [roomId, email]
        );
    
        if (existing.length === 0) {
          await db.query(
            "INSERT INTO participants (conference_id, email, name) VALUES (?, ?, ?)",
            [roomId, email, name]
          );
          console.log(`📝 Auto-added ${email} to participants for conference ${roomId}`);
        } else {
          console.log(`ℹ️ ${email} already exists in participants for conference ${roomId}`);
        }
      } catch (err) {
        console.error("❌ DB error when inserting participant:", err);
      }
    
      // ...your existing join logic continues here
    





    // ✅ Allow host to bypass locked room
    const isHost = user.role === "host";
    // ✅ If room is locked and not host
    if (lockedRooms.has(roomId) && !isHost) {
    // Check if this user was already allowed earlier
    const allowed = allowedParticipants[roomId]?.has(name);
      if (!allowed) {
        socket.emit("room-locked");
        return;
      }
    }

    //const name = user.email; // Declare `name` here
    console.log(`User ${name} joined room ${roomId}`); // ✅ Now it's safe
  
    socket.join(roomId);
  
    if (!rooms[roomId]) rooms[roomId] = [];
    if (!allowedParticipants[roomId]) allowedParticipants[roomId] = new Set();

    // Save to allowed list (even if room isn't locked yet)
    allowedParticipants[roomId].add(name)

    // Prevent duplicate joins by same user (email)
    const isAlreadyJoined = rooms[roomId].some(
      id => participantNames[id]?.name === name
    );

    if (!isAlreadyJoined) {
      rooms[roomId].push(socket.id);
    }
 
    participantNames[socket.id] = { name, roomId };
  
    // Notify this client of other participants
    const everyone = rooms[roomId].map(id => ({
      id,
      name: participantNames[id]?.name || "Anonymous"
    }));

    //socket.emit("room-participants", everyone); // ✅ includes all
    io.to(roomId).emit("room-participants", everyone);

    // Notify others that this participant joined
    io.to(roomId).emit("participant-joined", {
      id: socket.id,
      name,
      all: rooms[roomId].map(id => ({
      id,
      name: participantNames[id]?.name || "Anonymous"
    }))
  });
});
  
  
socket.on("admin-kick", (targetId) => {
  const user = socket.request.user;

  if (!user || user.role !== "host") {
    console.warn("❌ Unauthorized kick attempt by", socket.id);
    return;
  }

  console.log(`✅ Host ${user.email} is kicking ${targetId}`);
  io.to(targetId).emit("kick");
});

socket.on("admin-mute", (targetSocketId) => {
  const user = socket.request.user;

  if (!user || user.role !== "host") {
    console.warn("❌ Unauthorized mute attempt by", socket.id);
    return;
  }

  console.log(`✅ Host ${user.email} is muting ${targetSocketId}`);
  const target = io.sockets.sockets.get(targetSocketId);
  if (target) {
    target.emit("mute");
  }
});


  // WebRTC signaling
  socket.on('offer', ({ roomId, target, offer }) => {
    console.log(`🎯 Host sent offer to ${target} in room ${roomId}`);
    io.to(target).emit('offer', {
      from: socket.id,
      offer
    });
  });
  
  
  

  socket.on('answer', ({ roomId, target, answer }) => {
    io.to(target).emit('answer', {
      from: socket.id,
      answer
    });
  });+
  
  

  socket.on('ice-candidate', ({ roomId, target, candidate }) => {
    io.to(target).emit('ice-candidate', {
      from: socket.id,
      candidate
    });
  });
  
socket.on("chat-message", (data) => {
  const senderName = socket.request.user?.name || socket.request.user?.email.split("@")[0];
  socket.to(data.roomId).emit("chat-message", {
    sender: senderName,
    message: data.message,
    fileData: data.fileData || null,
    fileName: data.fileName || "",
    fileType: data.fileType || ""
  });
});

socket.on("raise-hand", () => {
  const user = participantNames[socket.id];
  if (user) {
    io.to(user.roomId).emit("user-raised-hand", user.name); // ✅ send only name
  }
});

socket.on("start-call", ({ roomId }) => {
    const user = socket.request.user;
    if (!user || user.role !== "host") return;
  
    io.to(roomId).emit("call-started");
  });
  
  socket.on("end-call", ({ roomId }) => {
    io.to(roomId).emit("call-ended");
  });
  

socket.on("lock-conference", () => {
  const user = socket.request.user;
  const roomId = participantNames[socket.id]?.roomId;

  if (!user || user.role !== "host" || !roomId) {
    console.warn("❌ Unauthorized lock attempt by", socket.id);
    return;
  }

  lockedRooms.add(roomId);
  console.log(`🔒 Room ${roomId} locked by ${user.email}`);
  io.to(roomId).emit("conference-locked");
});


socket.on("end-call-for-all", () => {
  const user = socket.request.user;
  const roomId = participantNames[socket.id]?.roomId;

  if (!user || user.role !== "host" || !roomId) {
    console.warn("❌ Unauthorized attempt to end call by", socket.id);
    return;
  }

  console.log(`📞 Call ended for all in room ${roomId} by ${user.email}`);
  io.to(roomId).emit("call-ended");
});


  // Handle disconnect
  socket.on("disconnect", () => {
    const userInfo = participantNames[socket.id];
    if (userInfo) {
      const { roomId } = userInfo;
      rooms[roomId] = rooms[roomId]?.filter(id => id !== socket.id);
      delete participantNames[socket.id];

      io.to(roomId).emit("participant-left", {
        id: socket.id,
        all: rooms[roomId]?.map(id => ({
          id,
          name: participantNames[id]?.name || "Anonymous"
        }))
      });
    }

    console.log('User disconnected:', socket.id);
  });
});

// ==========================
// 🚀 START SERVER
// ==========================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
