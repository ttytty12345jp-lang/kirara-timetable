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
  const [selectedDate, setSelectedDate] = useState(getDateString(new Date()));
  const [toast, setToast] = useState(null);
  const { data, saveRecord, deleteRecord, loading } = useStorage();

  // ==========================================
  // 💡 メモ用のリアルタイム同期処理（スムーズ入力版）
  // ==========================================
  const currentDayData = data?.[selectedDate] || {};
  const serverMemo = currentDayData.memo || "";

  // 入力中の文字を一時的にキープする状態
  const [localMemo, setLocalMemo] = useState("");

  // 日付が変わったり、他端末（PC等）で更新されたら、入力欄の文字を同期する
  useEffect(() => {
    setLocalMemo(serverMemo);
  }, [serverMemo, selectedDate]);

  // 入力欄から手が離れた（フォーカスが外れた）瞬間にサーバーへ保存・PCへ同期する
  const syncMemoWithServer = async (text) => {
    const currentTimetable = currentDayData.timetable || currentDayData;
    await saveRecord(selectedDate, {
      ...currentDayData,
      timetable: currentTimetable,
      memo: text
    });
  };

  // ==========================================
  // 既存の共通処理（通知・曜日・データ取得）
  // ==========================================
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const dayOfWeek = getDayOfWeek(selectedDate);

  const getDayData = (date) => {
    return data?.[date]?.timetable || data?.[date] || null;
  };

  const getTemplateData = (dayStr) => {
    return data?.templates?.[dayStr] || null;
  };

  // ==========================================
  // 画面の見た目（HTML / JSX）
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
        
        {/* 自由記述欄（メモ欄） */}
        <div className="memo-section">
          <textarea 
            className="memo-textarea" 
            placeholder="連絡事項やメモを自由に入力できます..."
            rows={2}
            value={localMemo}
            onChange={(e) => setLocalMemo(e.target.value)}
            onBlur={(e) => syncMemoWithServer(e.target.value)}
          />
        </div> 

        {/* 時間割の表本体 */}
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

        {/* 設定エリア */}
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
      
      {/* 通知トースト */}
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}