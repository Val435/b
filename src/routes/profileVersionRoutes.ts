import express from "express";
import { verifyToken } from "../middlewares/verifyToken";
import {
  getProfileVersionByJourney,
  listProfileVersionsByUser,
} from "../controllers/profileVersionController";

const router = express.Router();

// Protegido con JWT como el resto de rutas internas
router.use(verifyToken);

// GET /api/user/profile-versions/by-journey/:journeyId
router.get("/by-journey/:journeyId", getProfileVersionByJourney);

// GET /api/user/profile-versions/by-user/:userId
router.get("/by-user/:userId", listProfileVersionsByUser);

export default router;
