import cors from "cors";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { prisma } from "./db";
import { requireAuth, requireRole } from "./middleware";
import { Role } from "../generated/prisma/enums";

const clientUrl = process.env.CLIENT_URL;
if (!clientUrl) {
  throw new Error("CLIENT_URL must be set in the environment");
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

app.get("/api/users", requireRole(Role.ADMIN), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });
  res.json(users);
});

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
