import React, { useEffect, useMemo, useState } from "react";
import { idCardQrPayload, qrDataUrl } from "../utils/id-card-qr";

export type IdCardTemplateId = "default" | "uganda_national" | "makerere";

type Props = {
  template: IdCardTemplateId;
  schoolName: string;
  firstName: string;
  lastName: string;
  identifier: string;
  subtitle?: string;
  gender?: string | null;
  dob?: string | null;
  photoSrc?: string;
  kind?: "student" | "staff";
};

function PhotoSlot({
  src,
  initials,
  className,
}: {
  src?: string;
  initials: string;
  className: string;
}) {
  const [failed, setFailed] = useState(!src);
  useEffect(() => {
    setFailed(!src);
  }, [src]);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        className={`${className} object-cover`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`${className} flex items-center justify-center font-bold text-slate-500 shrink-0 bg-slate-200`}>
      {initials}
    </div>
  );
}

function QrSlot({ payload, size = 52, className = "" }: { payload: string; size?: number; className?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    void qrDataUrl(payload, size * 2).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [payload, size]);
  return (
    <div
      className={`bg-white border border-slate-300 shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt="" className="w-full h-full object-contain" /> : null}
    </div>
  );
}

function BarcodeStrip({ seed, className = "" }: { seed: string; className?: string }) {
  return (
    <div className={`bg-white border-t border-slate-200 px-1.5 pt-0.5 pb-1 flex items-end gap-px h-4 ${className}`}>
      {seed.split("").slice(0, 24).map((_, i) => (
        <div key={i} className="w-0.5 bg-black" style={{ height: `${5 + (i % 4) * 2}px` }} />
      ))}
    </div>
  );
}

function CardShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-semibold">{label}</p>
      {children}
    </div>
  );
}

export const IdCardPreview: React.FC<Props> = ({
  template,
  schoolName,
  firstName,
  lastName,
  identifier,
  subtitle,
  gender,
  dob,
  photoSrc,
  kind = "student",
}) => {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  const name = `${firstName} ${lastName}`;
  const genderLabel = gender ? String(gender) : "";
  const dobLabel = dob
    ? (typeof dob === "string" ? new Date(dob) : dob).toLocaleDateString("en-GB")
    : "";
  const qrPayload = useMemo(
    () => idCardQrPayload(schoolName, identifier, firstName, lastName),
    [schoolName, identifier, firstName, lastName],
  );

  if (template === "uganda_national") {
    return (
      <div className="flex flex-wrap justify-center gap-4">
        <CardShell label="Front">
          <div className="w-[272px] h-[172px] rounded-lg overflow-hidden border-2 border-emerald-800/40 shadow-lg text-left bg-[#f5ecd4] flex flex-col">
            <div className="h-7 bg-emerald-800 flex items-center px-2 justify-between shrink-0">
              <span className="text-[7px] font-bold text-white">REPUBLIC OF UGANDA</span>
              <span className="text-[7px] text-emerald-100">{kind === "student" ? "STUDENT ID" : "STAFF ID"}</span>
            </div>
            <div className="p-2 flex gap-2 flex-1 min-h-0">
              <PhotoSlot src={photoSrc} initials={initials} className="w-14 h-[4.5rem] border border-emerald-700/40" />
              <div className="text-[8px] text-slate-800 space-y-0.5 min-w-0 flex-1">
                <p className="text-[6px] text-slate-500">SURNAME</p>
                <p className="font-bold uppercase truncate">{lastName}</p>
                <p className="text-[6px] text-slate-500 pt-0.5">GIVEN NAME(S)</p>
                <p className="font-bold uppercase truncate">{firstName}</p>
                <p className="text-[6px] text-slate-500 pt-0.5">ADM. NO.</p>
                <p className="font-mono font-semibold text-emerald-900">{identifier}</p>
                {dobLabel && <p className="text-[7px]">DOB: {dobLabel}</p>}
              </div>
            </div>
            <BarcodeStrip seed={identifier} />
          </div>
        </CardShell>
        <CardShell label="Back">
          <div className="w-[272px] h-[172px] rounded-lg overflow-hidden border-2 border-emerald-800/30 shadow-lg bg-[#f3ead0] text-left flex flex-col">
            <div className="h-5 bg-emerald-800 text-[7px] font-bold text-white flex items-center px-2 shrink-0">
              OFFICIAL SCHOOL USE ONLY
            </div>
            <div className="p-2 flex gap-2 flex-1 min-h-0 text-[7px]">
              <div className="space-y-0.5 flex-1">
                <p><span className="font-bold">SCHOOL:</span> {schoolName}</p>
                <p><span className="font-bold">CLASS:</span> {subtitle ?? "—"}</p>
                <p><span className="font-bold">STUDENT ID:</span> {identifier}</p>
                <p><span className="font-bold">NAME:</span> {name}</p>
                {genderLabel && <p><span className="font-bold">SEX:</span> {genderLabel}</p>}
                <p className="text-red-700 text-[6px] pt-1">If found, return to issuing school.</p>
              </div>
              <QrSlot payload={qrPayload} size={56} />
            </div>
          </div>
        </CardShell>
      </div>
    );
  }

  if (template === "makerere") {
    const schoolParts = schoolName.toUpperCase().split(/\s+/);
    const leftWord = schoolParts[0] ?? "SCHOOL";
    const rightWord = schoolParts.slice(1).join(" ") || "";
    return (
      <div className="flex flex-wrap justify-center gap-4">
        <CardShell label="Front">
          <div className="w-[272px] h-[172px] rounded-lg overflow-hidden border-2 border-[#7b1e3a]/50 shadow-lg bg-white text-left flex flex-col relative">
            <div className="h-9 bg-[#7b1e3a] border-b-[3px] border-[#d4a82a] px-2 flex items-center justify-between shrink-0">
              <span className="text-[8px] font-bold text-white">{leftWord}</span>
              {rightWord && <span className="text-[8px] font-bold text-white">{rightWord}</span>}
            </div>
            <div className="p-2 flex gap-1 flex-1 min-h-0">
              <div className="text-[7px] flex-1 space-y-0.5 min-w-0">
                <p><span className="text-slate-500">Name:</span> <span className="font-bold">{name}</span></p>
                <p><span className="text-slate-500">Student ID:</span> <span className="font-bold">{identifier}</span></p>
                <p><span className="text-slate-500">RegNo:</span> <span className="font-bold text-red-700">{identifier}</span></p>
                <p><span className="text-slate-500">Faculty/School:</span> <span className="font-bold truncate block">{subtitle ?? schoolName}</span></p>
                <p><span className="text-slate-500">Program:</span> <span className="font-bold">{subtitle ?? "—"}</span></p>
                <p><span className="text-slate-500">Date of Expiry:</span> <span className="font-bold text-red-700">Current year</span></p>
              </div>
              <div className="shrink-0 text-center">
                <PhotoSlot src={photoSrc} initials={initials} className="w-12 h-14 border-2 border-[#7b1e3a]/30 text-[#7b1e3a]" />
                <p className="text-[6px] text-slate-500 mt-0.5">Student&apos;s Signature</p>
                <div className="border-b border-slate-400 w-full mt-0.5" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 bg-[#7b1e3a] text-white text-[7px] font-bold px-2 py-0.5">
              STUDENT ID CARD
            </div>
          </div>
        </CardShell>
        <CardShell label="Back">
          <div className="w-[272px] h-[172px] rounded-lg overflow-hidden border-2 border-[#d4a82a]/60 shadow-lg bg-[#faf8f5] text-left flex flex-col">
            <div className="h-5 bg-[#d4a82a] text-[8px] font-bold text-[#7b1e3a] flex items-center px-2 shrink-0">VERIFICATION</div>
            <div className="p-2 flex gap-2 flex-1 text-[7px]">
              <div className="space-y-0.5 flex-1">
                <p><span className="font-bold">SCHOOL:</span> {schoolName}</p>
                <p><span className="font-bold">HOLDER:</span> {name}</p>
                <p><span className="font-bold">ID NO:</span> {identifier}</p>
                <p><span className="font-bold">CLASS:</span> {subtitle ?? "—"}</p>
              </div>
              <QrSlot payload={qrPayload} size={58} />
            </div>
          </div>
        </CardShell>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-4">
      <CardShell label="Front">
        <div className="w-[272px] h-[172px] rounded-lg overflow-hidden border border-slate-300 shadow-lg text-left flex flex-col bg-[#eef2f9]">
          <div className="h-6 bg-[#1e3a5f] flex items-center justify-between px-2 shrink-0">
            <span className="text-[8px] font-bold text-white truncate max-w-[65%]">{schoolName}</span>
            <span className="text-[7px] font-bold text-white">{kind === "student" ? "STUDENT ID" : "STAFF ID"}</span>
          </div>
          <div className="p-2 flex gap-2 flex-1 min-h-0">
            <QrSlot payload={qrPayload} size={56} className="border-slate-300" />
            <div className="min-w-0 text-[9px] text-slate-800">
              <p className="font-bold text-[11px] text-slate-900 leading-tight">{name}</p>
              <p className="font-mono mt-0.5">{identifier}</p>
              {subtitle && <p className="mt-0.5">{subtitle}</p>}
              {genderLabel && <p className="mt-0.5">Gender: {genderLabel}</p>}
              {dobLabel && <p>DOB: {dobLabel}</p>}
            </div>
          </div>
          <BarcodeStrip seed={identifier} />
        </div>
      </CardShell>
      <CardShell label="Back">
        <div className="w-[272px] h-[172px] rounded-lg overflow-hidden border border-slate-300 shadow-lg bg-white text-left flex flex-col">
          <div className="h-5 bg-[#1e3a5f] text-[7px] font-bold text-white flex items-center px-2 shrink-0">
            AUTHORISED SIGNATURE
          </div>
          <div className="p-2 flex gap-2 flex-1 min-h-0">
            <div className="flex-1 text-[7px] text-slate-800">
              <div className="border-b border-slate-400 w-24 mb-1" />
              <p className="text-slate-500">Principal / Head Teacher</p>
              <p className="font-semibold mt-0.5">{schoolName}</p>
              <p>ID: {identifier}</p>
            </div>
            <QrSlot payload={qrPayload} size={52} />
          </div>
          <BarcodeStrip seed={identifier} />
        </div>
      </CardShell>
    </div>
  );
};
