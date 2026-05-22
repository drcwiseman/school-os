import React from "react";

export type IdCardTemplateId = "default" | "uganda_national" | "makerere";

type Props = {
  template: IdCardTemplateId;
  schoolName: string;
  firstName: string;
  lastName: string;
  identifier: string;
  subtitle?: string;
  kind?: "student" | "staff";
};

export const IdCardPreview: React.FC<Props> = ({
  template,
  schoolName,
  firstName,
  lastName,
  identifier,
  subtitle,
  kind = "student",
}) => {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  const name = `${firstName} ${lastName}`;

  if (template === "uganda_national") {
    return (
      <div className="flex flex-wrap justify-center gap-4">
        <CardShell label="Front">
          <div className="w-[272px] h-[172px] rounded-lg overflow-hidden border-2 border-emerald-800/40 shadow-lg text-left bg-[#f5ecd4]">
            <div className="h-8 bg-emerald-800 flex items-center px-2 justify-between">
              <span className="text-[8px] font-bold text-white tracking-wide">REPUBLIC OF UGANDA</span>
              <span className="text-[7px] text-emerald-100">{kind === "student" ? "STUDENT ID" : "STAFF ID"}</span>
            </div>
            <div className="p-2 flex gap-2">
              <div className="w-14 h-[4.5rem] bg-slate-200 border border-emerald-700/40 flex items-center justify-center text-lg font-bold text-slate-500 shrink-0">
                {initials}
              </div>
              <div className="text-[9px] text-slate-800 space-y-0.5 min-w-0">
                <p className="text-[7px] text-slate-500">SURNAME</p>
                <p className="font-bold uppercase truncate">{lastName}</p>
                <p className="text-[7px] text-slate-500 pt-0.5">GIVEN NAME(S)</p>
                <p className="font-bold uppercase truncate">{firstName}</p>
                <p className="text-[7px] text-slate-500 pt-0.5">{kind === "student" ? "ADM. NO." : "EMP. NO."}</p>
                <p className="font-mono font-semibold text-emerald-900">{identifier}</p>
                {subtitle && <p className="text-[8px] truncate">{subtitle}</p>}
              </div>
            </div>
            <div className="mx-2 mb-2 h-4 bg-white border border-slate-300 flex items-end justify-center gap-px px-1">
              {identifier.split("").slice(0, 24).map((_, i) => (
                <div key={i} className="w-0.5 bg-black" style={{ height: `${6 + (i % 4) * 2}px` }} />
              ))}
            </div>
          </div>
        </CardShell>
        <CardShell label="Back">
          <div className="w-[272px] h-[172px] rounded-lg overflow-hidden border-2 border-emerald-800/30 shadow-lg bg-[#f3ead0] text-left">
            <div className="h-6 bg-emerald-800 text-[8px] font-bold text-white flex items-center px-2">OFFICIAL SCHOOL USE ONLY</div>
            <div className="mx-2 mt-2 h-9 bg-slate-900 rounded-sm" />
            <div className="p-2 text-[8px] text-slate-700 space-y-0.5">
              <p className="font-semibold uppercase truncate">{name}</p>
              <p>ID: {identifier}</p>
              <p className="truncate">Issued by: {schoolName}</p>
              <p className="text-slate-500">If found, return to issuing school.</p>
            </div>
            <div className="mx-2 h-3 bg-white border border-slate-300 flex items-end gap-px px-1">
              {`UG${identifier}`.split("").slice(0, 20).map((_, i) => (
                <div key={i} className="w-0.5 bg-black" style={{ height: `${5 + (i % 3) * 2}px` }} />
              ))}
            </div>
          </div>
        </CardShell>
      </div>
    );
  }

  if (template === "makerere") {
    return (
      <div className="flex flex-wrap justify-center gap-4">
        <CardShell label="Front">
          <div className="w-[272px] h-[172px] rounded-lg overflow-hidden border-2 border-[#7b1e3a]/50 shadow-lg bg-white text-left">
            <div className="h-10 bg-[#7b1e3a] border-b-4 border-[#d4a82a] px-2 flex flex-col justify-center">
              <p className="text-[8px] font-bold text-white uppercase truncate">{schoolName}</p>
              <p className="text-[7px] text-[#d4a82a]">{kind === "student" ? "STUDENT ID CARD" : "STAFF ID CARD"}</p>
            </div>
            <div className="p-2 flex gap-2">
              <div className="w-14 h-[4.5rem] bg-slate-100 border-2 border-[#7b1e3a]/30 flex items-center justify-center text-lg font-bold text-[#7b1e3a]">
                {initials}
              </div>
              <div className="text-[9px] min-w-0">
                <p className="font-bold text-[#7b1e3a] uppercase text-[10px] leading-tight truncate">{name}</p>
                <p className="text-slate-500 mt-1">{kind === "student" ? "Reg. No." : "Staff No."}</p>
                <p className="font-mono font-bold text-sm">{identifier}</p>
                {subtitle && <p className="text-slate-600 truncate mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <div className="mx-2 h-3 bg-slate-50 border flex items-end gap-px px-1">
              {identifier.split("").slice(0, 22).map((_, i) => (
                <div key={i} className="w-0.5 bg-[#7b1e3a]" style={{ height: `${5 + (i % 4) * 2}px` }} />
              ))}
            </div>
          </div>
        </CardShell>
        <CardShell label="Back">
          <div className="w-[272px] h-[172px] rounded-lg overflow-hidden border-2 border-[#d4a82a]/60 shadow-lg bg-[#faf8f5] text-left">
            <div className="h-7 bg-[#d4a82a] text-[9px] font-bold text-[#7b1e3a] flex items-center px-2">TERMS OF USE</div>
            <ul className="p-2 text-[8px] text-slate-700 list-disc pl-4 space-y-0.5">
              <li>Property of the institution</li>
              <li>Wear visibly on campus</li>
              <li>Report loss immediately</li>
            </ul>
            <div className="mx-2 border border-[#7b1e3a]/40 rounded p-1 text-[8px]">
              <p className="font-bold text-[#7b1e3a] truncate">{schoolName}</p>
            </div>
            <div className="mx-2 mt-1 h-3 bg-white border flex items-end gap-px px-1">
              {`MK${identifier}`.split("").slice(0, 18).map((_, i) => (
                <div key={i} className="w-0.5 bg-[#7b1e3a]" style={{ height: `${5 + (i % 3) * 2}px` }} />
              ))}
            </div>
          </div>
        </CardShell>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-4">
      <CardShell label="Front">
        <div className="w-[272px] h-[172px] rounded-xl border border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50 shadow-lg p-3 text-left">
          <p className="text-[9px] font-bold text-indigo-900 uppercase truncate">{schoolName}</p>
          <p className="text-[8px] text-slate-500 mb-2">{kind === "student" ? "STUDENT ID" : "STAFF ID"}</p>
          <div className="flex gap-2">
            <div className="w-12 h-14 rounded-lg bg-white border flex items-center justify-center font-bold text-indigo-600">{initials}</div>
            <div>
              <p className="font-bold text-sm text-slate-900">{name}</p>
              <p className="font-mono text-xs text-slate-600">{identifier}</p>
              {subtitle && <p className="text-[10px] text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <div className="mt-2 h-3 bg-white border rounded flex items-end gap-px px-1">
            {identifier.split("").slice(0, 20).map((_, i) => (
              <div key={i} className="w-0.5 bg-slate-800" style={{ height: `${4 + (i % 4) * 2}px` }} />
            ))}
          </div>
        </div>
      </CardShell>
      <CardShell label="Back">
        <div className="w-[272px] h-[172px] rounded-xl border border-slate-300 bg-slate-50 shadow-lg p-3 text-left text-[9px] text-slate-600">
          <p className="font-semibold text-indigo-900">{schoolName}</p>
          <p className="mt-2">ID: {identifier}</p>
          <p className="mt-4 text-slate-400">Signature _______________</p>
          <p className="mt-2 text-[8px]">Property of school — not transferable</p>
          <div className="mt-3 h-3 bg-white border rounded flex items-end gap-px px-1">
            {identifier.split("").slice(0, 18).map((_, i) => (
              <div key={i} className="w-0.5 bg-slate-700" style={{ height: `${4 + (i % 3) * 2}px` }} />
            ))}
          </div>
        </div>
      </CardShell>
    </div>
  );
};

function CardShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-semibold">{label}</p>
      {children}
    </div>
  );
}
