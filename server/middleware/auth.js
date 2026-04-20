const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('[auth middleware] ERROR: JWT_SECRET is not configured');
      return res.status(500).send({ error: 'Authentication is not configured on the server.', code: 'AUTH_CONFIG_MISSING' });
    }

    const authHeader = req.header('Authorization');
    console.log('[auth middleware] Authorization header:', authHeader ? 'present' : 'missing');
    
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      console.log('[auth middleware] ERROR: No token provided');
      return res.status(401).send({ error: 'No authentication token provided.', code: 'NO_TOKEN' });
    }

    console.log('[auth middleware] Token received, verifying...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[auth middleware] Token verified, user ID:', decoded.id);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      console.log('[auth middleware] ERROR: User not found in DB for ID:', decoded.id);
      return res.status(401).send({ error: 'Your sign-in session is no longer valid. Please sign in again.', code: 'USER_NOT_FOUND' });
    }
    
    console.log('[auth middleware] User authenticated:', user.email);
    req.user = user;
    next();
  } catch (e) {
    console.error('[auth middleware] ERROR:', e.message);
    if (e.name === 'TokenExpiredError') {
      return res.status(401).send({ error: 'Your sign-in session expired. Please sign in again.', code: 'TOKEN_EXPIRED' });
    }
    if (e.name === 'JsonWebTokenError') {
      return res.status(401).send({ error: 'Your sign-in session is invalid. Please sign in again.', code: 'INVALID_TOKEN' });
    }
    res.status(401).send({ error: 'Authentication failed. Please sign in again.', code: 'AUTH_FAILED' });
  }
};

module.exports = auth;
