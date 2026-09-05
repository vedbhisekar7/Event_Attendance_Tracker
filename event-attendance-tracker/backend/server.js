const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');
const participantsRouter = require('./routes/participants');
const attendanceRouter = require('./routes/attendance');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
app.use('/api/participants', participantsRouter);
app.use('/api/attendance', attendanceRouter);

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
    }
});

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
    console.log(`\n🚀 Event Attendance Tracker running at http://localhost:${PORT}\n`);
});