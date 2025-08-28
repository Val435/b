import { RequestHandler } from "express";
import prisma from "../config/prisma";
import { fetchRecommendationsFromOpenAI } from "../services/openaiService";
import { saveRecommendation } from "../services/saveRecommendationService";

export const createJourney: RequestHandler = async (req, res, next) => {
  try {
    // @ts-ignore
    const authUser = req.user as { id?: number; email?: string };
    const { label, selectedState, selectedCities = [], inputs } = req.body || {};

    if (!authUser?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

    const journey = await prisma.journey.create({
      data: {
        userId: authUser.id,
        label: label ?? null,
        selectedState: selectedState ?? null,
        selectedCities: Array.isArray(selectedCities) ? selectedCities : [],
        inputs: inputs ?? null,
        index: 0,
      },
    });

    res.status(201).json({ journey });
  } catch (err) { next(err); }
};

export const runJourney: RequestHandler = async (req, res, next) => {
  try {
    // @ts-ignore
    const authUser = req.user as { id?: number };
    const journeyId = Number(req.params.id);
    if (!authUser?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!Number.isFinite(journeyId)) { res.status(400).json({ error: "Invalid journey id" }); return; }

    const journey = await prisma.journey.findUnique({ where: { id: journeyId } });
    if (!journey || journey.userId !== authUser.id) { res.status(404).json({ error: "Journey not found" }); return; }

    const running = await prisma.journey.findFirst({ where: { userId: authUser.id, status: "RUNNING" } });
    if (running && running.id !== journey.id) { res.status(409).json({ error: "Another journey is running for this user" }); return; }

    await prisma.journey.update({ where: { id: journey.id }, data: { status: "RUNNING" } });

    const user = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const baseProfile: any = { ...user };
    const inputs = (journey.inputs as any) || {};
    const userProfile = {
      ...baseProfile,
      state: journey.selectedState ?? baseProfile.state ?? null,
      city: (journey.selectedCities && journey.selectedCities.length > 0) ? journey.selectedCities : (baseProfile.city ?? []),
      ...inputs,
    };

    try {
      const reco = await fetchRecommendationsFromOpenAI(userProfile);
      const saved = await saveRecommendation(reco, authUser.id!, journey.id);
      await prisma.journey.update({ where: { id: journey.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      res.status(200).json({ message: "Journey completed", recommendationId: saved.id });
    } catch (inner) {
      await prisma.journey.update({ where: { id: journey.id }, data: { status: "CANCELLED" } });
      throw inner;
    }
  } catch (err) { next(err); }
};

export const listJourneys: RequestHandler = async (req, res, next) => {
  try {
    // @ts-ignore
    const authUser = req.user as { id?: number };
    if (!authUser?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

    const journeys = await prisma.journey.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: "desc" },
      include: { recommendation: { select: { id: true, createdAt: true } } },
    });

    res.json({ journeys });
  } catch (err) { next(err); }
};

export const getJourney: RequestHandler = async (req, res, next) => {
  try {
    // @ts-ignore
    const authUser = req.user as { id?: number };
    const journeyId = Number(req.params.id);
    if (!authUser?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!Number.isFinite(journeyId)) { res.status(400).json({ error: "Invalid journey id" }); return; }

    const journey = await prisma.journey.findFirst({
      where: { id: journeyId, userId: authUser.id },
      include: { recommendation: { select: { id: true, createdAt: true } } },
    });
    if (!journey) { res.status(404).json({ error: "Journey not found" }); return; }

    res.json({ journey });
  } catch (err) { next(err); }
};
