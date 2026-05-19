import { Router } from "express";

const router = Router();

type LeadPayload = {
  fullName: string;
  role: string;
  email: string;
  phone?: string;
  schoolName: string;
  studentCount: string;
  painPoint: string;
  message?: string;
};

function validateLead(body: unknown): body is LeadPayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.fullName === "string" && b.fullName.length >= 2 &&
    typeof b.role === "string" &&
    typeof b.email === "string" && b.email.includes("@") &&
    typeof b.schoolName === "string" && b.schoolName.length >= 2 &&
    typeof b.studentCount === "string" &&
    typeof b.painPoint === "string"
  );
}

/** Public marketing lead capture — logs for now; wire to CRM/email in production */
router.post("/leads", (req, res) => {
  if (!validateLead(req.body)) {
    return res.status(400).json({ success: false, message: "Invalid lead payload" });
  }
  console.log("[LEAD]", JSON.stringify({ ...req.body, receivedAt: new Date().toISOString() }));
  res.status(201).json({ success: true, message: "Thank you — we will be in touch." });
});

export default router;
