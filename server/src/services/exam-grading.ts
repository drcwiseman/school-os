/** Letter grade from percentage (tenant can override via grading rules later). */
export function percentToGrade(percent: number): string {
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  if (percent >= 50) return "D";
  if (percent >= 40) return "E";
  return "F";
}

export function scoreToPercent(score: number | null, maxScore: number): number | null {
  if (score == null || !maxScore) return null;
  return Math.round((score / maxScore) * 1000) / 10;
}

export function defaultRemarks(grade: string): string {
  if (grade === "A") return "Excellent";
  if (grade === "B") return "Very good";
  if (grade === "C") return "Good";
  if (grade === "D") return "Satisfactory";
  if (grade === "E") return "Needs improvement";
  return "Below standard";
}
