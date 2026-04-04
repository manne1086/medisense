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
const analyzeRoutes = require('./routes/analyze');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(passport.initialize());

// Routes
app.use('/api/analyze', analyzeRoutes);

// MongoDB Connection
const PORT = process.env.PORT || 5000;

// Connection Events
mongoose.connection.on('connected', () => console.log('Mongoose connected to DB Cluster'));
mongoose.connection.on('error', (err) => console.error('Mongoose connection error:', err));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
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
      const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      console.log("Token generated, redirecting...");
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth-success?token=${token}`);
    } catch (error) {
      console.error("Callback Error:", error);
      res.status(500).send("Authentication Error");
    }
  }
);

// Middleware to verify JWT
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) throw new Error();
    req.user = user;
    next();
  } catch (e) {
    res.status(401).send({ error: 'Please authenticate.' });
  }
};

// Medical Records Routes
app.post('/api/records', auth, async (req, res) => {
  try {
    const record = new MedicalRecord({
      ...req.body,
      user: req.user._id
    });
    await record.save();
    res.status(201).send(record);
  } catch (e) {
    res.status(400).send(e);
  }
});

app.get('/api/records', auth, async (req, res) => {
  try {
    const records = await MedicalRecord.find({ user: req.user._id }).sort({ date: -1 });
    res.send(records);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.delete('/api/records/:id', auth, async (req, res) => {
  try {
    const result = await MedicalRecord.deleteOne({ _id: req.params.id, user: req.user._id });
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
