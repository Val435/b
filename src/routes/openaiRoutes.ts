import express from "express";
import { getRecommendations } from "../controllers/openaiController";
import { verifyToken } from "../middlewares/verifyToken";

const router = express.Router();

router.post("/recommend", verifyToken, getRecommendations);

export default router;
