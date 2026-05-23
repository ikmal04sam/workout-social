import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import './db';
import authRoutes from './routes/auth';
import exerciseRoutes from './routes/exercises';
import workoutRoutes from './routes/workouts';
import socialRoutes from './routes/social';
import outdoorRoutes from './routes/outdoor';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Workout Social API is running!' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/outdoor', outdoorRoutes);

export { app };
