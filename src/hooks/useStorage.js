import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { getDateString, getDayOfWeek } from "../utils/constants";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || "";
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

function upsertLocal(prev, record) {
  let idx = -1;
  if (record.config_key) {
    idx = prev.findIndex(r => r.config_key === record.config_key);
  } else if (record.class_name === "DAY_TEMPLATE") {
    idx = prev.findIndex(r =>
      r.class_name          === "DAY_TEMPLATE" &&
      r.day_template_day    === record.day_template_day &&
      r.day_template_class  === record.day_template_class &&
      r.day_template_period === record.day_template_period &&
      (r.day_template_from  || "") === (record.day_template_from || "")
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
      .eq("day_template_period", record.day_template_period)
      .eq("day_template_from",   record.day_template_from || "");
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
  const initialLoadDone       = useRef(false);

  useEffect(() => {
    if (USE_SUPABASE) {
      loadInitial();
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
        () => { loadAll(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // 初回描画用の絞り込みロード（Phase A）→ 全件バックグラウンドロード（Phase B）
  async function loadInitial() {
    setLoading(true);
    try {
      const today   = getDateString(new Date());
      const weekday = getDayOfWeek(today); // "月"〜"日"
      // インデックスの効く条件のみで初回描画に必要な数百件を1クエリで取得
      const orFilter = [
        "config_key.not.is.null",
        `date.eq.${today}`,
      ];
      const { data: records, error } = await supabase
        .from("timetable")
        .select("*")
        .or(orFilter.join(","));

      if (error) throw error;

      let firstPaint = records || [];
      // 平日は今日の曜日のテンプレートも取得（週末は不要）
      if (["月", "火", "水", "木", "金"].includes(weekday)) {
        const { data: tpl, error: tErr } = await supabase
          .from("timetable")
          .select("*")
          .eq("class_name", "DAY_TEMPLATE")
          .eq("day_template_day", weekday);
        if (tErr) throw tErr;
        firstPaint = firstPaint.concat(tpl || []);
      }

      setData(firstPaint);
    } catch (err) {
      console.error("❌ Supabase initial load error:", err);
    } finally {
      // Phase A で描画済み。以降 loadAll は setLoading を触らない
      initialLoadDone.current = true;
      setLoading(false);
    }
    // 描画をブロックせず全件を裏で取得
    loadAll();
  }

  // 全件ページネーション取得（Phase B / realtime 再取得）
  async function loadAll() {
    if (!initialLoadDone.current) setLoading(true);
    try {
      // ★ 1000件上限を回避するため range で全件取得
      let allRecords = [];
      let from = 0;
      const PAGE = 1000;

      while (true) {
        const { data: records, error } = await supabase
          .from("timetable")
          .select("*")
          .order("created_at", { ascending: true })
          .range(from, from + PAGE - 1);

        if (error) throw error;
        if (!records || records.length === 0) break;

        allRecords = allRecords.concat(records);
        if (records.length < PAGE) break; // 最終ページ
        from += PAGE;
      }

      setData(allRecords);
    } catch (err) {
      console.error("❌ Supabase load error:", err);
      if (!initialLoadDone.current) setData([]);
    } finally {
      initialLoadDone.current = true;
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

    // 先にローカル state を更新してフラッシュを防ぐ
    setData(prev => upsertLocal(prev, record));

    try {
      const existing = await findExisting(record);
      if (existing) {
        const { error } = await supabase
          .from("timetable")
          .update(record)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("timetable")
          .insert([record]);
        if (error) throw error;
      }
    } catch (err) {
      console.error("❌ Supabase save error:", err, JSON.stringify(record));
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
    // setData の関数形式で最新の data を参照し、data への依存を除去
    setData(prev => {
      const ids = prev.filter(predicate).map(r => r.id);
      if (ids.length > 0) {
        supabase.from("timetable").delete().in("id", ids)
          .then(({ error }) => {
            if (error) console.error("❌ Supabase delete error:", error);
          });
      }
      return prev.filter(r => !predicate(r));
    });
  }, []);

  return { data, saveRecord, deleteRecord, loading };
}