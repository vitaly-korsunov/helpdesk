import cors from "cors";
import express from "express";
import { createUserSchema } from "core";
import { toNodeHandler } from "better-auth/node";
import { hashPassword } from "better-auth/crypto";
import { auth } from "./auth";
import { prisma } from "./db";
import { requireAuth, requireRole } from "./middleware";
import { Role } from "../generated/prisma/enums";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerified: true,
  createdAt: true,
} as const;

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
    select: userSelect,
    orderBy: { name: "asc" },
  });
  res.json(users);
});

app.post("/api/users", requireRole(Role.ADMIN), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "A user with this email already exists" });
  }

  const userId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { id: userId, name, email, emailVerified: true, role: Role.AGENT },
      select: userSelect,
    });
    await tx.account.create({
      data: {
        id: crypto.randomUUID(),
        providerId: "credential",
        accountId: userId,
        userId,
        password: hashedPassword,
      },
    });
    return created;
  });

  res.status(201).json(user);
});

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
