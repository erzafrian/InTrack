const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const errorHandler = require('./middleware/error');

const authRoutes = require('./routes/auth.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const logbookRoutes = require('./routes/logbook.routes');
const plannerRoutes = require('./routes/planner.routes');
const usersRoutes = require('./routes/users.routes');
const adminRoutes = require('./routes/admin.routes');
const googleRoutes = require('./routes/google.routes');
const faceRoutes = require('./routes/face.routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/logbook', logbookRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/face', faceRoutes);

// Error handler
app.use(errorHandler);

module.exports = app;
