import { Request, Response, NextFunction, RequestHandler } from "express";
import { fetchRecommendationsFromOpenAI } from "../services/openaiService";
import { saveRecommendation } from "../services/saveRecommendationService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getRecommendations: RequestHandler = async (req, res, next) => {
  try {
    // @ts-ignore - inyectado por verifyToken
    const authUser = req.user as { id?: number; email?: string };
    const userProfile = req.body?.userProfile;

    if (!authUser?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!userProfile) {
      res.status(400).json({ error: "userProfile is required" });
      return;
    }

    // Usuario autenticado
    const user = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user) {
      res.status(404).json({ error: "Auth user not found" });
      return;
    }

    // Crear Journey con snapshot del perfil (puedes ajustar label si quieres)
    const journey = await prisma.journey.create({
      data: {
        userId: user.id,
        label: userProfile.label ?? null,
        selectedState: userProfile.state ?? user.state ?? null,
        selectedCities: Array.isArray(userProfile.city)
          ? userProfile.city
          : (user.city ?? []),
        inputs: userProfile, // guardamos el perfil usado como snapshot
        index: 0,
        status: "RUNNING",
      },
      select: { id: true },
    });

    try {
      // 1) pedir a OpenAI
      const reco = await fetchRecommendationsFromOpenAI(userProfile);

      // 2) guardar Recommendation SIEMPRE ligada al journey.id
      const saved = await saveRecommendation(reco, user.id, journey.id);

      // 3) marcar journey COMPLETED
      await prisma.journey.update({
        where: { id: journey.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      res.status(200).json({
        message: "Recommendation saved",
        data: saved,
        journeyId: journey.id,
      });
    } catch (inner) {
      // si falla OpenAI o el guardado, cancelar el journey
      await prisma.journey.update({
        where: { id: journey.id },
        data: { status: "CANCELLED" },
      });
      throw inner;
    }
  } catch (error) {
    next(error);
  }
};
