import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const STATE_ORDER = [
  "Lagos",
  "Abuja (FCT)",
  "Rivers",
  "Oyo",
  "Kano",
  "Delta",
  "Akwa Ibom",
  "Imo",
  "Ogun",
  "Anambra",
  "Abia",
  "Adamawa",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Jigawa",
  "Kaduna",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Nasarawa",
  "Niger",
  "Ondo",
  "Osun",
  "Plateau",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

const FCT_ALIASES = new Set([
  "abuja",
  "fct",
  "abuja fct",
  "federal capital territory",
]);

function normalizeName(input: string) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function displayName(input: string) {
  const norm = normalizeName(input);
  if (FCT_ALIASES.has(norm)) return "Abuja (FCT)";
  return input;
}

const STATE_RANK: Record<string, number> = STATE_ORDER.reduce((acc, name, idx) => {
  acc[normalizeName(name)] = idx;
  return acc;
}, {} as Record<string, number>);

export function useStates() {
  const [states, setStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from("states").select("id, name");
        if (!alive) return;
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        const sorted = rows
          .map((row) => ({
            ...row,
            __name: String((row as any)?.name ?? ""),
          }))
          .sort((a, b) => {
            const aNorm = normalizeName(a.__name);
            const bNorm = normalizeName(b.__name);
            const aRank = STATE_RANK[aNorm];
            const bRank = STATE_RANK[bNorm];
            const aHas = Number.isFinite(aRank);
            const bHas = Number.isFinite(bRank);

            if (aHas && bHas) return (aRank as number) - (bRank as number);
            if (aHas && !bHas) return -1;
            if (!aHas && bHas) return 1;
            return aNorm.localeCompare(bNorm);
          })
          .map((row) => ({
            ...row,
            name: displayName(String((row as any)?.name ?? "")),
          }));
        // Sanity check: Lagos, Abuja (FCT), Rivers, Oyo, Kano, Delta, Akwa Ibom, Imo, Ogun, Anambra
        setStates(sorted);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setStates([]);
        setError(e?.message || "Failed to load states");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { states, loading, error };
}

export default useStates;
