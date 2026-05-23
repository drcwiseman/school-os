import fs from "fs";
import { PDFDocument, PDFFont, PDFImage, PDFPage, RGB, StandardFonts, rgb } from "pdf-lib";
import { idCardQrPayload, qrCodePngBuffer } from "./id-card-qr";

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

export type IdCardRenderOptions = {
  photoPath?: string | null;
};

type CardAssets = {
  font: PDFFont;
  bold: PDFFont;
  photo: PDFImage | null;
  qr: PDFImage | null;
};

const CARD_W = 242.65;
const CARD_H = 153;

function fullName(s: IdCardSubject) {
  return `${s.firstName} ${s.lastName}`.trim();
}

/** 1D barcode strip — no human-readable text under bars (per school ID spec). */
function drawBarcode1D(
  page: PDFPage,
  x: number,
  y: number,
  maxWidth: number,
  barHeight: number,
  seed: string,
) {
  const payload = seed.replace(/[^A-Z0-9]/gi, "").toUpperCase() || "0";
  const quiet = 6;
  const usable = maxWidth - quiet * 2;
  const unit = usable / (payload.length * 6 + 16);
  let bx = x + quiet;
  page.drawRectangle({ x, y, width: maxWidth, height: barHeight + 4, color: rgb(1, 1, 1) });
  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    for (let bit = 0; bit < 6; bit++) {
      if ((code + i + bit) % 3 !== 0) {
        page.drawRectangle({
          x: bx,
          y: y + 2,
          width: Math.max(unit * 0.85, 0.35),
          height: barHeight,
          color: rgb(0, 0, 0),
        });
      }
      bx += unit;
    }
  }
}

async function embedPhotoFromPath(doc: PDFDocument, filePath: string | null | undefined): Promise<PDFImage | null> {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const bytes = fs.readFileSync(filePath);
  try {
    return await doc.embedJpg(bytes);
  } catch {
    try {
      return await doc.embedPng(bytes);
    } catch {
      return null;
    }
  }
}

function drawPhotoSlot(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  initials: string,
  border: RGB,
  bold: PDFFont,
  photo: PDFImage | null,
) {
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(1, 1, 1), borderColor: border, borderWidth: 1 });
  if (photo) {
    page.drawImage(photo, { x, y, width: w, height: h });
    return;
  }
  page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.94, 0.94, 0.94), borderColor: border, borderWidth: 1 });
  page.drawText(initials.slice(0, 2), {
    x: x + w / 2 - 8,
    y: y + h / 2 - 6,
    size: 14,
    font: bold,
    color: rgb(0.55, 0.55, 0.55),
  });
}

function drawQrSlot(page: PDFPage, x: number, y: number, size: number, qr: PDFImage | null) {
  page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1), borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.5 });
  if (qr) {
    page.drawImage(qr, { x, y, width: size, height: size });
  }
}

function drawLabeledField(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  font: PDFFont,
  bold: PDFFont,
  opts?: { valueColor?: RGB; valueSize?: number },
) {
  page.drawText(label, { x, y, size: 5, font, color: rgb(0.35, 0.35, 0.35) });
  page.drawText(value.slice(0, 32), {
    x: x + 52,
    y,
    size: opts?.valueSize ?? 6.5,
    font: bold,
    color: opts?.valueColor ?? rgb(0.1, 0.1, 0.1),
  });
}

/* ── Default (Sunridge-style) ───────────────────────────────────────────── */

function drawDefaultFront(page: PDFPage, subject: IdCardSubject, branding: IdCardBranding, assets: CardAssets) {
  const { width: w, height: h } = page.getSize();
  const { font, bold } = assets;
  const headerH = 22;
  const bodyBg = rgb(0.93, 0.95, 0.98);

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: bodyBg });
  page.drawRectangle({ x: 0, y: h - headerH, width: w, height: headerH, color: branding.primaryColor });
  page.drawText(branding.schoolName.slice(0, 34), {
    x: 8,
    y: h - 15,
    size: 7,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(subject.kind === "student" ? "STUDENT ID" : "STAFF ID", {
    x: w - 52,
    y: h - 15,
    size: 6,
    font: bold,
    color: rgb(1, 1, 1),
  });

  drawQrSlot(page, 10, 30, 58, assets.qr);

  const tx = 76;
  let ty = h - headerH - 18;
  page.drawText(fullName(subject), { x: tx, y: ty, size: 10, font: bold, color: rgb(0.05, 0.1, 0.2) });
  ty -= 12;
  page.drawText(subject.identifier, { x: tx, y: ty, size: 8, font });
  ty -= 10;
  if (subject.subtitle) {
    page.drawText(subject.subtitle.slice(0, 28), { x: tx, y: ty, size: 7, font });
    ty -= 9;
  }
  if (subject.gender) {
    page.drawText(`Gender: ${subject.gender}`, { x: tx, y: ty, size: 6, font });
    ty -= 8;
  }
  if (subject.dob) {
    page.drawText(`DOB: ${subject.dob.toLocaleDateString("en-GB")}`, { x: tx, y: ty, size: 6, font });
  }

  drawBarcode1D(page, 8, 4, w - 16, 11, subject.identifier);
}

function drawDefaultBack(page: PDFPage, subject: IdCardSubject, branding: IdCardBranding, assets: CardAssets) {
  const { width: w, height: h } = page.getSize();
  const { font, bold, qr } = assets;
  const headerH = 20;

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: h - headerH, width: w, height: headerH, color: branding.primaryColor });
  page.drawText("AUTHORISED SIGNATURE", {
    x: 8,
    y: h - 13,
    size: 5.5,
    font: bold,
    color: rgb(1, 1, 1),
  });

  page.drawLine({ start: { x: 12, y: 88 }, end: { x: 100, y: 88 }, thickness: 0.5, color: rgb(0.4, 0.4, 0.4) });
  page.drawText("Principal / Head Teacher", { x: 12, y: 80, size: 5, font, color: rgb(0.45, 0.45, 0.45) });
  page.drawText(branding.schoolName.slice(0, 30), { x: 12, y: 72, size: 5.5, font: bold, color: rgb(0.15, 0.15, 0.15) });
  page.drawText(`ID: ${subject.identifier}`, { x: 12, y: 64, size: 5.5, font, color: rgb(0.2, 0.2, 0.2) });

  drawQrSlot(page, w - 66, 36, 56, qr);

  drawBarcode1D(page, 8, 4, w - 16, 11, subject.identifier);
}

/* ── Uganda national ───────────────────────────────────────────────────── */

function drawUgandaNationalFront(page: PDFPage, subject: IdCardSubject, branding: IdCardBranding, assets: CardAssets) {
  const { width: w, height: h } = page.getSize();
  const { font, bold, photo } = assets;
  const green = rgb(0, 0.45, 0.25);

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.97, 0.93, 0.82) });
  page.drawRectangle({ x: 0, y: h - 26, width: w, height: 26, color: green });
  page.drawText("REPUBLIC OF UGANDA", { x: 8, y: h - 12, size: 6, font: bold, color: rgb(1, 1, 1) });
  page.drawText(branding.schoolName.toUpperCase().slice(0, 28), {
    x: 8,
    y: h - 20,
    size: 4.5,
    font,
    color: rgb(0.92, 1, 0.96),
  });
  page.drawText(subject.kind === "student" ? "STUDENT IDENTITY CARD" : "STAFF IDENTITY CARD", {
    x: w - 108,
    y: h - 12,
    size: 5,
    font: bold,
    color: rgb(0.12, 0.32, 0.18),
  });

  drawPhotoSlot(page, 10, 36, 50, 60, `${subject.firstName[0] ?? ""}${subject.lastName[0] ?? ""}`, green, bold, photo);

  const tx = 68;
  let ty = h - 38;
  page.drawText("SURNAME", { x: tx, y: ty, size: 4.5, font, color: rgb(0.4, 0.4, 0.4) });
  ty -= 9;
  page.drawText(subject.lastName.toUpperCase(), { x: tx, y: ty, size: 8, font: bold });
  ty -= 12;
  page.drawText("GIVEN NAME(S)", { x: tx, y: ty, size: 4.5, font, color: rgb(0.4, 0.4, 0.4) });
  ty -= 9;
  page.drawText(subject.firstName.toUpperCase(), { x: tx, y: ty, size: 8, font: bold });
  ty -= 12;
  page.drawText("ADM. NO.", { x: tx, y: ty, size: 4.5, font, color: rgb(0.4, 0.4, 0.4) });
  ty -= 9;
  page.drawText(subject.identifier, { x: tx, y: ty, size: 7.5, font: bold, color: green });
  if (subject.dob) {
    ty -= 10;
    page.drawText(`DOB: ${subject.dob.toLocaleDateString("en-GB")}`, { x: tx, y: ty, size: 5.5, font });
  }

  drawBarcode1D(page, 8, 4, w - 16, 10, subject.identifier);
}

function drawUgandaNationalBack(page: PDFPage, subject: IdCardSubject, branding: IdCardBranding, assets: CardAssets) {
  const { width: w, height: h } = page.getSize();
  const { font, bold, qr } = assets;
  const green = rgb(0, 0.42, 0.24);
  const red = rgb(0.75, 0.1, 0.1);

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.97, 0.95, 0.9) });
  page.drawRectangle({ x: 0, y: h - 20, width: w, height: 20, color: green });
  page.drawText("OFFICIAL SCHOOL USE ONLY", { x: 8, y: h - 12, size: 5.5, font: bold, color: rgb(1, 1, 1) });

  const lx = 10;
  let ly = h - 32;
  const lines: [string, string][] = [
    ["SCHOOL:", branding.schoolName.slice(0, 22)],
    ["CLASS:", (subject.subtitle ?? "—").slice(0, 22)],
    ["STUDENT ID:", subject.identifier],
    ["NAME:", fullName(subject).slice(0, 22)],
  ];
  if (subject.gender) lines.push(["SEX:", String(subject.gender).toUpperCase()]);
  if (subject.dob) lines.push(["DOB:", subject.dob.toLocaleDateString("en-GB")]);

  for (const [label, value] of lines) {
    page.drawText(label, { x: lx, y: ly, size: 5, font: bold, color: rgb(0.35, 0.35, 0.35) });
    page.drawText(value, { x: lx + 42, y: ly, size: 5.5, font, color: rgb(0.1, 0.1, 0.1) });
    ly -= 9;
  }

  page.drawText("If found, return to issuing school.", { x: lx, y: 28, size: 4.5, font, color: red });

  drawQrSlot(page, w - 68, 32, 58, qr);
}

/* ── Makerere university style ─────────────────────────────────────────── */

function drawMakerereFront(page: PDFPage, subject: IdCardSubject, branding: IdCardBranding, assets: CardAssets) {
  const { width: w, height: h } = page.getSize();
  const { font, bold, photo } = assets;
  const maroon = rgb(0.48, 0.12, 0.23);
  const gold = rgb(0.85, 0.65, 0.13);
  const red = rgb(0.78, 0.08, 0.12);

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.99, 0.99, 1) });
  page.drawRectangle({ x: 0, y: h - 32, width: w, height: 28, color: maroon });
  page.drawRectangle({ x: 0, y: h - 34, width: w, height: 3, color: gold });
  const schoolParts = branding.schoolName.toUpperCase().split(/\s+/);
  const leftWord = schoolParts[0] ?? "SCHOOL";
  const rightWord = schoolParts.slice(1).join(" ") || "UNIVERSITY";
  page.drawText(leftWord.slice(0, 14), { x: 8, y: h - 14, size: 7, font: bold, color: rgb(1, 1, 1) });
  page.drawText(rightWord.slice(0, 14), { x: w - 58, y: h - 14, size: 7, font: bold, color: rgb(1, 1, 1) });

  const lx = 8;
  let ly = h - 44;
  drawLabeledField(page, "Name:", fullName(subject), lx, ly, font, bold, { valueSize: 7 });
  ly -= 9;
  drawLabeledField(page, "Student ID:", subject.identifier, lx, ly, font, bold);
  ly -= 9;
  drawLabeledField(page, "RegNo:", subject.identifier, lx, ly, font, bold, { valueColor: red, valueSize: 7 });
  ly -= 9;
  drawLabeledField(page, "Faculty/School:", (subject.subtitle ?? branding.schoolName).slice(0, 24), lx, ly, font, bold);
  ly -= 9;
  drawLabeledField(page, "Program:", (subject.subtitle ?? "—").slice(0, 24), lx, ly, font, bold);
  ly -= 9;
  drawLabeledField(
    page,
    "Date of Expiry:",
    subject.validUntil ?? "Current academic year",
    lx,
    ly,
    font,
    bold,
    { valueColor: red, valueSize: 6.5 },
  );

  drawPhotoSlot(page, w - 58, h - 100, 48, 58, `${subject.firstName[0] ?? ""}${subject.lastName[0] ?? ""}`, maroon, bold, photo);
  page.drawText("Student's Signature", { x: w - 58, y: h - 108, size: 4, font, color: rgb(0.45, 0.45, 0.45) });
  page.drawLine({
    start: { x: w - 58, y: h - 112 },
    end: { x: w - 10, y: h - 112 },
    thickness: 0.4,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawRectangle({ x: 0, y: 0, width: 72, height: 14, color: maroon });
  page.drawText("STUDENT ID CARD", { x: 6, y: 4, size: 5.5, font: bold, color: rgb(1, 1, 1) });
}

function drawMakerereBack(page: PDFPage, subject: IdCardSubject, branding: IdCardBranding, assets: CardAssets) {
  const { width: w, height: h } = page.getSize();
  const { font, bold, qr } = assets;
  const maroon = rgb(0.48, 0.12, 0.23);

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.98, 0.97, 0.95) });
  page.drawRectangle({ x: 0, y: h - 18, width: w, height: 18, color: rgb(0.85, 0.65, 0.13) });
  page.drawText("VERIFICATION", { x: 8, y: h - 12, size: 6, font: bold, color: maroon });

  const lx = 10;
  let ly = h - 30;
  const fields: [string, string][] = [
    ["SCHOOL:", branding.schoolName.slice(0, 20)],
    ["HOLDER:", fullName(subject).slice(0, 20)],
    ["ID NO:", subject.identifier],
    ["CLASS:", (subject.subtitle ?? "—").slice(0, 20)],
  ];
  for (const [label, val] of fields) {
    page.drawText(label, { x: lx, y: ly, size: 5, font: bold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(val, { x: lx + 38, y: ly, size: 5.5, font });
    ly -= 9;
  }

  drawQrSlot(page, w - 70, 28, 60, qr);
}

/* ── Export ─────────────────────────────────────────────────────────────── */

export async function appendIdCardPair(
  doc: PDFDocument,
  template: IdCardTemplateId,
  subject: IdCardSubject,
  branding: IdCardBranding,
  options?: IdCardRenderOptions,
) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const photo = await embedPhotoFromPath(doc, options?.photoPath);
  const qrBuf = await qrCodePngBuffer(
    idCardQrPayload(branding.schoolName, subject.identifier, subject.firstName, subject.lastName),
    200,
  );
  const qr = await doc.embedPng(qrBuf);
  const assets: CardAssets = { font, bold, photo, qr };

  const drawPair = (front: (p: PDFPage, s: IdCardSubject, b: IdCardBranding, a: CardAssets) => void, back: typeof front) => {
    front(doc.addPage([CARD_W, CARD_H]), subject, branding, assets);
    back(doc.addPage([CARD_W, CARD_H]), subject, branding, assets);
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
  options?: IdCardRenderOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  await appendIdCardPair(doc, template, subject, branding, options);
  return doc.save();
}
