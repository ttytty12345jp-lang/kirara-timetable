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
  // 💡 メモ用のリアルタイム同期処理（配列データ構造対応版）
  // ==========================================
  
  // 配列（data）の中から、現在の日付、かつ「config_key が memo」となっているレコードをピンポイントで探す
  const memoRecord = Array.isArray(data) 
    ? data.find(r => r.date === selectedDate && r.config_key === "memo") 
    : null;
    
  const serverMemo = memoRecord?.config_value || "";

  // 入力中の文字を一時的にキープするローカルな状態
  const [localMemo, setLocalMemo] = useState("");

  // 日付が変わったり、他端末（PC等）で保存されてサーバーデータが更新されたら、入力欄の文字を同期する
  useEffect(() => {
    setLocalMemo(serverMemo);
  }, [serverMemo, selectedDate]);

  // 入力欄から手が離れた（フォーカスが外れた）瞬間に、時間割の仕組み（saveRecord）を使ってサーバーへ直接保存する
  const syncMemoWithServer = async (text) => {
    // 前後の余計な空白を消して、もしサーバーの値と全く同じなら通信しない
    if (text.trim() === serverMemo.trim()) return;

    // 時間割の管理レコード（saveRecord）の形式に完全に合わせる
    const recordToSave = {
      ...(memoRecord || {}),       // 既存のレコードがあればIDなどを引き継ぐ
      date: selectedDate,          // 対象の日付
      config_key: "memo",          // メモであることを示す識別子
      config_value: text,          // 入力されたテキスト内容
      class_name: "CONFIG"         // 他のデータと混ざらないためのタイプ設定
    };

    await saveRecord(selectedDate, recordToSave);
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
        
        {/* 日記型メモ欄（入力は快適に、離れたらPC/スマホ間を即時リアルタイム同期） */}
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

        {/* 時間割表本体 */}
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