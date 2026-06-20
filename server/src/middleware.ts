import { type NextFunction, type Request, type Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";
import { Role } from "../generated/prisma/enums";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!roles.includes(session.user.role as Role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
