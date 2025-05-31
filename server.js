
const express = require("express");
const cors = require("cors");
const connect = require("./connect");
const users = require("./userRoutes");
const posts = require("./postRoutes"); 
const games = require("./gameRoutes"); 

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 
const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'https://arise-backend-m9zz.onrender.com', 'https://games-grid.netlify.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};


app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));


app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use(users);
app.use(games); 
app.use(posts)


app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});


app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});


app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// Start server
app.listen(PORT, () => {
 connect.connectToServer();
  console.log(`Server is running on port: ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});

