import { z } from "zod";

export const PAIN_POINTS = [
  "Fragmented systems & spreadsheets",
  "Poor parent communication",
  "Slow report card / PDF generation",
  "Finance & billing errors",
  "Data security concerns",
  "Multi-campus coordination",
  "Other",
] as const;

export const ROLES = [
  "Principal / Headmaster",
  "IT Director",
  "Finance Director",
  "Registrar",
  "Board Member",
  "Other",
] as const;

export const STUDENT_RANGES = [
  "Under 300",
  "300 – 800",
  "800 – 2,000",
  "2,000 – 5,000",
  "5,000+",
] as const;

export const leadFormSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  role: z.enum(ROLES, { message: "Select your role" }),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  schoolName: z.string().min(2, "School name is required"),
  studentCount: z.enum(STUDENT_RANGES, { message: "Select student body size" }),
  painPoint: z.enum(PAIN_POINTS, { message: "Select a primary pain point" }),
  message: z.string().max(2000).optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;
