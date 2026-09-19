import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export function useHousekeepingNotes(
  propertyId: number,
  day: string,
  live: boolean,
) {
  const [notes, setNotes] = useState("");
  const [defects, setDefects] = useState("");
  const [saved, setSaved] = useState({ notes: "", defects: "" });
  const [loading, setLoading] = useState(live);
  const [ready, setReady] = useState(!live);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const id = ++generation.current;
    setNotes("");
    setDefects("");
    setSaved({ notes: "", defects: "" });
    setError("");
    setMessage("");
    setLoading(live);
    setReady(!live);
    if (!live || !supabase) return;
    Promise.resolve(
      supabase
        .from("housekeeping_notes")
        .select("notes,defects")
        .eq("property_id", propertyId)
        .eq("business_date", day)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (id !== generation.current) return;
        if (error) setError("메모 조회 실패: " + error.message);
        else {
          const value = data ?? { notes: "", defects: "" };
          setNotes(value.notes);
          setDefects(value.defects);
          setSaved(value);
          setReady(true);
        }
        setLoading(false);
      })
      .catch(() => {
        if (id === generation.current) {
          setError("메모를 불러오지 못했습니다.");
          setLoading(false);
        }
      });
    return () => {
      generation.current++;
    };
  }, [propertyId, day, live, revision]);
  async function save() {
    if (!live || !supabase || !ready || loading || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    const id = generation.current;
    try {
      const { error } = await supabase.rpc("pms_save_housekeeping_notes", {
        p_property_id: propertyId,
        p_business_date: day,
        p_notes: notes,
        p_defects: defects,
      });
      if (error) throw error;
      if (id === generation.current) {
        setSaved({ notes, defects });
        setMessage("메모를 저장했습니다.");
      }
    } catch (e) {
      if (id === generation.current)
        setError(
          e && typeof e === "object" && "message" in e
            ? String(e.message)
            : "저장에 실패했습니다.",
        );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return {
    notes,
    defects,
    setNotes,
    setDefects,
    ready,
    loading,
    saving,
    error,
    message,
    save,
    dirty: notes !== saved.notes || defects !== saved.defects,
    reload: () => setRevision((v) => v + 1),
  };
}
