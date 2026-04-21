import { Request, Response, NextFunction } from "express";
import config from "../config.js";

export type UserRole = "admin" | "viewer";

declare global {
  namespace Express {
    interface Request {
      userRole?: UserRole;
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.headers["x-auth-token"] as string | undefined;

  if (!token) {
    res.status(401).json({ error: "Unauthorized: missing token" });
    return;
  }

  if (token === config.AUTH_SECRET) {
    req.userRole = "admin";
    next();
    return;
  }

  if (config.VIEW_TOKEN && token === config.VIEW_TOKEN) {
    req.userRole = "viewer";
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized: invalid token" });
}

export function adminOnly(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }
  next();
}
