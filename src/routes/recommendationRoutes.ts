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

// Areas
router.get("/areas/:userId", fetchRecommendedAreas);
router.get("/areas/:userId/:journeyId", fetchRecommendedAreas);

// Properties
router.get("/properties/:userId", fetchProperties);
router.get("/properties/:userId/:journeyId", fetchProperties);

// Schools
router.get("/schools/:userId", fetchSchools);
router.get("/schools/:userId/:journeyId", fetchSchools);

// Demographics
router.get("/race-ethnicity/:userId", fetchRaceEthnicity);
router.get("/race-ethnicity/:userId/:journeyId", fetchRaceEthnicity);
router.get("/income-levels/:userId", fetchIncomeLevels);
router.get("/income-levels/:userId/:journeyId", fetchIncomeLevels);

// Crime data
router.get("/crime-data/:userId", fetchCrimeData);
router.get("/crime-data/:userId/:journeyId", fetchCrimeData);

// Property suggestion
router.get("/property-suggestion/:userId", fetchPropertySuggestion);
router.get(
  "/property-suggestion/:userId/:journeyId",
  fetchPropertySuggestion
);

// Full recommendation by email
router.get("/full/:email", (req, res, next) => {
  fetchFullRecommendation(req, res, next).catch(next);
});
router.get("/full/:email/:journeyId", (req, res, next) => {
  fetchFullRecommendation(req, res, next).catch(next);
});

export default router;
// This file defines the routes for fetching recommendations and related data.
