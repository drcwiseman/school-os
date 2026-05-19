import { format, parseISO, isValid } from "date-fns";

export function formatDate(date: Date | string, fmt = "yyyy-MM-dd"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return isValid(d) ? format(d, fmt) : "Invalid date";
}

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
