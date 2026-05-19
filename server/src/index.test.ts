import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "./index";

describe("Health Check API", () => {
  it("should return 200 OK and health details", async () => {
    const response = await request(app).get("/api/health");
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("message", "Server is healthy");
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("env");
  });
});
