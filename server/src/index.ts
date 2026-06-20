import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { prisma } from "./db";
import { Role } from "../generated/prisma/enums";

const clientUrl = process.env.CLIENT_URL;
if (!clientUrl) {
  throw new Error("CLIENT_URL must be set in the environment");
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function requireRole(...roles: Role[]) {
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

const app = express();
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/tickets", requireAuth, async (_req, res) => {
  const tickets = await prisma.ticket.findMany({ orderBy: { id: "asc" } });
  res.json(tickets);
});

app.post("/api/tickets", requireAuth, async (req, res) => {
  const ticket = await prisma.ticket.create({
    data: { subject: req.body.subject },
  });
  res.status(201).json(ticket);
});

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

const port = 3001;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
