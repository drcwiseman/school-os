import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  DatabaseBackup,
  Loader2,
  RefreshCw,
  Save,
  Play,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  HardDrive,
  Database,
  FolderArchive,
  RotateCcw,
} from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

type BackupPolicy = {
  scheduleEnabled: boolean;
  scheduleFrequency: "daily" | "weekly";
  scheduleHourUtc: number;
  retentionDays: number;
  includeDatabase: boolean;
  includeUploads: boolean;
  notifyEmail: string;
  offsiteEnabled: boolean;
  s3Bucket: string;
  s3Region: string;
  s3Prefix: string;
  s3Endpoint: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
};

type Snapshot = {
  id: string;
  label: string;
  trigger: string;
  status: string;
  includesDatabase: boolean;
  includesUploads: boolean;
  fileName: string | null;
  sizeBytes: number;
  sizeHuman: string;
  error: string | null;
  completedAt: string | null;
  createdAt: string;
  downloadUrl: string | null;
  offsiteKey: string | null;
  offsiteStatus: string | null;
};

type Hub = {
  policy: BackupPolicy;
  summary: {
    totalSnapshots: number;
    completed: number;
    failed: number;
    running: number;
    lastSuccessAt: string | null;
    totalStorageBytes: number;
    totalStorageHuman: string;
    pgDumpAvailable: boolean;
  };
  snapshots: Snapshot[];
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 size={12} /> Completed
      </span>
    );
  }
  if (s === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
        <XCircle size={12} /> Failed
      </span>
    );
  }
  if (s === "running" || s === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
        <Loader2 size={12} className="animate-spin" /> {status}
      </span>
    );
  }
  return <span className="text-[11px] text-slate-500 capitalize">{status}</span>;
}

export const PlatformBackupSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hub, setHub] = useState<Hub | null>(null);
  const [policy, setPolicy] = useState<BackupPolicy | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadHub = useCallback(async () => {
    const r = await api.get("/api/platform/settings/backup");
    const data = r.data as Hub;
    setHub(data);
    setPolicy(data.policy);
    return data;
  }, []);

  useEffect(() => {
    loadHub()
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [loadHub, toast]);

  useEffect(() => {
    if (!hub?.summary.running) return;
    const t = setInterval(() => {
      loadHub().catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [hub?.summary.running, loadHub]);

  const savePolicy = async () => {
    if (!policy) return;
    setSavingPolicy(true);
    try {
      await api.patch("/api/platform/settings/backup/policy", policy);
      toast("Backup policy saved", "success");
      await loadHub();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSavingPolicy(false);
    }
  };

  const runBackup = async () => {
    setRunningBackup(true);
    try {
      await api.post("/api/platform/settings/backup/run", {
        includeDatabase: policy?.includeDatabase,
        includeUploads: policy?.includeUploads,
      });
      toast("Backup started — watch status below", "success");
      await loadHub();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setRunningBackup(false);
    }
  };

  const downloadSnapshot = (id: string) => {
    const url = `${API_BASE}/api/platform/settings/backup/snapshots/${id}/download`;
    window.open(url, "_blank", "noopener");
  };

  const deleteSnapshot = async (id: string) => {
    if (!window.confirm("Delete this backup snapshot permanently?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/platform/settings/backup/snapshots/${id}`);
      toast("Backup deleted", "success");
      await loadHub();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const restoreSnapshot = async () => {
    if (!restoreId) return;
    setRestoring(true);
    try {
      const r = await api.post(`/api/platform/settings/backup/snapshots/${restoreId}/restore`, {
        confirmPhrase: restoreConfirm,
      });
      toast(r.data?.message ?? r.message ?? "Restore completed", "success");
      setRestoreId(null);
      setRestoreConfirm("");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setRestoring(false);
    }
  };

  if (loading || !policy || !hub) {
    return (
      <div className="flex justify-center py-24 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading backup settings…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <DatabaseBackup size={22} className="text-blue-600" />
            Backup & restore
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Full-platform snapshots: PostgreSQL database and uploaded files. Store archives on this server; download for off-site DR.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm inline-flex items-center gap-1 shrink-0"
          onClick={() => loadHub().then(() => toast("Refreshed", "success")).catch((e) => toast(e.message, "error"))}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {!hub.summary.pgDumpAvailable && (
        <div className={`${CARD} p-4 border-amber-200 bg-amber-50 flex gap-3`}>
          <AlertTriangle className="text-amber-600 shrink-0" size={20} />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Database backup tools not detected</p>
            <p className="mt-1 text-amber-800">
              Install PostgreSQL client tools (<code className="text-xs">pg_dump</code>, <code className="text-xs">psql</code>) on the VPS and ensure <code className="text-xs">DATABASE_URL</code> is set. Uploads-only backups still work.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Snapshots", value: hub.summary.totalSnapshots, icon: HardDrive },
          { label: "Completed", value: hub.summary.completed, icon: CheckCircle2, tone: "text-emerald-600" },
          { label: "Storage used", value: hub.summary.totalStorageHuman, icon: Database },
          { label: "Last success", value: hub.summary.lastSuccessAt ? formatDate(hub.summary.lastSuccessAt) : "Never", icon: Clock, small: true },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <s.icon size={12} /> {s.label}
            </p>
            <p className={`mt-1 font-bold text-slate-900 ${s.small ? "text-sm" : "text-2xl"} ${s.tone ?? ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${CARD} p-5 space-y-4`}>
          <h2 className="text-sm font-semibold text-slate-900">Backup policy</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={policy.scheduleEnabled}
              onChange={(e) => setPolicy({ ...policy, scheduleEnabled: e.target.checked })}
            />
            Enable scheduled backups (runs hourly check at UTC hour above)
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Frequency</label>
              <select
                className="input text-sm mt-1 w-full"
                value={policy.scheduleFrequency}
                onChange={(e) => setPolicy({ ...policy, scheduleFrequency: e.target.value as "daily" | "weekly" })}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Hour (UTC)</label>
              <input
                type="number"
                min={0}
                max={23}
                className="input text-sm mt-1 w-full"
                value={policy.scheduleHourUtc}
                onChange={(e) => setPolicy({ ...policy, scheduleHourUtc: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Retention (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                className="input text-sm mt-1 w-full"
                value={policy.retentionDays}
                onChange={(e) => setPolicy({ ...policy, retentionDays: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Notify email</label>
              <input
                type="email"
                className="input text-sm mt-1 w-full"
                placeholder="ops@school.com"
                value={policy.notifyEmail}
                onChange={(e) => setPolicy({ ...policy, notifyEmail: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policy.includeDatabase}
                onChange={(e) => setPolicy({ ...policy, includeDatabase: e.target.checked })}
              />
              <Database size={14} /> PostgreSQL
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={policy.includeUploads}
                onChange={(e) => setPolicy({ ...policy, includeUploads: e.target.checked })}
              />
              <FolderArchive size={14} /> Uploads volume
            </label>
          </div>
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Off-site copy (S3)</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={policy.offsiteEnabled}
                onChange={(e) => setPolicy({ ...policy, offsiteEnabled: e.target.checked })}
              />
              Upload completed backups to S3-compatible storage
            </label>
            <p className="text-xs text-slate-500">
              Prefer env vars <code className="text-[11px]">BACKUP_S3_ACCESS_KEY_ID</code> /{" "}
              <code className="text-[11px]">BACKUP_S3_SECRET_ACCESS_KEY</code> on the server; or save keys below.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                className="input text-sm"
                placeholder="Bucket"
                value={policy.s3Bucket}
                onChange={(e) => setPolicy({ ...policy, s3Bucket: e.target.value })}
              />
              <input
                className="input text-sm"
                placeholder="Region"
                value={policy.s3Region}
                onChange={(e) => setPolicy({ ...policy, s3Region: e.target.value })}
              />
              <input
                className="input text-sm sm:col-span-2"
                placeholder="Prefix (folder)"
                value={policy.s3Prefix}
                onChange={(e) => setPolicy({ ...policy, s3Prefix: e.target.value })}
              />
              <input
                className="input text-sm sm:col-span-2"
                placeholder="Custom endpoint (MinIO / DigitalOcean — optional)"
                value={policy.s3Endpoint}
                onChange={(e) => setPolicy({ ...policy, s3Endpoint: e.target.value })}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn-primary text-sm inline-flex items-center gap-1"
            disabled={savingPolicy}
            onClick={savePolicy}
          >
            {savingPolicy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save policy
          </button>
        </div>

        <div className={`${CARD} p-5 space-y-4`}>
          <h2 className="text-sm font-semibold text-slate-900">Run backup now</h2>
          <p className="text-sm text-slate-600">
            Queues a background job: <code className="text-xs bg-slate-100 px-1 rounded">pg_dump</code> + uploads archive → single <code className="text-xs bg-slate-100 px-1 rounded">.tar.gz</code> under <code className="text-xs bg-slate-100 px-1 rounded">uploads/backups/</code>.
          </p>
          <ul className="text-xs text-slate-500 space-y-1">
            <li>• Retention policy auto-deletes snapshots older than {policy.retentionDays} days</li>
            <li>• Large databases may take several minutes</li>
            <li>• Monitor progress in <Link to="/platform/system/queue" className="text-blue-600 hover:underline">Job Queue</Link></li>
          </ul>
          <button
            type="button"
            className="btn-primary text-sm inline-flex items-center gap-2"
            disabled={runningBackup || hub.summary.running > 0 || (!policy.includeUploads && !policy.includeDatabase)}
            onClick={runBackup}
          >
            {runningBackup ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Create backup now
          </button>
        </div>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Backup snapshots</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50 border-b">
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hub.snapshots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    No backups yet. Run your first snapshot above.
                  </td>
                </tr>
              ) : (
                hub.snapshots.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.label}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {row.includesDatabase && "DB "}
                      {row.includesUploads && "Files"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.status === "completed" ? row.sizeHuman : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                      {row.error && (
                        <p className="text-[10px] text-rose-600 mt-0.5 max-w-[200px] truncate" title={row.error}>
                          {row.error}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {row.status === "completed" && (
                          <>
                            <button
                              type="button"
                              title="Download"
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                              onClick={() => downloadSnapshot(row.id)}
                            >
                              <Download size={16} />
                            </button>
                            <button
                              type="button"
                              title="Restore"
                              className="p-1.5 rounded hover:bg-amber-50 text-amber-700"
                              onClick={() => {
                                setRestoreId(row.id);
                                setRestoreConfirm("");
                              }}
                            >
                              <RotateCcw size={16} />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          title="Delete"
                          className="p-1.5 rounded hover:bg-rose-50 text-rose-600"
                          disabled={deletingId === row.id}
                          onClick={() => deleteSnapshot(row.id)}
                        >
                          {deletingId === row.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {restoreId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Close" onClick={() => setRestoreId(null)} />
          <div className={`${CARD} relative max-w-md w-full p-6 space-y-4 border-rose-200`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-rose-600 shrink-0" size={24} />
              <div>
                <h3 className="font-bold text-slate-900">Restore platform backup</h3>
                <p className="text-sm text-slate-600 mt-1">
                  This overwrites the current database and uploads folder. All schools will see restored data. Consider creating a fresh backup first.
                </p>
              </div>
            </div>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Type <code className="bg-slate-100 px-1 rounded">RESTORE</code> to confirm</span>
              <input
                className="input mt-2 w-full font-mono"
                value={restoreConfirm}
                onChange={(e) => setRestoreConfirm(e.target.value)}
                placeholder="RESTORE"
                autoComplete="off"
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary text-sm" onClick={() => setRestoreId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary text-sm bg-rose-600 hover:bg-rose-700 border-rose-600"
                disabled={restoring || restoreConfirm !== "RESTORE"}
                onClick={restoreSnapshot}
              >
                {restoring ? <Loader2 size={14} className="animate-spin" /> : "Restore now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
