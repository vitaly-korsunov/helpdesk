import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { NextFunction, Request, Response } from "express";

let mockSession: { user: { role: string } } | null = null;

mock.module("./auth", () => ({
  auth: {
    api: {
      getSession: mock(async () => mockSession),
    },
  },
}));

const { requireAuth, requireRole } = await import("./middleware");

function mockReq() {
  return { headers: {} } as unknown as Request;
}

function mockRes() {
  const res = {} as Response & { statusCode?: number; body?: unknown };
  res.status = mock((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as Response["status"];
  res.json = mock((body: unknown) => {
    res.body = body;
    return res;
  }) as unknown as Response["json"];
  return res;
}

beforeEach(() => {
  mockSession = null;
});

describe("requireAuth", () => {
  test("responds 401 when there is no session", async () => {
    const res = mockRes();
    const next = mock() as unknown as NextFunction;

    await requireAuth(mockReq(), res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next() when a session exists", async () => {
    mockSession = { user: { role: "AGENT" } };
    const res = mockRes();
    const next = mock() as unknown as NextFunction;

    await requireAuth(mockReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeUndefined();
  });
});

describe("requireRole", () => {
  test("responds 401 when there is no session", async () => {
    const res = mockRes();
    const next = mock() as unknown as NextFunction;

    await requireRole("ADMIN")(mockReq(), res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("responds 403 when the session role is not in the allowed list", async () => {
    mockSession = { user: { role: "AGENT" } };
    const res = mockRes();
    const next = mock() as unknown as NextFunction;

    await requireRole("ADMIN")(mockReq(), res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next() when the session role matches", async () => {
    mockSession = { user: { role: "ADMIN" } };
    const res = mockRes();
    const next = mock() as unknown as NextFunction;

    await requireRole("ADMIN")(mockReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeUndefined();
  });

  test("allows any role included in the list", async () => {
    mockSession = { user: { role: "AGENT" } };
    const res = mockRes();
    const next = mock() as unknown as NextFunction;

    await requireRole("ADMIN", "AGENT")(mockReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
