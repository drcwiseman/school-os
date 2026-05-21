import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";

export function useAcademicsLookups() {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolSlug) return;
    Promise.all([
      api.get(`/s/${schoolSlug}/api/academics/classes`),
      api.get(`/s/${schoolSlug}/api/academics/subjects`),
    ])
      .then(([c, s]) => {
        setClasses(c.data ?? []);
        setSubjects(s.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  return { classes, subjects, loading, schoolSlug };
}
