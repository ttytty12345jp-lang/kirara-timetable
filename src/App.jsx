import { useState, useEffect, useCallback, useRef } from "react";
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
// 非制御コンポーネント：React が textarea.value を強制セットしないので IME 変換が壊れない
function MemoSection({ value, onChange, selectedDate }) {
  const textareaRef  = useRef(null);
  const isComposing  = useRef(false);
  const savedValue   = useRef(value);
  const timerRef     = useRef(null);

  // 日付が変わったときだけ textarea の内容を外部値でリセット
  useEffect(() => {
    savedValue.current = value;
    if (textareaRef.current) textareaRef.current.value = value;
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleSave(text) {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (text !== savedValue.current) {
        savedValue.current = text;
        onChange(text);
      }
    }, 800);
  }

  return (
    <section className="memo-section">
      <textarea
        ref={textareaRef}
        className="memo-textarea"
        placeholder="メモ・連絡事項など（自動保存されます）"
        defaultValue={value}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={e => {
          isComposing.current = false;
          scheduleSave(e.target.value);
        }}
        onChange={e => {
          if (!isComposing.current) scheduleSave(e.target.value);
        }}
        rows={2}
      />
    </section>
  );
}