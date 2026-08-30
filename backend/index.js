const dotenv = require('dotenv');
dotenv.config(); // ← SABSE PEHLE, koi bhi require se pehle

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./config/dbConnect');
const bodyParser = require('body-parser');
const authRoute = require('./routes/authRoute');      // ← twilioService yahan load hota hai
const chatRoute = require('./routes/chatRoute');
const statusRoute = require('./routes/statusRoutes');
const http = require('http');
const initilizeSocket = require('./services/socketService');

const PORT = process.env.PORT || 8000;
const app = express();

const corsOption = {
    origin: process.env.FRONTEND_URL,
    credentials: true,
};

app.use(cors(corsOption));

app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

// Rate Limiting
let rateLimit;
try {
    rateLimit = require('express-rate-limit');
} catch (err) {
    console.warn("[rate-limit] express-rate-limit package not found. Using in-memory fallback rate limiter.");
    rateLimit = (options) => {
        const ipCache = new Map();
        const windowMs = options.windowMs || 15 * 60 * 1000;
        const max = options.max || 100;
        const message = options.message || "Too many requests, please try again later.";

        return (req, res, next) => {
            const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const now = Date.now();
            
            if (!ipCache.has(ip)) {
                ipCache.set(ip, { count: 1, resetTime: now + windowMs });
                return next();
            }

            const data = ipCache.get(ip);
            if (now > data.resetTime) {
                data.count = 1;
                data.resetTime = now + windowMs;
                return next();
            }

            data.count++;
            if (data.count > max) {
                return res.status(429).json({ success: false, message });
            }
            next();
        };
    };
}

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many requests from this IP, please try again after 15 minutes"
});

const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 15,
    message: "Too many login attempts from this IP, please try again after 5 minutes"
});

app.use('/api', apiLimiter);
app.use('/api/auth/send-otp', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);

const server = http.createServer(app);
const io = initilizeSocket(server);

app.use((req, res, next) => {
    req.io = io;
    req.socketUserMap = io.socketUserMap;
    next();
});

const User = require('./models/user');

const ensureAIBotUser = async () => {
    try {
        const aiUser = await User.findOne({ email: "ai@flashchat.com" });
        if (!aiUser) {
            await User.create({
                username: "Flash AI",
                email: "ai@flashchat.com",
                about: "Your AI Chat Assistant. Ask me anything!",
                isVerified: true,
                isOnline: true,
                isAIBot: true,
                profilePicture: "https://robohash.org/flash-ai.png?set=set4",
            });
            console.log("AI Bot user initialized.");
        }
    } catch (err) {
        console.error("Error initializing AI Bot user:", err);
    }
};

connectDB().then(() => {
    ensureAIBotUser();
});

app.use('/api/auth', authRoute);
app.use('/api/chat', chatRoute);
app.use('/api/status', statusRoute);

const userRoute = require('./routes/userRoute');
const contactRoute = require('./routes/contactRoute');
const conversationRoute = require('./routes/conversationRoute');

app.use('/api/users', userRoute);
app.use('/api/contacts', contactRoute);
app.use('/api/conversations', conversationRoute);

// System Health Check Endpoint
const mongoose = require('mongoose');
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const memoryUsage = process.memoryUsage();
    return res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: dbStatus,
        memory: {
            heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
        },
        services: {
            e2ee: 'active (ECDH P-256 / AES-GCM)',
            ai: process.env.GEMINI_API_KEY ? 'gemini-flash' : 'local-fallback',
        }
    });
});

const authMiddleware = require('./middleware/authMiddleware');
const authController = require('./controllers/authController');
app.patch('/api/users/:id/status', authMiddleware, authController.updateUserStatus);

// ✅ server.listen, NOT app.listen — this is the server socket.io is attached to
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});