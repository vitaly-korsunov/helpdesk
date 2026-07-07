import { z } from "zod";
import { prisma } from "./db";

export const inboundEmailSchema = z.object({
  from: z.string().min(1, "From is required").email("Enter a valid sender email"),
  fromName: z.string().trim().optional(),
  subject: z.string().trim().min(1, "Subject is required"),
  text: z.string().trim().min(1, "Body is required"),
  messageId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
});

export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;

const REPLY_PREFIX = /^\s*(re|fwd?|fw)\s*:\s*/i;

export function normalizeSubject(subject: string): string {
  let normalized = subject.trim();
  while (REPLY_PREFIX.test(normalized)) {
    normalized = normalized.replace(REPLY_PREFIX, "");
  }
  return normalized.trim().toLowerCase();
}

export interface IngestResult {
  ticketId: number;
  threaded: boolean;
  deduplicated: boolean;
}

export async function ingestInboundEmail(input: InboundEmailInput): Promise<IngestResult> {
  const { from, fromName, subject, text, messageId, inReplyTo, references } = input;

  if (messageId) {
    const existing = await prisma.ticketMessage.findUnique({ where: { messageId } });
    if (existing) {
      return { ticketId: existing.ticketId, threaded: false, deduplicated: true };
    }
  }

  const referenceIds = [inReplyTo, ...(references ?? [])].filter(
    (value): value is string => !!value,
  );

  let ticketId: number | null = null;

  if (referenceIds.length > 0) {
    const matchedMessage = await prisma.ticketMessage.findFirst({
      where: { messageId: { in: referenceIds } },
      orderBy: { id: "desc" },
    });
    if (matchedMessage) {
      ticketId = matchedMessage.ticketId;
    }
  }

  if (ticketId === null) {
    const candidates = await prisma.ticket.findMany({
      where: { requesterEmail: from, status: { notIn: ["closed", "resolved"] } },
      orderBy: { id: "desc" },
    });
    const normalized = normalizeSubject(subject);
    const matchedTicket = candidates.find((ticket) => normalizeSubject(ticket.subject) === normalized);
    if (matchedTicket) {
      ticketId = matchedTicket.id;
    }
  }

  if (ticketId !== null) {
    await prisma.$transaction([
      prisma.ticket.update({ where: { id: ticketId }, data: { status: "open" } }),
      prisma.ticketMessage.create({ data: { ticketId, fromEmail: from, body: text, messageId } }),
    ]);
    return { ticketId, threaded: true, deduplicated: false };
  }

  const created = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.create({
      data: { subject, status: "open", requesterEmail: from, requesterName: fromName },
    });
    await tx.ticketMessage.create({
      data: { ticketId: ticket.id, fromEmail: from, body: text, messageId },
    });
    return ticket;
  });

  return { ticketId: created.id, threaded: false, deduplicated: false };
}
