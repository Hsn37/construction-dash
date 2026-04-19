import { Request, Response, NextFunction } from "express";
import config from "../config.js";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.headers["x-auth-token"];

  if (!token || token !== config.AUTH_SECRET) {
    res.status(401).json({ error: "Unauthorized: invalid or missing token" });
    return;
  }

  next();
}
