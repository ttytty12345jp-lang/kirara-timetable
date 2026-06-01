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
  // 💡 メモ用の処理（時間割の1マスのデータに相乗り版）
  // ==========================================
  
  // その日の時間割データ（配列）を取得する
  const dayRecords = Array.isArray(data)
    ? data.filter(r => r.date === selectedDate && r.class_name && !r.config_key)
    : [];

  // その日の「最初の1マス（なんでもOK）」の memo カラムから文字を読み出す
  const serverMemo = dayRecords[0]?.memo || "";

  // 入力中の文字を保持する状態
  const [localMemo, setLocalMemo] = useState("");

  // サーバーのデータが変わったら入力欄に反映
  useEffect(() => {
    setLocalMemo(serverMemo);
  }, [serverMemo, selectedDate]);

  // 時間割の保存ボタンが押されたとき、すべてのコマのデータにこのメモを書き込んで一緒に保存する
  const handleSaveWithMemo = useCallback(async (date, recordData) => {
    if (Array.isArray(recordData)) {
      // 送信される時間割のすべてのコマに memo: localMemo を合流させる
      const updatedData = recordData.map(row => ({
        ...row,
        memo: localMemo
      }));
      await saveRecord(date, updatedData);
    } else if (recordData && typeof recordData === 'object') {
      // オブジェクト形式で送られている場合
      await saveRecord(date, {
        ...recordData,
        memo: localMemo
      });
    } else {
      // それ以外の場合もそのまま渡す
      await saveRecord(date, recordData);
    }
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
  // 画面のレイアウト構成
  // ==========================================
  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <DatePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          dayOfWeek={dayOfWeek}
        />
        
        {/* メモ欄 */}
        <div className="memo-section">
          <textarea 
            className="memo-textarea" 
            placeholder="連絡事項やメモを自由に入力できます..."
            rows={2}
            value={localMemo}
            onChange={(e) => setLocalMemo(e.target.value)}
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
          onSave={handleSaveWithMemo} // ➔ メモを相乗りさせて保存
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