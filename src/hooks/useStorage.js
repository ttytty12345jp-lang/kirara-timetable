import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "kirara_timetable_data";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

export function useStorage() {
  const [data, setData] = useState(() => loadData());
  const [loading, setLoading] = useState(false);

  const saveRecord = useCallback((record) => {
    setData(prev => {
      let updated;
      // Config records: match by config_key
      if (record.config_key) {
        const idx = prev.findIndex(r => r.config_key === record.config_key);
        if (idx >= 0) {
          updated = [...prev];
          updated[idx] = { ...record, id: prev[idx].id };
        } else {
          updated = [...prev, { ...record, id: crypto.randomUUID() }];
        }
      }
      // Template records: match by day+class+period
      else if (record.class_name === "DAY_TEMPLATE") {
        const idx = prev.findIndex(r =>
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
      }
      // Normal timetable records: match by date+class+period
      else {
        const idx = prev.findIndex(r =>
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
      saveData(updated);
      return updated;
    });
  }, []);

  const saveMultiple = useCallback((records) => {
    setData(prev => {
      let updated = [...prev];
      for (const record of records) {
        if (record.class_name === "DAY_TEMPLATE") {
          const idx = updated.findIndex(r =>
            r.class_name === "DAY_TEMPLATE" &&
            r.day_template_day === record.day_template_day &&
            r.day_template_class === record.day_template_class &&
            r.day_template_period === record.day_template_period
          );
          if (idx >= 0) {
            updated[idx] = { ...record, id: updated[idx].id };
          } else {
            updated.push({ ...record, id: crypto.randomUUID() });
          }
        } else if (record.config_key) {
          const idx = updated.findIndex(r => r.config_key === record.config_key);
          if (idx >= 0) {
            updated[idx] = { ...record, id: updated[idx].id };
          } else {
            updated.push({ ...record, id: crypto.randomUUID() });
          }
        } else {
          const idx = updated.findIndex(r =>
            r.date === record.date &&
            r.class_name === record.class_name &&
            r.period === record.period
          );
          if (idx >= 0) {
            updated[idx] = { ...record, id: updated[idx].id };
          } else {
            updated.push({ ...record, id: crypto.randomUUID() });
          }
        }
      }
      saveData(updated);
      return updated;
    });
  }, []);

  const deleteRecord = useCallback((predicate) => {
    setData(prev => {
      const updated = prev.filter(r => !predicate(r));
      saveData(updated);
      return updated;
    });
  }, []);

  return { data, saveRecord, saveMultiple, deleteRecord, loading };
}
