import { z } from "zod";

export const paginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export function paginate(page: number, limit: number) {
  const offset = (page - 1) * limit;
  return { limit, offset };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
