import QRCode from "qrcode";

export function idCardQrPayload(
  schoolName: string,
  identifier: string,
  firstName: string,
  lastName: string,
) {
  return JSON.stringify({
    t: "student_id",
    school: schoolName.slice(0, 80),
    id: identifier,
    name: `${firstName} ${lastName}`.trim(),
  });
}

export function qrDataUrl(payload: string, size = 120): Promise<string> {
  return QRCode.toDataURL(payload, { width: size, margin: 1, errorCorrectionLevel: "M" });
}
