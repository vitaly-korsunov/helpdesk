import { describe, test, expect } from "bun:test";
import { createTicketSchema, updateTicketStatusSchema } from "./ticket";

describe("updateTicketStatusSchema", () => {
  test.each(["open", "resolved", "closed"])("accepts %s", (status) => {
    const result = updateTicketStatusSchema.safeParse({ status });
    expect(result.success).toBe(true);
  });

  test("rejects an unrecognized status", () => {
    const result = updateTicketStatusSchema.safeParse({ status: "archived" });
    expect(result.success).toBe(false);
  });

  test("rejects a missing status", () => {
    const result = updateTicketStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("createTicketSchema", () => {
  test("accepts just a subject, leaving everything else optional", () => {
    const result = createTicketSchema.safeParse({ subject: "Printer is broken" });
    expect(result.success).toBe(true);
  });

  test("rejects an empty subject", () => {
    const result = createTicketSchema.safeParse({ subject: "  " });
    expect(result.success).toBe(false);
  });

  test("accepts a full submission with category, name, and email", () => {
    const result = createTicketSchema.safeParse({
      subject: "Printer is broken",
      category: "BUG",
      requesterName: "Jane Customer",
      requesterEmail: "jane@example.com",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an unrecognized category", () => {
    const result = createTicketSchema.safeParse({
      subject: "Printer is broken",
      category: "URGENT",
    });
    expect(result.success).toBe(false);
  });

  test("treats an empty requesterEmail as not provided", () => {
    const result = createTicketSchema.safeParse({
      subject: "Printer is broken",
      requesterEmail: "",
    });
    expect(result.success).toBe(true);
  });

  test("rejects a malformed, non-empty requesterEmail", () => {
    const result = createTicketSchema.safeParse({
      subject: "Printer is broken",
      requesterEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});
