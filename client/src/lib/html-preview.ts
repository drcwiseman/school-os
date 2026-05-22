/** Strip tags for table previews and SMS payloads. */
export function htmlToPlainText(html: string, maxLen?: number): string {
  if (!html) return "";
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    const t = html.trim();
    return maxLen && t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  let text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  if (maxLen && text.length > maxLen) text = `${text.slice(0, maxLen)}…`;
  return text;
}
