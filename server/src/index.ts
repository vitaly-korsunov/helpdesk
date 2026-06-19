import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { prisma } from "./db";

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
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
