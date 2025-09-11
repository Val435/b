import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import { errorHandler } from './middlewares/errorHandler'; 
import openaiRoutes from './routes/openaiRoutes';
import recommendationRoutes from './routes/recommendationRoutes';
import journeyRoutes from './routes/journeyRoutes';
import profileVersionRoutes from './routes/profileVersionRoutes';

import { loadCities } from "./services/cityService";
import cityRoutes from "./routes/cityRoutes";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/openai', openaiRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use('/api/journeys', journeyRoutes);
app.use("/api/user/profile-versions", profileVersionRoutes);
app.use("/api", cityRoutes);

app.get('/api/ping', (_req, res) => {
  res.json({ message: 'pong' });
});

loadCities();

// ⚠️ siempre al final
app.use(errorHandler); 

export default app;
