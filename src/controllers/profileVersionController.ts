import { RequestHandler } from "express";
import prisma from "../config/prisma";

export const getProfileVersionByJourney: RequestHandler = async (req, res, next) => {
  try {
    const journeyId = Number(req.params.journeyId);
    if (!Number.isFinite(journeyId)) {
      res.status(400).json({ success: false, message: "Invalid journeyId" });
      return;
    }
    const v = await prisma.userProfileVersion.findUnique({ where: { journeyId } });
    if (!v) {
      res.status(404).json({ success: false, message: "No profile version for this journey" });
      return;
    }
    res.status(200).json({ success: true, data: v });
  } catch (e) { next(e); }
};

export const listProfileVersionsByUser: RequestHandler = async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ success: false, message: "Invalid userId" });
      return;
    }
    const list = await prisma.userProfileVersion.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.status(200).json({ success: true, data: list });
  } catch (e) { next(e); }
};
