import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";

type YearRow = { id: string; name: string };
type TermRow = { id: string; name: string; academicYearId: string };

export function useAcademicsLookups() {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string }[]>([]);
  const [years, setYears] = useState<YearRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolSlug) return;
    api.get(`/s/${schoolSlug}/api/academics/context`)
      .then((r) => {
        const d = r.data ?? {};
        setClasses(d.classes ?? []);
        setSubjects(d.subjects ?? []);
        setYears(d.years ?? []);
        setTerms(d.terms ?? []);
        setError(null);
      })
      .catch((err: any) => {
        setError(err.message ?? "Could not load academics data");
        setClasses([]);
        setSubjects([]);
        setYears([]);
        setTerms([]);
      })
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  return { classes, subjects, years, terms, loading, error, schoolSlug };
}
