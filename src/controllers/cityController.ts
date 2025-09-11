import { Request, Response, RequestHandler } from "express";
import { searchCities } from "../services/cityService";

export const getCities: RequestHandler = (req: Request, res: Response) => {
  const { state_id, query, limit } = req.query;

  if (!state_id || !query) {
    res.status(400).json({
      error: "Faltan parámetros.",
    });
    return;
  }

  const results = searchCities(
    state_id as string,
    query as string,
    limit ? parseInt(limit as string, 10) : 5
  );

  res.json(results);
};