import express from "express";
import { verifyToken } from "../middlewares/verifyToken";
import {
  createJourney,
  runJourney,
  listJourneys,
  getJourney,
} from "../controllers/journeyController";

const router = express.Router();

router.use(verifyToken);

router.post("/", createJourney);

router.post("/:id/run", runJourney);

router.get("/", listJourneys);

router.get("/:id", getJourney);

export default router;
