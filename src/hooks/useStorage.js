import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

let supabase = null;
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

if (USE_SUPABASE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("✅ Supabase有効");
} else {
  console.warn("⚠️ Supabase未設定 → localStorageモード");
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
  const { data, error } = await query.maybeSingle();
  if (error) console.error("❌ findExisting error:", error);
  return data;
}

export function useStorage() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_SUPABASE) {
      loadFromSupabase();
    } else {
      setData(loadDataLocal());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!USE_SUPABASE) return;
    const channel = supabase
      .channel("timetable_changes")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "timetable" },
        (payload) => {
          console.log("📡 リアルタイム受信:", payload.eventType);
          loadFromSupabase();
        }
      )
      .subscribe((status) => {
        console.log("📡 購読ステータス:", status);
      });
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
      console.log("📥 ロード件数:", records?.length);
      setData(records || []);
    } catch (err) {
      console.error("❌ Supabase load error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  const saveRecord = useCallback(async (record) => {
    if (!USE_SUPABASE) {
      setData(prev => {
        const updated = upsertLocal(prev, record);
        saveDataLocal(updated);
        return updated;
      });
      return;
    }

    // ★ 送信内容をすべてログ出力
    console.log("💾 saveRecord:", JSON.stringify(record));

    try {
      const existing = await findExisting(record);
      console.log("🔍 existing:", existing ? existing.id : "なし（INSERT）");

      if (existing) {
        const { error } = await supabase
          .from("timetable")
          .update(record)
          .eq("id", existing.id);
        if (error) {
          console.error("❌ UPDATE失敗:", error, "record:", JSON.stringify(record));
        } else {
          console.log("✅ UPDATE成功:", record.class_name, record.period);
        }
      } else {
        const { error } = await supabase
          .from("timetable")
          .insert([record]);
        if (error) {
          console.error("❌ INSERT失敗:", error, "record:", JSON.stringify(record));
        } else {
          console.log("✅ INSERT成功:", record.class_name, record.period);
        }
      }
    } catch (err) {
      console.error("❌ saveRecord例外:", err, "record:", JSON.stringify(record));
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
      console.log("🗑 削除件数:", ids.length);
      if (ids.length > 0) {
        const { error } = await supabase
          .from("timetable").delete().in("id", ids);
        if (error) console.error("❌ DELETE失敗:", error);
      }
    } catch (err) {
      console.error("❌ deleteRecord例外:", err);
    }
  }, [data]);

  return { data, saveRecord, deleteRecord, loading };
}