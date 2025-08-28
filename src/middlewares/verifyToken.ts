// middlewares/verifyToken.ts
import { RequestHandler } from "express";
import { verify } from "jsonwebtoken";
// ... tus imports

export const verifyToken: RequestHandler = (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

    // verifica token → set req.user
    const payload = verify(token, process.env.JWT_SECRET!);
    // @ts-ignore
    req.user = payload;
    next();
  } catch (e) {
    res.status(401).json({ error: "Unauthorized" });
  }
};
