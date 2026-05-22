import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "./index";

describe("Health", () => {
  it("GET /api/health returns status and database info", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body).toHaveProperty("database");
    expect([200, 503]).toContain(res.status);
    expect(res.body.success).toBe(res.status === 200);
  });
});
