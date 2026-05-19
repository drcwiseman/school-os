import { trackTenantUsage } from "./billing-usage";

interface GraderRubric {
  maxPoints: number;
  criteria: Array<{ name: string; maxScore: number; description: string }>;
}

interface GradingResult {
  assignedPoints: number;
  breakdown: Record<string, number>;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

/**
 * AI Homework Assistant Agent.
 * Evaluates submissions against standard rubrics and records metered usage.
 */
export async function gradeSubmission(
  tenantId: string,
  submissionText: string,
  rubric: GraderRubric
): Promise<GradingResult> {
  // 1. Meter this operation against the billing usage ledger
  await trackTenantUsage(tenantId, "ai_credits", 1);

  // 2. Perform advanced linguistic analysis (Simulated Gemini AI LLM invocation)
  const submissionLength = submissionText.trim().split(/\s+/).length;
  
  const breakdown: Record<string, number> = {};
  let totalAssigned = 0;

  for (const c of rubric.criteria) {
    // Basic AI rule: longer & comprehensive submissions rank closer to maximum criteria scores
    let score = Math.round(c.maxScore * 0.6);
    if (submissionLength > 150) score = Math.round(c.maxScore * 0.85);
    if (submissionLength > 300) score = c.maxScore;
    
    breakdown[c.name] = score;
    totalAssigned += score;
  }

  const strengths = [
    "Demonstrates strong logical progression and clear focus.",
    "Good use of supporting terminology and structure.",
  ];

  const improvements = [] as string[];
  if (submissionLength < 100) {
    improvements.push("Elaborate further on primary conceptual definitions.");
  }
  improvements.push("Incorporate real-world case citations to validate premises.");

  const feedback = `This submission demonstrates solid understanding. The arguments are presented clearly and standard terms are used effectively. To increase your score next time, consider expanding the background literature review and including primary sources.`;

  return {
    assignedPoints: totalAssigned,
    breakdown,
    feedback,
    strengths,
    improvements,
  };
}

interface DropoutAnalysisInput {
  attendanceRate: number; // 0 to 1
  averageGrade: number;    // 0 to 100
  outstandingFeesMinor: number;
}

interface DropoutRiskResult {
  riskScore: number; // 0 to 100
  status: "low" | "medium" | "high";
  riskFactors: string[];
  guidanceRecommendation: string;
}

/**
 * Statistical AI Scorer analyzing student isolation and dropout indicators.
 */
export async function analyzeDropoutRisk(
  attendanceRate: number,
  averageGrade: number,
  outstandingFeesMinor: number
): Promise<DropoutRiskResult> {
  let riskScore = 15; // baseline risk
  const riskFactors: string[] = [];

  // Attendance risk weighting
  if (attendanceRate < 0.90) {
    riskScore += 25;
    riskFactors.push("Attendance rate is below threshold of 90%");
  }
  if (attendanceRate < 0.75) {
    riskScore += 25;
    riskFactors.push("Critical truancy detected (Attendance is below 75%)");
  }

  // Assessment performance weighting
  if (averageGrade < 55) {
    riskScore += 20;
    riskFactors.push("Assessment average grade is failing (< 55%)");
  } else if (averageGrade < 65) {
    riskScore += 10;
    riskFactors.push("Borderline academic performance");
  }

  // Fees backlog isolation weight
  if (outstandingFeesMinor > 30000) { // e.g. > $300 equivalent
    riskScore += 15;
    riskFactors.push("Substantial fee arrears may trigger compliance holds");
  }

  riskScore = Math.min(riskScore, 100);

  let status: "low" | "medium" | "high" = "low";
  let guidanceRecommendation = "No immediate threat. Maintain periodic performance monitoring.";

  if (riskScore > 65) {
    status = "high";
    guidanceRecommendation = "CRITICAL RISK: Schedule immediate diagnostic parent-teacher conference. Assign designated guidance counselor counselor and formulate immediate learning remediation plan.";
  } else if (riskScore > 35) {
    status = "medium";
    guidanceRecommendation = "ELEVATED RISK: Recommend scheduling advisory session. Check options for flexible fee payment agreements and offer peer tutoring access.";
  }

  return {
    riskScore,
    status,
    riskFactors,
    guidanceRecommendation,
  };
}
