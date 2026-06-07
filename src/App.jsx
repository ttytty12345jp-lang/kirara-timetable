import { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import DatePicker from "./components/DatePicker";
import TimetableGrid from "./components/TimetableGrid";
import SettingsSection from "./components/SettingsSection";
import Toast from "./components/Toast";
import { useStorage } from "./hooks/useStorage";
import {
  CLASSES, DEFAULT_SUBJECTS, DEFAULT_TEACHERS,
  DEFAULT_SPECIAL_SUBJECTS, getDateString, getDayOfWeek
} from "./utils/constants";

export default function App() {
  const [selectedDate, setSelectedDate] = useState(getDateString(new Date()));
  const [toast, setToast] = useState(null);
  const { data, saveRecord, deleteRecord, loading } = useStorage();

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const dayOfWeek = getDayOfWeek(selectedDate);

  function getDayData(date) {
    return data.filter(r =>
      r.date === date && r.class_name && !r.config_key && r.class_name !== "DAY_TEMPLATE"
    );
  }

  function getTemplateData(day, className) {
    return data.filter(r =>
      r.class_name === "DAY_TEMPLATE" &&
      r.day_template_day === day &&
      r.day_template_class === className
    );
  }

  function getConfig(key) {
    const rec = data.find(r => r.config_key === key);
    return rec?.config_value || null;
  }

  const subjects        = (getConfig("subjects_list")   || DEFAULT_SUBJECTS.join(",")).split(",").filter(Boolean);
  const teachers        = (getConfig("teachers_list")   || DEFAULT_TEACHERS.join(",")).split(",").filter(Boolean);
  const specialSubjects = (getConfig("special_subject") || DEFAULT_SPECIAL_SUBJECTS.join(",")).split(",").filter(Boolean);

  // メモ: 日付ごとに config_key = "memo_{date}" で保存
  const memoKey   = `memo_${selectedDate}`;
  const memoValue = getConfig(memoKey) || "";

  function handleMemoChange(value) {
    saveRecord({ config_key: memoKey, config_value: value });
  }

  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <DatePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          dayOfWeek={dayOfWeek}
        />

        <MemoSection
          value={memoValue}
          onChange={handleMemoChange}
          selectedDate={selectedDate}
        />

        <TimetableGrid
          selectedDate={selectedDate}
          dayOfWeek={dayOfWeek}
          dayData={getDayData(selectedDate)}
          getTemplateData={getTemplateData}
          subjects={subjects}
          teachers={teachers}
          specialSubjects={specialSubjects}
          onSave={saveRecord}
          onShowToast={showToast}
          allData={data}
        />

        <SettingsSection
          subjects={subjects}
          teachers={teachers}
          specialSubjects={specialSubjects}
          getTemplateData={getTemplateData}
          onSave={saveRecord}
          onDelete={deleteRecord}
          onShowToast={showToast}
          selectedDate={selectedDate}
          dayData={getDayData(selectedDate)}
          allData={data}
        />
      </main>
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}

// メモコンポーネント（デバウンス付き自動保存）
function MemoSection({ value, onChange, selectedDate }) {
  const [localValue, setLocalValue] = useState(value);

  // 日付が変わったらローカル値を更新
  useEffect(() => {
    setLocalValue(value);
  }, [selectedDate, value]);

  // 入力が止まって800ms後に自動保存
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localValue]);

  return (
    <section className="memo-section">
      <textarea
        className="memo-textarea"
        placeholder="メモ・連絡事項など（自動保存されます）"
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        rows={2}
      />
    </section>
  );
}