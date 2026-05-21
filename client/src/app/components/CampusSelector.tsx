import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";

const STORAGE_KEY = "schoolos_campus_id";

export const CampusSelector: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { moduleEnabled } = useAuth();
  const [campuses, setCampuses] = useState<{ id: string; name: string }[]>([]);
  const [campusId, setCampusId] = useState(localStorage.getItem(STORAGE_KEY) ?? "");

  useEffect(() => {
    if (!moduleEnabled("multi_campus") || !schoolSlug) return;
    api.get(`/s/${schoolSlug}/api/campuses`).then((r) => setCampuses(r.data ?? [])).catch(() => {});
  }, [schoolSlug, moduleEnabled]);

  if (!moduleEnabled("multi_campus") || campuses.length === 0) return null;

  return (
    <select
      className="input max-w-xs mb-4"
      value={campusId}
      onChange={(e) => {
        setCampusId(e.target.value);
        if (e.target.value) localStorage.setItem(STORAGE_KEY, e.target.value);
        else localStorage.removeItem(STORAGE_KEY);
      }}
    >
      <option value="">All campuses</option>
      {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
};
