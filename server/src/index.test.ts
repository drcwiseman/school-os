import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "./index";

describe("Health Check API", () => {
  it("should return 200 OK and health details", async () => {
    const response = await request(app).get("/api/health");
    
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty("database");
    expect(response.body.success).toBe(response.status === 200);
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("env");
  });
});
