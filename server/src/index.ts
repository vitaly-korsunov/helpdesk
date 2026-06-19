import cors from "cors";
import express from "express";

interface Ticket {
  id: number;
  subject: string;
  status: "open" | "closed";
}

const tickets: Ticket[] = [
  { id: 1, subject: "Cannot reset password", status: "open" },
  { id: 2, subject: "Printer not connecting", status: "closed" },
];

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/tickets", (_req, res) => {
  res.json(tickets);
});

app.post("/api/tickets", (req, res) => {
  const ticket: Ticket = {
    id: tickets.length + 1,
    subject: req.body.subject,
    status: "open",
  };
  tickets.push(ticket);
  res.status(201).json(ticket);
});

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

const port = 3001;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
