import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Download, ExternalLink, FolderOpen, Video } from "lucide-react";

type Material = {
  id: string;
  title: string;
  subject?: string;
  subjectName?: string;
  folder?: string;
  filePath?: string;
  fileName?: string;
  url?: string;
  mimeType?: string;
  createdAt?: string;
};

export function StudentMaterialsPanel({
  schoolSlug,
  onlineClasses,
  onJoinClass,
}: {
  schoolSlug: string;
  onlineClasses: any[];
  onJoinClass?: (id: string) => void;
}) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [folder, setFolder] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = folder !== "all" ? `?folder=${encodeURIComponent(folder)}` : "";
      const res = await api.get(`/s/${schoolSlug}/api/portal/student/materials${q}`);
      setMaterials(res.data ?? []);
      setFolders((res as { folders?: string[] }).folders ?? []);
    } catch {
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, folder]);

  useEffect(() => { load(); }, [load]);

  const filtered = folder === "all"
    ? materials
    : materials.filter((m) => (m.folder ?? "general") === folder);

  const byFolder = filtered.reduce<Record<string, Material[]>>((acc, m) => {
    const key = m.folder ?? "general";
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => setFolder("all")}
            className={`rounded-lg px-3 py-1 text-xs font-medium ${folder === "all" ? "portal-theme-selected" : "border border-[var(--portal-border)]"}`}
          >
            All
          </button>
          {folders.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFolder(f)}
              className={`rounded-lg px-3 py-1 text-xs font-medium capitalize ${folder === f ? "portal-theme-selected" : "border border-[var(--portal-border)]"}`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="portal-empty text-sm">Loading materials…</p>
        ) : filtered.length === 0 ? (
          <p className="portal-empty text-sm">No study materials for your class yet.</p>
        ) : folder === "all" ? (
          Object.entries(byFolder).map(([fname, items]) => (
            <div key={fname} className="mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wider portal-accent-text mb-2 flex items-center gap-1">
                <FolderOpen className="w-3.5 h-3.5" /> {fname}
              </h3>
              <MaterialList schoolSlug={schoolSlug} items={items} />
            </div>
          ))
        ) : (
          <MaterialList schoolSlug={schoolSlug} items={filtered} />
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-[var(--portal-fg-strong)] mb-3 flex items-center gap-2">
          <Video className="w-4 h-4 portal-accent-text" /> Online classes
        </h3>
        {onlineClasses.length === 0 ? (
          <p className="portal-empty text-sm">No online class links.</p>
        ) : (
          <ul className="space-y-2">
            {onlineClasses.map((c: any) => (
              <li key={c.id} className="rounded-lg border border-[var(--portal-border)] px-3 py-2 flex flex-wrap justify-between gap-2">
                <div>
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-sm portal-accent-text font-medium inline-flex items-center gap-1">
                    {c.title} <ExternalLink className="w-3 h-3" />
                  </a>
                  <p className="text-xs text-[var(--portal-subtle)]">{c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : ""}</p>
                </div>
                {onJoinClass && (
                  <button type="button" className="text-xs portal-btn-primary rounded-lg text-white px-2 py-1" onClick={() => onJoinClass(c.id)}>
                    Mark joined
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MaterialList({ schoolSlug, items }: { schoolSlug: string; items: Material[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((m) => (
        <li key={m.id} className="flex justify-between gap-2 rounded-lg border border-[var(--portal-border)] px-3 py-2">
          <div className="min-w-0">
            <p className="text-[var(--portal-fg-strong)] font-medium truncate">{m.title}</p>
            <p className="text-xs text-[var(--portal-subtle)]">{m.subjectName ?? m.subject ?? ""}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {m.url && (
              <a href={m.url} target="_blank" rel="noreferrer" className="portal-accent-text text-xs inline-flex items-center gap-0.5">
                <ExternalLink className="w-3 h-3" /> Link
              </a>
            )}
            {m.filePath && (
              <a
                href={`/s/${schoolSlug}/api/portal/student/materials/${m.id}/file`}
                className="portal-accent-text text-xs inline-flex items-center gap-0.5"
                target="_blank"
                rel="noreferrer"
              >
                <Download className="w-3 h-3" /> {m.fileName ?? "Download"}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
