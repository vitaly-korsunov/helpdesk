import { describe, test, expect } from "bun:test";
import { createUserSchema, updateUserSchema } from "./user";

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

describe("updateUserSchema", () => {
  test("accepts an empty password as 'leave unchanged'", () => {
    const result = updateUserSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "",
    });
  });

  test("accepts a whitespace-only password as 'leave unchanged'", () => {
    const result = updateUserSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "   ",
    });

    expect(result.success).toBe(true);
    expect(result.data?.password).toBe("");
  });

  test("accepts a valid replacement password and trims it", () => {
    const result = updateUserSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "  password123  ",
    });

    expect(result.success).toBe(true);
    expect(result.data?.password).toBe("password123");
  });

  test("rejects a replacement password shorter than 8 characters", () => {
    const result = updateUserSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "short1",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Password must be at least 8 characters");
  });

  test("rejects a name shorter than 3 characters", () => {
    const result = updateUserSchema.safeParse({
      name: "ab",
      email: "jane@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Name must be at least 3 characters");
  });

  test("rejects a malformed email", () => {
    const result = updateUserSchema.safeParse({
      name: "Jane Doe",
      email: "not-an-email",
      password: "",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Enter a valid email");
  });
});
