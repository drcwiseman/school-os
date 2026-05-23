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

export async function qrCodePngBuffer(payload: string, width = 160): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: "png",
    width,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
