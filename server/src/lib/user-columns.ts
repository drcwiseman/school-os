import { users } from "../db/schema";

/** Columns safe when VPS DB lags behind schema (e.g. missing campus_id). */
export const userAuthColumns = {
  id: users.id,
  tenantId: users.tenantId,
  email: users.email,
  passwordHash: users.passwordHash,
  firstName: users.firstName,
  lastName: users.lastName,
  status: users.status,
  deletedAt: users.deletedAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};
