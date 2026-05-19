import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "./index";
import { db } from "./db";
import { students, tenants } from "./db/schema";
import { eq } from "drizzle-orm";

let dbAvailable = false;

describe("Tenant isolation", () => {
  let tenantAStudentId: string;
  let tenantBStudentId: string;
  let sessionCookieA: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      await db.select().from(tenants).limit(1);
      dbAvailable = true;
    } catch {
      dbAvailable = false;
      return;
    }
    const [a] = await db.select().from(tenants).where(eq(tenants.slug, "school-a")).limit(1);
    const [b] = await db.select().from(tenants).where(eq(tenants.slug, "school-b")).limit(1);
    if (!a || !b) throw new Error("Run npm run db:seed before tenant isolation tests");

    const [stuA] = await db.select().from(students).where(eq(students.tenantId, a.id)).limit(1);
    const [stuB] = await db.select().from(students).where(eq(students.tenantId, b.id)).limit(1);
    if (!stuA || !stuB) throw new Error("Seed students missing");
    tenantAStudentId = stuA.id;
    tenantBStudentId = stuB.id;

    const loginRes = await request(app)
      .post("/s/school-a/api/auth/login")
      .send({ email: "admin@school-a.com", password: "Password123!" });
    const cookie = loginRes.headers["set-cookie"];
    sessionCookieA = Array.isArray(cookie) ? cookie[0] : cookie;
  });

  it.skipIf(() => !dbAvailable)("blocks school-a session from school-b routes", async () => {
    const res = await request(app)
      .get("/s/school-b/api/students")
      .set("Cookie", sessionCookieA);
    expect(res.status).toBe(403);
  });

  it.skipIf(() => !dbAvailable)("cannot read school-b student while authenticated on school-a", async () => {
    const res = await request(app)
      .get(`/s/school-a/api/students/${tenantBStudentId}`)
      .set("Cookie", sessionCookieA);
    expect(res.status).toBe(404);
  });

  it.skipIf(() => !dbAvailable)("allows school-a user to read own tenant student", async () => {
    const res = await request(app)
      .get(`/s/school-a/api/students/${tenantAStudentId}`)
      .set("Cookie", sessionCookieA);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(tenantAStudentId);
  });
});
