const express = require("express");
const database = require("./connect");
const { ObjectId } = require("mongodb");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require("dotenv").config({path: "./config.env"});

// Create router instance
let userRoutes = express.Router();

const SALT_ROUNDS = 10;

// Get all users (protected route)
userRoutes.route("/users").get( async (request, response) => {
  try {
    let db = database.getDb();
    let data = await db.collection("users").find({}).project({ password: 0 }).toArray();

    if (data.length > 0) {
      response.json({ success: true, data });
    } else {
      response.status(404).json({ success: false, message: "No users found" });
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    response.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get single user by ID (protected route)
userRoutes.route("/users/:id").get( async (request, response) => {
  try {
    let db = database.getDb();
    let data = await db.collection("users").findOne(
      { _id: new ObjectId(request.params.id) },
      { projection: { password: 0 } }
    );

    if (data) {
      response.json({ success: true, data });
    } else {
      response.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    response.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Create new user (Sign Up)
userRoutes.route("/users").post(async (request, response) => {
  try {
    let db = database.getDb();
    
    // Validation
    const { name, email, password } = request.body;
    
    if (!name || !email || !password) {
      return response.status(400).json({ 
        success: false, 
        message: "Name, email, and password are required" 
      });
    }

    if (password.length < 6) {
      return response.status(400).json({ 
        success: false, 
        message: "Password must be at least 6 characters long" 
      });
    }

    // Check if email already exists
    const existingUser = await db.collection("users").findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      return response.status(409).json({ 
        success: false, 
        message: "Email already exists" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user object
    let mongoObject = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      joinDate: new Date()
    };

    let result = await db.collection("users").insertOne(mongoObject);

    response.status(201).json({ 
      success: true, 
      message: "User created successfully",
      userId: result.insertedId
    });

  } catch (error) {
    console.error('Error creating user:', error);
    response.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

// Update user
userRoutes.route("/users/:id").put(async (request, response) => {
  try {
    let db = database.getDb();
    
    const updateData = {};
    if (request.body.name) updateData.name = request.body.name.trim();
    if (request.body.email) updateData.email = request.body.email.toLowerCase().trim();
    if (request.body.password) {
      updateData.password = await bcrypt.hash(request.body.password, SALT_ROUNDS);
    }

    let mongoObject = { $set: updateData };
    
    let result = await db.collection("users").updateOne(
      { _id: new ObjectId(request.params.id) }, 
      mongoObject
    );

    if (result.matchedCount === 0) {
      return response.status(404).json({ success: false, message: "User not found" });
    }

    response.json({ 
      success: true, 
      message: "User updated successfully",
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Error updating user:', error);
    response.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Delete user
userRoutes.route("/users/:id").delete(async (request, response) => {
  try {
    let db = database.getDb();
    let result = await db.collection("users").deleteOne({ _id: new ObjectId(request.params.id) });

    if (result.deletedCount === 0) {
      return response.status(404).json({ success: false, message: "User not found" });
    }

    response.json({ 
      success: true, 
      message: "User deleted successfully" 
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    response.status(500).json({ success: false, message: "Internal server error" });
  }
});

// User login
// Update the login route
userRoutes.route("/users/login").post(async (request, response) => {
  try {
    console.log('Login attempt started');
    console.log('Request body:', request.body);
    
    let db = database.getDb();
    console.log('Database connection obtained');
    
    const { email, password } = request.body;
    
    if (!email || !password) {
      console.log('Missing email or password');
      return response.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
    }

    console.log('Searching for user with email:', email.toLowerCase().trim());
    const user = await db.collection("users").findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      console.log('User not found');
      return response.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    console.log('User found, comparing passwords');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log('Password validation failed');
      return response.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    console.log('Password valid, generating JWT token');
    
    // Check if SECRETKEY exists
    if (!process.env.SECRETKEY) {
      console.error('SECRETKEY environment variable is not set');
      return response.status(500).json({ 
        success: false, 
        message: "Server configuration error" 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        name: user.name
      },
      process.env.SECRETKEY,
      { expiresIn: '24h' }
    );

    console.log('JWT token generated successfully');

    // Return success with user data AND token
    response.json({ 
      success: true, 
      message: "Login successful",
      token: token, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        joinDate: user.joinDate
      }
    });

  } catch (error) {
    console.error('Detailed login error:', error);
    console.error('Error stack:', error.stack);
    
    // More specific error responses
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      response.status(500).json({ 
        success: false, 
        message: "Database connection error" 
      });
    } else if (error.name === 'JsonWebTokenError') {
      response.status(500).json({ 
        success: false, 
        message: "Token generation error" 
      });
    } else {
      response.status(500).json({ 
        success: false, 
        message: "Internal server error",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});
<<<<<<< HEAD
module.exports = userRoutes;
=======


module.exports = userRoutes;
>>>>>>> b5a17a860446347e956d771db112e46510caa887
