import { describe, it, expect, beforeAll, vi } from "vitest";
import { analyzeDropoutRisk, gradeSubmission } from "./services/ai-agents";
import * as billingUsage from "./services/billing-usage";
import { getTenantUsageLimit, trackTenantUsage } from "./services/billing-usage";
import { db } from "./db";
import { tenants } from "./db/schema";

async function dbAvailable(): Promise<boolean> {
  try {
    await db.select().from(tenants).limit(1);
    return true;
  } catch {
    return false;
  }
}

describe("SaaS enterprise features", () => {
  describe("AI agents (no database)", () => {
    it("grades submissions against a rubric and returns feedback", async () => {
      vi.spyOn(billingUsage, "trackTenantUsage").mockResolvedValue(undefined);
      const rubric = {
        maxPoints: 30,
        criteria: [
          { name: "Grammar & Flow", maxScore: 10, description: "Structure and vocabulary" },
          { name: "Factual Accuracy", maxScore: 20, description: "Sources and accuracy" },
        ],
      };

      const result = await gradeSubmission(
        "00000000-0000-4000-8000-000000000001",
        "Neural networks learn hierarchical representations for classification and regression tasks in modern machine learning pipelines.",
        rubric,
      );

      expect(result.assignedPoints).toBeGreaterThan(0);
      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.feedback.length).toBeGreaterThan(10);
    });

    it("classifies dropout risk from attendance, grades, and fees", async () => {
      const lowRisk = await analyzeDropoutRisk(0.96, 85, 5000);
      expect(lowRisk.status).toBe("low");
      expect(lowRisk.riskScore).toBe(15);

      const highRisk = await analyzeDropoutRisk(0.68, 45, 50000);
      expect(highRisk.status).toBe("high");
      expect(highRisk.riskScore).toBeGreaterThan(65);
      expect(highRisk.riskFactors.length).toBeGreaterThan(0);
    });
  });

  describe("Usage billing ledger", () => {
    let testTenantId: string;
    let canUseDb = false;

    beforeAll(async () => {
      canUseDb = await dbAvailable();
      if (!canUseDb) return;

      const [t] = await db.select().from(tenants).limit(1);
      if (t) {
        testTenantId = t.id;
        return;
      }
      const [created] = await db
        .insert(tenants)
        .values({
          slug: "test-saas-school",
          name: "Test SaaS School",
          status: "active",
          subdomain: "test-saas-school",
        })
        .returning();
      testTenantId = created.id;
    });

    it.skipIf(() => !canUseDb)("tracks incrementing usage", async () => {
      const before = await getTenantUsageLimit(testTenantId, "ai_credits");
      await trackTenantUsage(testTenantId, "ai_credits", 1);
      const after = await getTenantUsageLimit(testTenantId, "ai_credits");
      expect(after.used).toBe(before.used + 1);
      expect(after.limit).toBe(50);
    });
  });
});
