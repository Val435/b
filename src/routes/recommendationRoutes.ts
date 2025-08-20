import express from "express";
import {
  fetchRecommendedAreas,
  fetchProperties,
  fetchSchools,
  fetchRaceEthnicity,
  fetchIncomeLevels,
  fetchCrimeData,
  fetchPropertySuggestion,
  fetchFullRecommendation,
} from "../controllers/recommendationController";

const router = express.Router();

router.get("/areas/:userId", fetchRecommendedAreas);
router.get("/properties/:userId", fetchProperties);
router.get("/schools/:userId", fetchSchools);
router.get("/race-ethnicity/:userId", fetchRaceEthnicity);
router.get("/income-levels/:userId", fetchIncomeLevels);
router.get("/crime-data/:userId", fetchCrimeData);
router.get("/property-suggestion/:userId", fetchPropertySuggestion);
router.get("/full/:email", (req, res, next) => {
  fetchFullRecommendation(req, res, next).catch(next);
});

export default router;
// This file defines the routes for fetching recommendations and related data.