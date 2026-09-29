// 1. Load environment variables from .env file at the very top
require('dotenv').config();

// 2. Import required modules
const express = require('express');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const initDb = require('./db/initDb');
const schedulerService = require('./services/schedulerService');

// 3. Create Express application
const app = express();
app.set('trust proxy', 1);

// 4. Use middleware
// Enable CORS for all routes
app.use(cors());
// Parse JSON request bodies
app.use(express.json());
// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Setup session middleware for authentication
app.use(session({
    secret: process.env.SESSION_SECRET || 'vridhi_session_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        httpOnly: true 
    }
}));

// 5. Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// 6. Mount ALL route files
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/survey', require('./routes/survey'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/community', require('./routes/community'));

// 7. Catch-all route to serve the frontend index.html for any unhandled routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 8. Initialize database schema & start server
const PORT = process.env.PORT || 3000;

async function bootstrap() {
    await initDb();
    schedulerService.startScheduler();

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Visit http://localhost:${PORT} in your browser.`);
    });
}

bootstrap().catch(err => {
    console.error('Fatal bootstrap error:', err);
});
