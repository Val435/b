import express from "express";
import { getRecommendations } from "../controllers/openaiController";
import { verifyToken } from "../middlewares/verifyToken";

const router = express.Router();

// Crea Journey + guarda recomendación ligada a ese Journey
router.post("/recommend",  getRecommendations);

export default router;
