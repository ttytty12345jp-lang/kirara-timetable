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
  // 💡 メモ用の処理（Supabaseのconfig_keyルールに完全準拠）
  // ==========================================
  
  // 日付ごとの一意なキーを作成（例: "memo_2026-06-01"）
  const memoConfigKey = `memo_${selectedDate}`;

  // 全データ（data）の中から、この日付のメモレコードをピンポイントで検索
  const memoRecord = Array.isArray(data)
    ? data.find(r => r.config_key === memoConfigKey)
    : null;

  const serverMemo = memoRecord?.config_value || "";

  // 入力中の文字を保持する状態
  const [localMemo, setLocalMemo] = useState("");

  // 日付の変更や、他端末（PC/スマホ）での更新を検知して、入力欄にリアルタイム反映
  useEffect(() => {
    setLocalMemo(serverMemo);
  }, [serverMemo, selectedDate]);

  // 入力欄から手が離れた（フォーカスが外れた）瞬間に、大元のルールに乗せて単発で保存
  const syncMemoWithServer = async (text) => {
    if (text.trim() === serverMemo.trim()) return;

    // useStorageの「record.config_key」の分岐に100%適合するオブジェクトを作成
    const memoData = {
      config_key: memoConfigKey,  // ➔ これがあるため、大元のif文の1番目を通過します
      config_value: text,
      date: selectedDate,         // 念のため日付も保持
      class_name: "CONFIG"
    };

    // 大元の saveRecord 関数をそのまま呼び出す
    await saveRecord(memoData);
  };

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
        
        {/* 📝 新・メモ自動同期欄 */}
        <div className="memo-section">
          <textarea 
            className="memo-textarea" 
            placeholder="連絡事項やメモを自由に入力できます..."
            rows={2}
            value={localMemo}
            onChange={(e) => setLocalMemo(e.target.value)}
            onBlur={(e) => syncMemoWithServer(e.target.value)} // ➔ 入力欄から離れたら即保存！
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
          onSave={saveRecord} // ➔ 元通りの関数に戻しました
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