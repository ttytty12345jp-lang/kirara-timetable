import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

let supabase = null;
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

if (USE_SUPABASE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const STORAGE_KEY = "kirara_timetable_data";

function loadDataLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveDataLocal(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) { console.error("Storage error:", e); }
}

export function useStorage() {
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(true);

  // 初回ロード
  useEffect(() => {
    if (USE_SUPABASE) {
      loadFromSupabase();
    } else {
      setData(loadDataLocal());
      setLoading(false);
    }
  }, []);

  // リアルタイム購読
  useEffect(() => {
    if (!USE_SUPABASE) return;
    const channel = supabase
      .channel("timetable_changes")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "timetable" },
        () => { loadFromSupabase(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadFromSupabase() {
    setLoading(true);
    try {
      const { data: records, error } = await supabase
        .from("timetable")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setData(records || []);
    } catch (err) {
      console.error("Supabase load error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  const saveRecord = useCallback(async (record) => {
    if (!USE_SUPABASE) {
      // ===== localStorage =====
      setData(prev => {
        const updated = upsertLocal(prev, record);
        saveDataLocal(updated);
        return updated;
      });
      return;
    }

    // ===== Supabase =====
    try {
      const existing = await findExisting(record);
      if (existing) {
        await supabase.from("timetable").update(record).eq("id", existing.id);
      } else {
        await supabase.from("timetable").insert([record]);
      }
    } catch (err) {
      console.error("Supabase save error:", err);
    }
  }, []);

  const deleteRecord = useCallback(async (predicate) => {
    if (!USE_SUPABASE) {
      setData(prev => {
        const updated = prev.filter(r => !predicate(r));
        saveDataLocal(updated);
        return updated;
      });
      return;
    }
    try {
      const toDelete = data.filter(predicate);
      const ids = toDelete.map(r => r.id);
      if (ids.length > 0) {
        await supabase.from("timetable").delete().in("id", ids);
      }
    } catch (err) {
      console.error("Supabase delete error:", err);
    }
  }, [data]);

  return { data, saveRecord, deleteRecord, loading };
}

// ===== ヘルパー =====

function upsertLocal(prev, record) {
  let idx = -1;

  if (record.config_key) {
    idx = prev.findIndex(r => r.config_key === record.config_key);
  } else if (record.class_name === "DAY_TEMPLATE") {
    idx = prev.findIndex(r =>
      r.class_name          === "DAY_TEMPLATE" &&
      r.day_template_day    === record.day_template_day &&
      r.day_template_class  === record.day_template_class &&
      r.day_template_period === record.day_template_period
    );
  } else {
    idx = prev.findIndex(r =>
      r.date       === record.date &&
      r.class_name === record.class_name &&
      r.period     === record.period
    );
  }

  if (idx >= 0) {
    const updated = [...prev];
    updated[idx] = { ...record, id: prev[idx].id };
    return updated;
  }
  return [...prev, { ...record, id: crypto.randomUUID() }];
}

async function findExisting(record) {
  let query = supabase.from("timetable").select("id");

  if (record.config_key) {
    query = query.eq("config_key", record.config_key);
  } else if (record.class_name === "DAY_TEMPLATE") {
    query = query
      .eq("class_name",          "DAY_TEMPLATE")
      .eq("day_template_day",    record.day_template_day)
      .eq("day_template_class",  record.day_template_class)
      .eq("day_template_period", record.day_template_period);
  } else {
    query = query
      .eq("date",       record.date)
      .eq("class_name", record.class_name)
      .eq("period",     record.period);
  }

  const { data } = await query.maybeSingle();
  return data;
}