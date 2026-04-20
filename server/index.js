require('dotenv').config();
console.log("Starting backend server... (v2)");
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User');
const MedicalRecord = require('./models/MedicalRecord');
const auth = require('./middleware/auth');
const analyzeRoutes = require('./routes/analyze');
const groqRoutes = require('./routes/groqProxy');
const ttsRoutes = require('./routes/tts');

const app = express();

// Middleware
app.use(express.json({ limit: '20mb' }));
// Enhanced CORS configuration for better compatibility
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(passport.initialize());

// Routes - pass auth middleware to analyze routes
app.use('/api/analyze', (req, res, next) => {
  // Make auth available to analyze routes
  req.auth = auth;
  next();
}, analyzeRoutes);
app.use('/api/groq', groqRoutes);
app.use('/api/tts', ttsRoutes);

// MongoDB Connection
const PORT = process.env.PORT || 5000;

// Connection Events
mongoose.connection.on('connected', () => console.log('Mongoose connected to DB Cluster'));
mongoose.connection.on('error', (err) => console.error('Mongoose connection error:', err));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

// Start server immediately without waiting for MongoDB
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Connect to MongoDB in the background
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000, // 5-second timeout
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
})
  .then(() => {
    console.log('MongoDB Connected');
  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    console.warn('⚠️  Server running without MongoDB - database operations will fail');
  });

// Passport Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'dummy',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy',
  callbackURL: "/auth/google/callback"
},
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log("Google Strategy Callback Started");
      let user = await User.findOne({ email: profile.emails[0].value });
      if (user) {
        console.log("User found, updating...");
        user.googleId = profile.id;
        user.avatar = profile.photos[0].value;
        await user.save();
      } else {
        console.log("Creating new user...");
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          avatar: profile.photos[0].value
        });
      }
      console.log("User processed successfully");
      return done(null, user);
    } catch (err) {
      console.error("Google Strategy Error:", err);
      return done(err, null);
    }
  }
));

// Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    console.log("Auth Callback Reached");
    try {
      // Generate token with 30-day expiration for better UX
      const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      console.log("Token generated (30-day expiration), redirecting...");
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth-success?token=${token}`);
    } catch (error) {
      console.error("Callback Error:", error);
      res.status(500).send("Authentication Error");
    }
  }
);

// Medical Records Routes

// Health check endpoint - verify auth is working
app.get('/api/health', auth, async (req, res) => {
  try {
    console.log('[GET /api/health] User authenticated:', req.user._id, 'Email:', req.user.email);
    res.send({ 
      status: 'ok', 
      user: { id: req.user._id, email: req.user.email },
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
  } catch (e) {
    console.error('[GET /api/health] Error:', e);
    res.status(500).send({ error: 'Health check failed' });
  }
});

// Save a medical record
app.post('/api/records', auth, async (req, res) => {
  try {
    console.log('[POST /api/records] User:', req.user._id);
    console.log('[POST /api/records] Report type:', req.body.type);
    const record = new MedicalRecord({
      ...req.body,
      user: req.user._id
    });
    await record.save();
    console.log('[POST /api/records] Saved record ID:', record._id);
    res.status(201).send(record);
  } catch (e) {
    console.error('[POST /api/records] Error:', e);
    res.status(400).send(e);
  }
});

app.get('/api/records', auth, async (req, res) => {
  try {
    console.log('[GET /api/records] Fetching for user:', req.user._id);
    const records = await MedicalRecord.find({ user: req.user._id }).sort({ date: -1 });
    console.log('[GET /api/records] Found', records.length, 'records');
    res.send(records);
  } catch (e) {
    console.error('[GET /api/records] Error:', e);
    res.status(500).send(e);
  }
});

app.delete('/api/records/:id', auth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const recordId = req.params.id;
    
    // Try to convert to ObjectId, but fallback to string matching
    let query = { user: req.user._id };
    try {
      query._id = mongoose.Types.ObjectId(recordId);
    } catch (e) {
      // If not a valid ObjectId, try matching as string
      query._id = recordId;
    }
    
    const result = await MedicalRecord.deleteOne(query);
    if (result.deletedCount === 0) {
      return res.status(404).send({ error: 'Report not found' });
    }
    res.send({ success: true, message: 'Report deleted' });
  } catch (e) {
    res.status(500).send(e);
  }
});

app.delete('/api/records', auth, async (req, res) => {
  try {
    const result = await MedicalRecord.deleteMany({ user: req.user._id });
    res.send({ success: true, deletedCount: result.deletedCount || 0 });
  } catch (e) {
    res.status(500).send(e);
  }
});

// Server start moved to MongoDB connection block