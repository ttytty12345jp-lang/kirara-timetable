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
  // 💡 メモ用の処理（1コマ目のデータに完全結合版）
  // ==========================================
  
  // 今日の時間割データを取得
  const todayRows = Array.isArray(data)
    ? data.filter(r => r.date === selectedDate && r.class_name && !r.config_key && r.class_name !== "DAY_TEMPLATE")
    : [];

  // 今日の「1コマ目のデータ」の中に保存されているメモ文字列を読み出す
  const serverMemo = todayRows[0]?.memo || "";

  // 入力中の文字を保持する状態
  const [localMemo, setLocalMemo] = useState("");

  // サーバーのデータ（他端末での保存など）が更新されたら、入力欄の文字を同期する
  useEffect(() => {
    setLocalMemo(serverMemo);
  }, [serverMemo, selectedDate]);

  // 【最重要】時間割の保存ボタンが押されたとき、送信されるデータの一番最初のマス（1コマ目）にメモを埋め込む
  const handleSaveWithMemo = useCallback(async (date, recordData) => {
    let finalData = recordData;

    if (Array.isArray(recordData) && recordData.length > 0) {
      // 送信される時間割データの「配列の1番最初（[0]）」のオブジェクトに memo プロパティを追加
      finalData = recordData.map((row, index) => {
        if (index === 0) {
          return { ...row, memo: localMemo }; // 1コマ目にメモを結合
        }
        return row;
      });
    } else if (recordData && typeof recordData === 'object') {
      // オブジェクト単体で送られてくる場合
      finalData = { ...recordData, memo: localMemo };
    }

    // 既存の時間割保存処理へそのまま流す（これでデータベースは拒絶反応を起こしません）
    await saveRecord(date, finalData);
  }, [saveRecord, localMemo]);

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
        
        {/* 日記型メモ欄 */}
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
          onSave={handleSaveWithMemo} // ➔ メモを1コマ目に隠し持って保存
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