import { describe, test, expect, mock, beforeEach } from "bun:test";

interface FakeTicket {
  id: number;
  subject: string;
  status: string;
  requesterName: string | null;
  requesterEmail: string | null;
}

interface FakeTicketMessage {
  id: number;
  ticketId: number;
  fromEmail: string;
  body: string;
  messageId: string | null;
}

let tickets: FakeTicket[] = [];
let ticketMessages: FakeTicketMessage[] = [];
let nextTicketId = 1;
let nextMessageId = 1;

const mockPrisma = {
  ticketMessage: {
    findUnique: mock(async ({ where }: { where: { messageId: string } }) =>
      ticketMessages.find((m) => m.messageId === where.messageId) ?? null,
    ),
    findFirst: mock(async ({ where }: { where: { messageId: { in: string[] } } }) =>
      ticketMessages
        .filter((m) => m.messageId && where.messageId.in.includes(m.messageId))
        .sort((a, b) => b.id - a.id)[0] ?? null,
    ),
    create: mock(
      async ({
        data,
      }: {
        data: { ticketId: number; fromEmail: string; body: string; messageId?: string };
      }) => {
        const message: FakeTicketMessage = {
          id: nextMessageId++,
          ticketId: data.ticketId,
          fromEmail: data.fromEmail,
          body: data.body,
          messageId: data.messageId ?? null,
        };
        ticketMessages.push(message);
        return message;
      },
    ),
  },
  ticket: {
    findMany: mock(
      async ({ where }: { where: { requesterEmail: string; status: { notIn: string[] } } }) =>
        tickets.filter(
          (t) =>
            t.requesterEmail === where.requesterEmail && !where.status.notIn.includes(t.status),
        ),
    ),
    update: mock(async ({ where, data }: { where: { id: number }; data: { status: string } }) => {
      const ticket = tickets.find((t) => t.id === where.id);
      if (!ticket) throw new Error("ticket not found");
      Object.assign(ticket, data);
      return ticket;
    }),
    create: mock(
      async ({
        data,
      }: {
        data: {
          subject: string;
          status: string;
          requesterEmail: string;
          requesterName?: string;
        };
      }) => {
        const ticket: FakeTicket = { id: nextTicketId++, requesterName: null, ...data };
        tickets.push(ticket);
        return ticket;
      },
    ),
  },
  $transaction: mock(async (arg: unknown) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
  }),
};

mock.module("./db", () => ({ prisma: mockPrisma }));

const { ingestInboundEmail, normalizeSubject } = await import("./inboundEmail");

beforeEach(() => {
  tickets = [];
  ticketMessages = [];
  nextTicketId = 1;
  nextMessageId = 1;
});

describe("normalizeSubject", () => {
  test("strips a single Re: prefix", () => {
    expect(normalizeSubject("Re: Printer is broken")).toBe("printer is broken");
  });

  test("strips stacked, case-insensitive Re:/Fwd: prefixes", () => {
    expect(normalizeSubject("FW: re: Fwd: Printer is broken")).toBe("printer is broken");
  });

  test("leaves a subject with no prefix unchanged aside from case/trim", () => {
    expect(normalizeSubject("  Printer Is Broken  ")).toBe("printer is broken");
  });
});

describe("ingestInboundEmail", () => {
  test("creates a new ticket when nothing matches", async () => {
    const result = await ingestInboundEmail({
      from: "customer@example.com",
      subject: "Printer is broken",
      text: "It won't turn on.",
    });

    expect(result).toEqual({ ticketId: 1, threaded: false, deduplicated: false });
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      subject: "Printer is broken",
      status: "open",
      requesterEmail: "customer@example.com",
    });
    expect(ticketMessages).toHaveLength(1);
    expect(ticketMessages[0]).toMatchObject({ ticketId: 1, fromEmail: "customer@example.com" });
  });

  test("stores the sender's name on the new ticket when provided", async () => {
    const result = await ingestInboundEmail({
      from: "customer@example.com",
      fromName: "Jane Customer",
      subject: "Printer is broken",
      text: "It won't turn on.",
    });

    expect(tickets[0]).toMatchObject({ id: result.ticketId, requesterName: "Jane Customer" });
  });

  test("threads onto an existing ticket via inReplyTo", async () => {
    tickets.push({ id: 1, subject: "Printer is broken", status: "open", requesterName: null, requesterEmail: "customer@example.com" });
    ticketMessages.push({ id: 1, ticketId: 1, fromEmail: "customer@example.com", body: "It won't turn on.", messageId: "<orig@mail>" });

    const result = await ingestInboundEmail({
      from: "customer@example.com",
      subject: "Re: Printer is broken",
      text: "Any update?",
      inReplyTo: "<orig@mail>",
    });

    expect(result).toEqual({ ticketId: 1, threaded: true, deduplicated: false });
    expect(tickets).toHaveLength(1);
    expect(ticketMessages).toHaveLength(2);
  });

  test("threads onto an existing ticket via the references array", async () => {
    tickets.push({ id: 1, subject: "Printer is broken", status: "open", requesterName: null, requesterEmail: "customer@example.com" });
    ticketMessages.push({ id: 1, ticketId: 1, fromEmail: "customer@example.com", body: "It won't turn on.", messageId: "<orig@mail>" });

    const result = await ingestInboundEmail({
      from: "customer@example.com",
      subject: "Re: Printer is broken",
      text: "Any update?",
      references: ["<some-other@mail>", "<orig@mail>"],
    });

    expect(result).toEqual({ ticketId: 1, threaded: true, deduplicated: false });
  });

  test("reopens a closed ticket when a reply references it", async () => {
    tickets.push({ id: 1, subject: "Printer is broken", status: "closed", requesterName: null, requesterEmail: "customer@example.com" });
    ticketMessages.push({ id: 1, ticketId: 1, fromEmail: "customer@example.com", body: "It won't turn on.", messageId: "<orig@mail>" });

    await ingestInboundEmail({
      from: "customer@example.com",
      subject: "Re: Printer is broken",
      text: "It broke again!",
      inReplyTo: "<orig@mail>",
    });

    expect(tickets[0].status).toBe("open");
  });

  test("falls back to subject + sender matching when there are no reference headers", async () => {
    tickets.push({ id: 1, subject: "Printer is broken", status: "open", requesterName: null, requesterEmail: "customer@example.com" });

    const result = await ingestInboundEmail({
      from: "customer@example.com",
      subject: "Re: Printer is broken",
      text: "Any update?",
    });

    expect(result).toEqual({ ticketId: 1, threaded: true, deduplicated: false });
  });

  test("subject fallback ignores closed tickets and creates a new one instead", async () => {
    tickets.push({ id: 1, subject: "Printer is broken", status: "closed", requesterName: null, requesterEmail: "customer@example.com" });

    const result = await ingestInboundEmail({
      from: "customer@example.com",
      subject: "Re: Printer is broken",
      text: "It's broken again.",
    });

    expect(result.threaded).toBe(false);
    expect(tickets).toHaveLength(2);
  });

  test("subject fallback ignores resolved tickets and creates a new one instead", async () => {
    tickets.push({ id: 1, subject: "Printer is broken", status: "resolved", requesterName: null, requesterEmail: "customer@example.com" });

    const result = await ingestInboundEmail({
      from: "customer@example.com",
      subject: "Re: Printer is broken",
      text: "It's broken again.",
    });

    expect(result.threaded).toBe(false);
    expect(tickets).toHaveLength(2);
  });

  test("subject fallback does not match a different sender", async () => {
    tickets.push({ id: 1, subject: "Printer is broken", status: "open", requesterName: null, requesterEmail: "someone-else@example.com" });

    const result = await ingestInboundEmail({
      from: "customer@example.com",
      subject: "Re: Printer is broken",
      text: "Any update?",
    });

    expect(result.threaded).toBe(false);
    expect(tickets).toHaveLength(2);
  });

  test("deduplicates a replayed messageId without creating anything new", async () => {
    tickets.push({ id: 1, subject: "Printer is broken", status: "open", requesterName: null, requesterEmail: "customer@example.com" });
    ticketMessages.push({ id: 1, ticketId: 1, fromEmail: "customer@example.com", body: "It won't turn on.", messageId: "<dup@mail>" });

    const result = await ingestInboundEmail({
      from: "customer@example.com",
      subject: "Printer is broken",
      text: "It won't turn on.",
      messageId: "<dup@mail>",
    });

    expect(result).toEqual({ ticketId: 1, threaded: false, deduplicated: true });
    expect(ticketMessages).toHaveLength(1);
  });
});
