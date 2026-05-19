import { platformAdmins } from "./schema";

/** Columns safe to select even when legacy DB rows predate migrations. */
export const platformAdminAuthColumns = {
  id: platformAdmins.id,
  email: platformAdmins.email,
  passwordHash: platformAdmins.passwordHash,
  name: platformAdmins.name,
};

export function platformAdminPublic(row: {
  id: string;
  email: string;
  name: string;
  role?: string | null;
}) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role ?? "super_admin",
  };
}
