import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pdfStructureCheck } from "./services/pdf";

describe("PDF structure", () => {
  it("validates a minimal generated PDF", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("Test", { x: 50, y: 700, size: 12, font });
    const bytes = await doc.save();
    const check = await pdfStructureCheck(bytes);
    expect(check.pageCount).toBe(1);
    expect(check.hasContent).toBe(true);
  });
});
