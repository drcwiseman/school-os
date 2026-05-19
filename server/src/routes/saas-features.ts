import { Router } from "express";
import { z } from "zod";
import { validate } from "../utils/validate";
import { requireTenantFeature } from "../middleware/require-feature";
import { requireUsageLimit } from "../middleware/require-usage-limit";
import { verifyDomainDns } from "../services/dns-verification";
import { gradeSubmission, analyzeDropoutRisk } from "../services/ai-agents";
import { getTenant } from "../lib/tenant-scope";
import { db } from "../db";
import { students, marks, payments } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { NotFoundError } from "../middleware/error";

const router = Router();

/**
 * Endpoint: Verify custom domain connection.
 * Resolves CNAME/A records and registers SSL credentials.
 */
router.post(
  "/dns/verify",
  validate({
    body: z.object({
      customDomain: z.string().min(3),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = getTenant(req);
      const { customDomain } = req.body;

      const result = await verifyDomainDns(tenant.id, customDomain);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Endpoint: Grade student submission.
 * Enforces feature gate & metered limits dynamically.
 */
router.post(
  "/ai/grade-submission",
  requireTenantFeature("ai_homework"),
  requireUsageLimit("ai_credits"),
  validate({
    body: z.object({
      submissionText: z.string().min(5),
      rubric: z.object({
        maxPoints: z.number(),
        criteria: z.array(
          z.object({
            name: z.string(),
            maxScore: z.number(),
            description: z.string(),
          })
        ),
      }),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = getTenant(req);
      const { submissionText, rubric } = req.body;

      const graded = await gradeSubmission(tenant.id, submissionText, rubric);
      res.json({
        success: true,
        data: graded,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Endpoint: Predict student dropout risk.
 * Pulls actual attendance records, average scores, and fee backlogs.
 */
router.get("/ai/dropout-analysis/:studentId", async (req, res, next) => {
  try {
    const tenant = getTenant(req);
    const { studentId } = req.params;

    // Verify student exists
    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (!student || student.tenantId !== tenant.id) {
      throw new NotFoundError("Student not found in this school node");
    }

    // Pull attendance metrics
    const attStats = await db.execute<{ present: string; total: string }>(sql`
      SELECT 
        COUNT(CASE WHEN status = 'present' THEN 1 END) AS present,
        COUNT(*) AS total
      FROM attendance
      WHERE student_id = ${studentId}
    `);

    const attRow = attStats.rows[0];
    const present = Number(attRow?.present ?? 0);
    const total = Number(attRow?.total ?? 0);
    const attendanceRate = total > 0 ? present / total : 1.0;

    // Pull academic assessment performance
    const marksStats = await db.execute<{ avg_score: string }>(sql`
      SELECT AVG(score)::text AS avg_score
      FROM marks
      WHERE student_id = ${studentId}
    `);
    const marksRow = marksStats.rows[0];
    const averageGrade = Number(marksRow?.avg_score ?? 80);

    // Pull payments / invoices backlog
    const invoiceStats = await db.execute<{ total: string }>(sql`
      SELECT SUM(amount)::text AS total
      FROM payments
      WHERE tenant_id = ${tenant.id} AND deleted_at IS NULL
    `);
    const invoiceRow = invoiceStats.rows[0];
    const outstandingFees = Number(invoiceRow?.total ?? 0);

    // Run dropout forecasting analyzer
    const analysis = await analyzeDropoutRisk(attendanceRate, averageGrade, outstandingFees);

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
        },
        metrics: {
          attendanceRate,
          averageGrade,
          outstandingFeesMinor: outstandingFees,
        },
        analysis,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
