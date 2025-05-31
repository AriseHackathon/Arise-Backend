const jwt = require('jsonwebtoken');
require("dotenv").config({path: "./config.env"});

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  jwt.verify(token, process.env.SECRETKEY, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expired' 
        });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid token' 
        });
      } else {
        return res.status(403).json({ 
          success: false, 
          message: 'Token verification failed' 
        });
      }
    }

    req.user = user; // Add user info to request object
    next();
  });
};

// Optional: Middleware to check if user exists in database
const authenticateUser = async (req, res, next) => {
  try {
    const database = require("./connect");
    const { ObjectId } = require("mongodb");
    
    let db = database.getDb();
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(req.user.userId) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    req.dbUser = user; // Add full user data to request
    next();
  } catch (error) {
    console.error('User authentication error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
};

module.exports = {
  authenticateToken,
  authenticateUser
};