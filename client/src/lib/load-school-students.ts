import { api } from "../app/api/client";

export type SchoolStudentOption = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber?: string;
};

/** Loads students for pickers; falls back when enriched list fails (missing joins on VPS). */
export async function loadSchoolStudents(schoolSlug: string, limit = 300): Promise<SchoolStudentOption[]> {
  try {
    const r = await api.get(`/s/${schoolSlug}/api/students?limit=${limit}&enriched=true`);
    return r.data ?? [];
  } catch {
    const r = await api.get(`/s/${schoolSlug}/api/students?limit=${limit}&enriched=false`);
    return (r.data ?? []).map((s: SchoolStudentOption) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      admissionNumber: s.admissionNumber,
    }));
  }
}
