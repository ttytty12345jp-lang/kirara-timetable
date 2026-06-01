console.log("🚀 App loaded - " + new Date().toISOString());
console.log("ENV:", import.meta.env);

import { useState, useEffect, useCallback, useRef } from "react";
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
  // ⚡ デフォルトの今日の日付を最優先で瞬時にセット
  const [selectedDate, setSelectedDate] = useState(() => getDateString(new Date()));
  const [toast, setToast] = useState(null);
  const { data, saveRecord, deleteRecord, loading } = useStorage();

  // ==========================================
  // 💡 メモ用の処理（日付バグ対策・安全同期版）
  // ==========================================
  const memoConfigKey = `memo_${selectedDate}`;
  const memoRecord = Array.isArray(data) ? data.find(r => r.config_key === memoConfigKey) : null;
  const serverMemo = memoRecord?.config_value || "";

  const [localMemo, setLocalMemo] = useState("");
  const syncTimeoutRef = useRef(null);

  // サーバーのデータが変わるか、日付が変わったらローカルの入力欄を更新
  useEffect(() => {
    // タイマーが走っていたらクリア
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    setLocalMemo(serverMemo);
  }, [serverMemo, selectedDate]);

  // 大元のsaveRecordを叩く純粋な保存関数
  const saveMemoData = useCallback(async (text, dateToSave) => {
    const key = `memo_${dateToSave}`;
    const currentRecord = Array.isArray(data) ? data.find(r => r.config_key === key) : null;
    if (text.trim() === (currentRecord?.config_value || "").trim()) return;

    const memoData = {
      id: currentRecord?.id || undefined,
      config_key: key,
      config_value: text,
      date: dateToSave,
      class_name: "CONFIG"
    };
    await saveRecord(memoData);
  }, [data, saveRecord]);

  // 文字が入力されたときの処理
  const handleMemoChange = (e) => {
    const nextText = e.target.value;
    setLocalMemo(nextText);

    // タイマーが既存ならリセット（文字入力中の連続通信を強力にブロック！）
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    // 入力が止まってから 0.8秒 後に自動で裏保存を予約（日付変更を絶対に邪魔しません）
    syncTimeoutRef.current = setTimeout(() => {
      saveMemoData(nextText, selectedDate);
    }, 800);
  };

  // 別の場所がタップされた際も念のため保存（タイマーをクリアして即時実行）
  const handleMemoBlur = () => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    saveMemoData(localMemo, selectedDate);
  };

  // ⚡【超重要】日付が変更されるときの安全処理
  const handleDateChange = (newDate) => {
    // 日付が切り替わる「直前」に、今打っていた文字を現在の選択中日付に対して強制保存
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    saveMemoData(localMemo, selectedDate);
    
    // その後、即座に日付を切り替える（これで進まないバグや2日前に行くバグが消滅します）
    setSelectedDate(newDate);
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // ==========================================
  // 既存の共通処理
  // ==========================================
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const dayOfWeek = getDayOfWeek(selectedDate);

  const getDayData = useCallback((date) => {
    if (!data || !Array.isArray(data)) return [];
    return data.filter(r => r.date === date && r.class_name && !r.config_key && r.class_name !== "DAY_TEMPLATE");
  }, [data]);

  const getTemplateData = useCallback((day, className) => {
    if (!data || !Array.isArray(data)) return [];
    return data.filter(r =>
      r.class_name === "DAY_TEMPLATE" &&
      r.day_template_day === day &&
      r.day_template_class === className
    );
  }, [data]);

  const getConfig = useCallback((key) => {
    if (!data || !Array.isArray(data)) return null;
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
        {/* 日付選択欄（安全な日付変更関数を適用） */}
        <DatePicker
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          dayOfWeek={dayOfWeek}
        />
        
        {/* メモ欄（入力中と日付変更時のバッティングを完全回避） */}
        <div className="memo-section">
          <textarea 
            className="memo-textarea" 
            placeholder="連絡事項やメモを自由に入力できます..."
            rows={2}
            value={localMemo}
            onChange={handleMemoChange}
            onBlur={handleMemoBlur}
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