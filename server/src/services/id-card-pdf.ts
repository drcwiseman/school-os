import { PDFDocument, PDFFont, PDFPage, RGB, StandardFonts, rgb } from "pdf-lib";

export type IdCardTemplateId = "default" | "uganda_national" | "makerere";

export type IdCardSubject = {
  kind: "student" | "staff";
  firstName: string;
  lastName: string;
  identifier: string;
  subtitle?: string;
  gender?: string | null;
  dob?: Date | null;
  validUntil?: string;
};

export type IdCardBranding = {
  schoolName: string;
  logoText?: string;
  primaryColor: RGB;
  footer?: string;
};

const CARD_W = 242.65;
const CARD_H = 153;

function fullName(s: IdCardSubject) {
  return `${s.firstName} ${s.lastName}`.trim().toUpperCase();
}

function drawBarcode(
  page: PDFPage,
  x: number,
  y: number,
  maxWidth: number,
  barHeight: number,
  text: string,
  font: PDFFont,
) {
  const payload = text.replace(/[^A-Z0-9]/gi, "").toUpperCase() || "0";
  const quiet = 4;
  const usable = maxWidth - quiet * 2;
  const unit = usable / (payload.length * 6 + 16);
  let bx = x + quiet;
  page.drawRectangle({ x, y, width: maxWidth, height: barHeight + 14, color: rgb(1, 1, 1) });
  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    for (let bit = 0; bit < 6; bit++) {
      if ((code + i + bit) % 3 !== 0) {
        page.drawRectangle({
          x: bx,
          y,
          width: Math.max(unit * 0.85, 0.4),
          height: barHeight,
          color: rgb(0, 0, 0),
        });
      }
      bx += unit;
    }
  }
  page.drawText(text.slice(0, 28), {
    x: x + quiet,
    y: y - 9,
    size: 5.5,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
}

function drawPhotoPlaceholder(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  initials: string,
  border: RGB,
  bold: PDFFont,
) {
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.94, 0.94, 0.94), borderColor: border, borderWidth: 1 });
  page.drawText(initials.slice(0, 2), {
    x: x + w / 2 - 8,
    y: y + h / 2 - 6,
    size: 14,
    font: bold,
    color: rgb(0.55, 0.55, 0.55),
  });
}

function drawUgandaNationalFront(
  page: PDFPage,
  subject: IdCardSubject,
  branding: IdCardBranding,
  font: PDFFont,
  bold: PDFFont,
) {
  const { width: w, height: h } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.97, 0.93, 0.82) });
  page.drawRectangle({ x: 0, y: h - 28, width: w, height: 28, color: rgb(0, 0.45, 0.25) });
  page.drawText("REPUBLIC OF UGANDA", { x: 8, y: h - 14, size: 6, font: bold, color: rgb(1, 1, 1) });
  page.drawText(branding.schoolName.toUpperCase().slice(0, 32), {
    x: 8,
    y: h - 22,
    size: 5,
    font,
    color: rgb(0.9, 1, 0.95),
  });
  page.drawText(subject.kind === "student" ? "STUDENT IDENTITY CARD" : "STAFF IDENTITY CARD", {
    x: w - 118,
    y: h - 14,
    size: 5.5,
    font: bold,
    color: rgb(0.15, 0.35, 0.2),
  });

  drawPhotoPlaceholder(
    page,
    10,
    38,
    52,
    62,
    `${subject.firstName[0] ?? ""}${subject.lastName[0] ?? ""}`,
    rgb(0.2, 0.45, 0.3),
    bold,
  );

  const tx = 72;
  let ty = h - 42;
  page.drawText("SURNAME", { x: tx, y: ty, size: 5, font, color: rgb(0.35, 0.35, 0.35) });
  ty -= 10;
  page.drawText(subject.lastName.toUpperCase(), { x: tx, y: ty, size: 9, font: bold });
  ty -= 14;
  page.drawText("GIVEN NAME(S)", { x: tx, y: ty, size: 5, font, color: rgb(0.35, 0.35, 0.35) });
  ty -= 10;
  page.drawText(subject.firstName.toUpperCase(), { x: tx, y: ty, size: 9, font: bold });
  ty -= 14;
  page.drawText(subject.kind === "student" ? "ADM. NO." : "EMP. NO.", {
    x: tx,
    y: ty,
    size: 5,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  ty -= 10;
  page.drawText(subject.identifier, { x: tx, y: ty, size: 8, font: bold, color: rgb(0.1, 0.25, 0.15) });
  if (subject.subtitle) {
    ty -= 12;
    page.drawText(subject.subtitle.slice(0, 28), { x: tx, y: ty, size: 6, font });
  }

  drawBarcode(page, 10, 8, w - 20, 14, subject.identifier, font);
}

function drawUgandaNationalBack(
  page: PDFPage,
  subject: IdCardSubject,
  branding: IdCardBranding,
  font: PDFFont,
  bold: PDFFont,
) {
  const { width: w, height: h } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.95, 0.92, 0.78) });
  page.drawRectangle({ x: 0, y: h - 22, width: w, height: 22, color: rgb(0, 0.42, 0.24) });
  page.drawText("OFFICIAL SCHOOL USE ONLY", { x: 10, y: h - 14, size: 6, font: bold, color: rgb(1, 1, 1) });

  page.drawRectangle({ x: 10, y: h - 70, width: w - 20, height: 38, color: rgb(0.12, 0.12, 0.12) });
  page.drawText("AUTHORISED BY MINISTRY OF EDUCATION & SPORTS · UGANDA", {
    x: 14,
    y: h - 58,
    size: 4.5,
    font,
    color: rgb(0.75, 0.75, 0.75),
  });

  let y = h - 88;
  for (const line of [
    `Card holder: ${fullName(subject)}`,
    `ID: ${subject.identifier}`,
    subject.gender ? `Sex: ${String(subject.gender).toUpperCase()}` : "",
    subject.dob ? `DOB: ${subject.dob.toLocaleDateString("en-GB")}` : "",
    `Issued by: ${branding.schoolName}`,
    branding.footer ?? "",
    "If found, return to issuing school.",
  ].filter(Boolean)) {
    page.drawText(line.slice(0, 42), { x: 12, y, size: 6, font });
    y -= 9;
  }

  drawBarcode(page, 12, 10, w - 24, 12, `UG-${subject.identifier}`, font);
}

function drawMakerereFront(
  page: PDFPage,
  subject: IdCardSubject,
  branding: IdCardBranding,
  font: PDFFont,
  bold: PDFFont,
) {
  const { width: w, height: h } = page.getSize();
  const maroon = rgb(0.48, 0.12, 0.23);
  const gold = rgb(0.85, 0.65, 0.13);
  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: h - 36, width: w, height: 36, color: maroon });
  page.drawRectangle({ x: 0, y: h - 40, width: w, height: 4, color: gold });
  page.drawText(branding.schoolName.toUpperCase().slice(0, 30), {
    x: 10,
    y: h - 18,
    size: 7,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(subject.kind === "student" ? "STUDENT ID CARD" : "STAFF ID CARD", {
    x: 10,
    y: h - 28,
    size: 5,
    font,
    color: gold,
  });

  drawPhotoPlaceholder(page, 12, 42, 54, 64, `${subject.firstName[0] ?? ""}${subject.lastName[0] ?? ""}`, maroon, bold);

  const tx = 74;
  page.drawText(fullName(subject), { x: tx, y: 88, size: 9, font: bold, color: maroon });
  page.drawText(subject.kind === "student" ? "Reg. No." : "Staff No.", { x: tx, y: 76, size: 5, font, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(subject.identifier, { x: tx, y: 64, size: 10, font: bold });
  if (subject.subtitle) {
    page.drawText(subject.subtitle.slice(0, 26), { x: tx, y: 52, size: 7, font, color: rgb(0.35, 0.35, 0.35) });
  }
  page.drawText(`Valid: ${subject.validUntil ?? "Current academic year"}`, { x: tx, y: 40, size: 5.5, font });

  drawBarcode(page, 12, 8, w - 24, 12, subject.identifier, font);
}

function drawMakerereBack(
  page: PDFPage,
  subject: IdCardSubject,
  branding: IdCardBranding,
  font: PDFFont,
  bold: PDFFont,
) {
  const { width: w, height: h } = page.getSize();
  const maroon = rgb(0.48, 0.12, 0.23);
  const gold = rgb(0.85, 0.65, 0.13);
  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.98, 0.97, 0.95) });
  page.drawRectangle({ x: 0, y: h - 30, width: w, height: 30, color: gold });
  page.drawText("TERMS OF USE", { x: 12, y: h - 18, size: 7, font: bold, color: maroon });

  let y = h - 42;
  for (const line of [
    "This card remains property of the institution.",
    "Must be worn visibly on campus at all times.",
    "Not transferable. Report loss immediately.",
    `Holder: ${fullName(subject)} · ${subject.identifier}`,
  ]) {
    page.drawText(line.slice(0, 40), { x: 12, y, size: 5.5, font });
    y -= 10;
  }

  page.drawRectangle({ x: 10, y: 32, width: w - 20, height: 22, borderColor: maroon, borderWidth: 1 });
  page.drawText(branding.schoolName.slice(0, 36), { x: 14, y: 42, size: 6, font: bold, color: maroon });
  page.drawText(branding.footer?.slice(0, 40) ?? "Official identification", { x: 14, y: 34, size: 5, font });

  drawBarcode(page, 12, 8, w - 24, 14, `MK-${subject.identifier}`, font);
}

function drawDefaultFront(
  page: PDFPage,
  subject: IdCardSubject,
  branding: IdCardBranding,
  font: PDFFont,
  bold: PDFFont,
) {
  const { width: w, height: h } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.96, 0.97, 1) });
  page.drawRectangle({ x: 0, y: h - 24, width: w, height: 24, color: branding.primaryColor });
  page.drawText(branding.schoolName.slice(0, 34), {
    x: 10,
    y: h - 16,
    size: 7,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(subject.kind === "student" ? "STUDENT ID" : "STAFF ID", {
    x: w - 58,
    y: h - 16,
    size: 6,
    font,
    color: rgb(0.9, 0.95, 1),
  });

  drawPhotoPlaceholder(
    page,
    12,
    40,
    50,
    58,
    `${subject.firstName[0] ?? ""}${subject.lastName[0] ?? ""}`,
    branding.primaryColor,
    bold,
  );
  page.drawText(`${subject.firstName} ${subject.lastName}`, { x: 70, y: 78, size: 10, font: bold });
  page.drawText(subject.identifier, { x: 70, y: 64, size: 8, font });
  if (subject.subtitle) page.drawText(subject.subtitle.slice(0, 24), { x: 70, y: 52, size: 7, font });
  drawBarcode(page, 10, 8, w - 20, 12, subject.identifier, font);
}

function drawDefaultBack(
  page: PDFPage,
  subject: IdCardSubject,
  branding: IdCardBranding,
  font: PDFFont,
  bold: PDFFont,
) {
  const { width: w, height: h } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.98, 0.98, 1) });
  page.drawRectangle({ x: 0, y: h - 20, width: w, height: 20, color: branding.primaryColor });
  page.drawText("AUTHORISED SIGNATURE", { x: 10, y: h - 13, size: 5, font: bold, color: rgb(1, 1, 1) });

  page.drawRectangle({ x: 12, y: 69, width: 78, height: 0.5, color: rgb(0.5, 0.5, 0.5) });
  page.drawText("Principal / Head Teacher", { x: 12, y: 62, size: 5, font });

  let y = 48;
  for (const line of [branding.schoolName, `ID: ${subject.identifier}`, "Property of school — not transferable"]) {
    page.drawText(line.slice(0, 38), { x: 12, y, size: 6, font });
    y -= 10;
  }
  drawBarcode(page, 10, 8, w - 20, 12, subject.identifier, font);
}

export async function appendIdCardPair(
  doc: PDFDocument,
  template: IdCardTemplateId,
  subject: IdCardSubject,
  branding: IdCardBranding,
) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const drawPair = (front: typeof drawDefaultFront, back: typeof drawDefaultBack) => {
    front(doc.addPage([CARD_W, CARD_H]), subject, branding, font, bold);
    back(doc.addPage([CARD_W, CARD_H]), subject, branding, font, bold);
  };

  if (template === "uganda_national") {
    drawPair(drawUgandaNationalFront, drawUgandaNationalBack);
  } else if (template === "makerere") {
    drawPair(drawMakerereFront, drawMakerereBack);
  } else {
    drawPair(drawDefaultFront, drawDefaultBack);
  }
}

export async function createIdCardPdf(
  template: IdCardTemplateId,
  subject: IdCardSubject,
  branding: IdCardBranding,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  await appendIdCardPair(doc, template, subject, branding);
  return doc.save();
}
