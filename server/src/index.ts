import cors from "cors";
import express from "express";
import { prisma } from "./db";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/tickets", async (_req, res) => {
  const tickets = await prisma.ticket.findMany({ orderBy: { id: "asc" } });
  res.json(tickets);
});

app.post("/api/tickets", async (req, res) => {
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
