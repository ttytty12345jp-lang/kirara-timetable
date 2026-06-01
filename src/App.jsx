console.log("🚀 App loaded - " + new Date().toISOString());
console.log("ENV:", import.meta.env);

import { useState, useEffect, useCallback } from "react";
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
  const [selectedDate, setSelectedDate] = useState(getDateString(new Date()));
  const [toast, setToast] = useState(null);
  const { data, saveRecord, deleteRecord, loading } = useStorage();

  // ==========================================
  // 💡 メモ用の処理（時間割データ構造・完全同期版）
  // ==========================================
  
  // 配列（data）の中から、現在の日付、かつ「config_key が memo_text」となっているレコードを探す
  const memoRecord = Array.isArray(data) 
    ? data.find(r => r.date === selectedDate && r.config_key === "memo_text") 
    : null;
    
  const serverMemo = memoRecord?.config_value || "";

  // 入力中の文字を一時的にキープするローカルな状態
  const [localMemo, setLocalMemo] = useState("");

  // 日付が変わったり、他端末（PC等）で保存されてサーバーデータが更新されたら、入力欄の文字を同期する
  useEffect(() => {
    setLocalMemo(serverMemo);
  }, [serverMemo, selectedDate]);

  // 【重要】時間割の保存システム（saveRecord）にメモも相乗りさせて保存する関数
  const handleSaveWithMemo = useCallback(async (date, recordData) => {
    // もし保存しようとしているデータが「時間割のデータ（配列など）」だった場合
    // そのデータとは別に、メモ用のレコードも同時に保存させる、またはデータ内に含めます
    
    // 1. まずは本来の時間割データをそのまま保存
    await saveRecord(date, recordData);

    // 2. 続いて、今画面に入力されているメモ欄のテキストも同じ日付でサーバーに保存
    const memoRecordToSave = {
      id: memoRecord?.id,               // 既存レコードがあればIDを引き継ぐ
      date: date,                       // 対象の日付
      config_key: "memo_text",          // メモ用の識別キー
      config_value: localMemo,          // 今入力されているテキスト
      class_name: "CONFIG"              // システム設定用タイプ
    };

    await saveRecord(date, memoRecordToSave);
  }, [saveRecord, memoRecord, localMemo]);

  // ==========================================
  // 既存の通知（トースト）関数
  // ==========================================
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // 曜日を取得する処理
  const dayOfWeek = getDayOfWeek(selectedDate);

  // ==========================================
  // 既存のデータ抽出・設定取得ヘルパー
  // ==========================================
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

  // ==========================================
  // 画面のレイアウト構成（HTML / JSX）
  // ==========================================
  return (
    <div className="app">
      <Header />
      <main className="main-content">
        {/* 日付選択 */}
        <DatePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          dayOfWeek={dayOfWeek}
        />
        
        {/* 日記型メモ欄（時間割の保存ボタンと連動してPC・スマホ間で完全共有） */}
        <div className="memo-section">
          <textarea 
            className="memo-textarea" 
            placeholder="連絡事項やメモを自由に入力できます..."
            rows={2}
            value={localMemo}
            onChange={(e) => setLocalMemo(e.target.value)}
          />
        </div>

        {/* 時間割表本体 */}
        <TimetableGrid
          selectedDate={selectedDate}
          dayOfWeek={dayOfWeek}
          dayData={getDayData(selectedDate)}
          getTemplateData={getTemplateData}
          subjects={subjects}
          teachers={teachers}
          specialSubjects={specialSubjects}
          onSave={handleSaveWithMemo} // ➔ 【修正】メモも一緒に保存する新しい関数に変更
          onShowToast={showToast}
          allData={data}
        />

        {/* 設定画面 */}
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