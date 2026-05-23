import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

console.log("🔧 Supabase Config:", {
  url: SUPABASE_URL,
  keyLength: SUPABASE_ANON_KEY.length,
  enabled: !!(SUPABASE_URL && SUPABASE_ANON_KEY)
});

let supabase = null;
const USE_SUPABASE = SUPABASE_URL && SUPABASE_ANON_KEY;

if (USE_SUPABASE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("✅ Supabase client created");
} else {
  console.warn("⚠️ Supabase not configured, using localStorage");
}

const STORAGE_KEY = "kirara_timetable_data";

function loadDataLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDataLocal(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

export function useStorage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_SUPABASE) {
      console.log("📥 Loading data from Supabase...");
      loadFromSupabase();
    } else {
      setData(loadDataLocal());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!USE_SUPABASE) return;

    console.log("🔴 Starting Supabase realtime subscription...");

    const channel = supabase
      .channel("timetable_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "timetable" },
        (payload) => {
          console.log("✅ Realtime event received:", payload.eventType, payload);
          loadFromSupabase();
        }
      )
      .subscribe((status) => {
        console.log("📡 Subscription status:", status);
      });

    return () => {
      console.log("🔴 Cleaning up realtime subscription");
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadFromSupabase() {
    setLoading(true);
    try {
      console.log("📥 Fetching from Supabase...");
      const { data: records, error } = await supabase
        .from("timetable")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("❌ Supabase load error:", error);
        throw error;
      }
      console.log("✅ Loaded records:", records?.length || 0);
      setData(records || []);
    } catch (err) {
      console.error("❌ Load failed:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  const saveRecord = useCallback(async (record) => {
    if (!USE_SUPABASE) {
      setData((prev) => {
        let updated;
        if (record.config_key) {
          const idx = prev.findIndex((r) => r.config_key === record.config_key);
          if (idx >= 0) {
            updated = [...prev];
            updated[idx] = { ...record, id: prev[idx].id };
          } else {
            updated = [...prev, { ...record, id: crypto.randomUUID() }];
          }
        } else if (record.class_name === "DAY_TEMPLATE") {
          const idx = prev.findIndex(
            (r) =>
              r.class_name === "DAY_TEMPLATE" &&
              r.day_template_day === record.day_template_day &&
              r.day_template_class === record.day_template_class &&
              r.day_template_period === record.day_template_period
          );
          if (idx >= 0) {
            updated = [...prev];
            updated[idx] = { ...record, id: prev[idx].id };
          } else {
            updated = [...prev, { ...record, id: crypto.randomUUID() }];
          }
        } else {
          const idx = prev.findIndex(
            (r) =>
              r.date === record.date &&
              r.class_name === record.class_name &&
              r.period === record.period
          );
          if (idx >= 0) {
            updated = [...prev];
            updated[idx] = { ...record, id: prev[idx].id };
          } else {
            updated = [...prev, { ...record, id: crypto.randomUUID() }];
          }
        }
        saveDataLocal(updated);
        return updated;
      });
      return;
    }

    try {
      console.log("💾 Saving to Supabase:", record);
      let existing = null;

      if (record.config_key) {
        const { data } = await supabase
          .from("timetable")
          .select("id")
          .eq("config_key", record.config_key)
          .maybeSingle();
        existing = data;
      } else if (record.class_name === "DAY_TEMPLATE") {
        const { data } = await supabase
          .from("timetable")
          .select("id")
          .eq("class_name", "DAY_TEMPLATE")
          .eq("day_template_day", record.day_template_day)
          .eq("day_template_class", record.day_template_class)
          .eq("day_template_period", record.day_template_period)
          .maybeSingle();
        existing = data;
      } else {
        const { data } = await supabase
          .from("timetable")
          .select("id")
          .eq("date", record.date)
          .eq("class_name", record.class_name)
          .eq("period", record.period)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        console.log("🔄 Updating existing record:", existing.id);
        const { error } = await supabase
          .from("timetable")
          .update(record)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        console.log("➕ Inserting new record");
        const { error } = await supabase.from("timetable").insert([record]);
        if (error) throw error;
      }
      console.log("✅ Save successful");
    } catch (err) {
      console.error("❌ Supabase save error:", err);
    }
  }, []);

  const deleteRecord = useCallback(async (predicate) => {
    if (!USE_SUPABASE) {
      setData((prev) => {
        const updated = prev.filter((r) => !predicate(r));
        saveDataLocal(updated);
        return updated;
      });
      return;
    }

    try {
      const toDelete = data.filter(predicate);
      const ids = toDelete.map((r) => r.id);
      console.log("🗑️ Deleting records:", ids);
      if (ids.length > 0) {
        const { error } = await supabase.from("timetable").delete().in("id", ids);
        if (error) throw error;
        console.log("✅ Delete successful");
      }
    } catch (err) {
      console.error("❌ Supabase delete error:", err);
    }
  }, [data]);

  return { data, saveRecord, deleteRecord, loading };
}