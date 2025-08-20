import express from "express";
import { getRecommendations } from "../controllers/openaiController";

const router = express.Router();

router.post("/recommend", getRecommendations);

export default router;
