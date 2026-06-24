import { describe, test, expect } from "bun:test";
import { createUserSchema } from "./user";

describe("createUserSchema", () => {
  test("accepts a valid input and trims name/password", () => {
    const result = createUserSchema.safeParse({
      name: "  Jane Doe  ",
      email: "jane@example.com",
      password: "  password123  ",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
    });
  });

  test("rejects a name shorter than 3 characters after trimming", () => {
    const result = createUserSchema.safeParse({
      name: "  ab  ",
      email: "jane@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Name must be at least 3 characters");
  });

  test("rejects a missing email", () => {
    const result = createUserSchema.safeParse({
      name: "Jane Doe",
      email: "",
      password: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Email is required");
  });

  test("rejects a malformed email", () => {
    const result = createUserSchema.safeParse({
      name: "Jane Doe",
      email: "not-an-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Enter a valid email");
  });

  test("rejects a password shorter than 8 characters after trimming", () => {
    const result = createUserSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "  short  ",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Password must be at least 8 characters");
  });
});
