console.log("🚀 App loaded - " + new Date().toISOString());
console.log("ENV:", import.meta.env);

import { useState, useEffect, useCallback } from "react";
// ... 以下既存コード
// import { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import DatePicker from "./components/DatePicker";
import TimetableGrid from "./components/TimetableGrid";
import SettingsSection from "./components/SettingsSection";
import Toast from "./components/Toast";
import { useStorage } from "./hooks/useStorage";
import {
  CLASSES, PERIODS, DEFAULT_SUBJECTS, DEFAULT_TEACHERS,
  DEFAULT_SPECIAL_SUBJECTS, getDateString, getDayOfWeek
} from "./utils/constants";

export default function App() {
// 1. 日付の状態
  const [selectedDate, setSelectedDate] = useState(getDateString(new Date()));

  // 2. メモの状態（初期値は空にしておき、useEffectで読み込みます）
  const [memoText, setMemoText] = useState("");

  // 3. 【修正】日付が変わったら、その日のメモをlocalStorageから読み込む仕組み
  useEffect(() => {
    const savedMemo = localStorage.getItem(`kirara_memo_${selectedDate}`) || "";
    setMemoText(savedMemo);
  }, [selectedDate]);

  // 4. 【修正】文字が入力されたら、その日付専用のキーで自動保存する仕組み
  useEffect(() => {
    if (selectedDate) {
      localStorage.setItem(`kirara_memo_${selectedDate}`, memoText);
    }
  }, [memoText, selectedDate]);

  // 5. その他の既存の状態（トーストやストレージなど）
  const [toast, setToast] = useState(null);
  const { data, saveRecord, deleteRecord, loading } = useStorage();
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const dayOfWeek = getDayOfWeek(selectedDate);

  // Get current timetable data for selected date
  const getDayData = useCallback((date) => {
    return data.filter(r => r.date === date && r.class_name && !r.config_key && r.class_name !== "DAY_TEMPLATE");
  }, [data]);

  // Get template data for a day of week
  const getTemplateData = useCallback((day, className) => {
    return data.filter(r =>
      r.class_name === "DAY_TEMPLATE" &&
      r.day_template_day === day &&
      r.day_template_class === className
    );
  }, [data]);

  // Get config value
  const getConfig = useCallback((key) => {
    const rec = data.find(r => r.config_key === key);
    return rec?.config_value || null;
  }, [data]);

  const subjects = (getConfig("subjects_list") || DEFAULT_SUBJECTS.join(",")).split(",").filter(Boolean);
  const teachers = (getConfig("teachers_list") || DEFAULT_TEACHERS.join(",")).split(",").filter(Boolean);
  const specialSubjects = (getConfig("special_subject") || DEFAULT_SPECIAL_SUBJECTS.join(",")).split(",").filter(Boolean);

  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <DatePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          dayOfWeek={dayOfWeek}
        />
        <div className="memo-section">
         <textarea 
          className="memo-textarea" 
          placeholder="連絡事項やメモを自由に入力できます..."
          rows={2}
          value={memoText} // 状態と連動
          onChange={(e) => setMemoText(e.target.value)} // 文字が入力されたら状態を更新
        />
      </div> 
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
