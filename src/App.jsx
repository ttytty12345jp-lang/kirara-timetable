import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import Header from "./components/Header";
import DatePicker from "./components/DatePicker";
import TimetableGrid from "./components/TimetableGrid";
import SettingsSection from "./components/SettingsSection";
import Toast from "./components/Toast";
import { useStorage } from "./hooks/useStorage";
import {
  DEFAULT_SUBJECTS, DEFAULT_TEACHERS,
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

  // config マップをメモ化してO(1)参照
  const configMap = useMemo(() => {
    const m = new Map();
    for (const r of data) {
      if (r.config_key) m.set(r.config_key, r.config_value);
    }
    return m;
  }, [data]);

  const getConfig = useCallback((key) => configMap.get(key) || null, [configMap]);

  const getDayData = useCallback((date) =>
    data.filter(r =>
      r.date === date && r.class_name && !r.config_key && r.class_name !== "DAY_TEMPLATE"
    ), [data]);

  const getTemplateData = useCallback((day, className, forDate) => {
    const targetDate = forDate || selectedDate;
    const all = data.filter(r =>
      r.class_name === "DAY_TEMPLATE" &&
      r.day_template_day === day &&
      r.day_template_class === className
    );
    // 開始日ごとにグループ化し、targetDate 以前で最新の開始日を選ぶ
    const froms = [...new Set(all.map(r => r.day_template_from || ""))];
    const valid = froms.filter(f => !f || f <= targetDate).sort().reverse();
    const bestFrom = valid[0] ?? "";
    return all.filter(r => (r.day_template_from || "") === bestFrom);
  }, [data, selectedDate]);

  const subjects = useMemo(() =>
    (getConfig("subjects_list") || DEFAULT_SUBJECTS.join(",")).split(",").filter(Boolean),
    [getConfig]);

  const teachers = useMemo(() =>
    (getConfig("teachers_list") || DEFAULT_TEACHERS.join(",")).split(",").filter(Boolean),
    [getConfig]);

  const specialSubjects = useMemo(() =>
    (getConfig("special_subject") || DEFAULT_SPECIAL_SUBJECTS.join(",")).split(",").filter(Boolean),
    [getConfig]);

  const memoKey   = `memo_${selectedDate}`;
  const memoValue = getConfig(memoKey) || "";

  const handleMemoChange = useCallback((value) => {
    saveRecord({ config_key: `memo_${selectedDate}`, config_value: value });
  }, [saveRecord, selectedDate]);

  const memoRef = useRef(null);

  // 教員を「不在」にした際、メモ欄に自動で行を追加する
  const handleTeacherAbsent = useCallback((teacherName) => {
    memoRef.current?.appendLine(`${teacherName}先生 不在`);
  }, []);

  // 同じ日付で2回 getDayData を呼ばないようにメモ化
  const currentDayData = useMemo(() => getDayData(selectedDate), [getDayData, selectedDate]);

  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <DatePicker
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          dayOfWeek={dayOfWeek}
        />

        {loading ? (
          <div className="loading-skeleton">
            <div className="skeleton-bar" />
            <div className="skeleton-bar skeleton-bar--wide" />
            <div className="skeleton-bar skeleton-bar--wide" />
          </div>
        ) : (
          <MemoSection
            ref={memoRef}
            value={memoValue}
            onChange={handleMemoChange}
            selectedDate={selectedDate}
          />
        )}

        {!loading && (
          <TimetableGrid
            selectedDate={selectedDate}
            dayOfWeek={dayOfWeek}
            dayData={currentDayData}
            getTemplateData={getTemplateData}
            subjects={subjects}
            teachers={teachers}
            specialSubjects={specialSubjects}
            onSave={saveRecord}
            onShowToast={showToast}
            onTeacherAbsent={handleTeacherAbsent}
          />
        )}

        <SettingsSection
          subjects={subjects}
          teachers={teachers}
          specialSubjects={specialSubjects}
          getTemplateData={getTemplateData}
          onSave={saveRecord}
          onDelete={deleteRecord}
          onShowToast={showToast}
          selectedDate={selectedDate}
          dayData={currentDayData}
          allData={data}
        />
      </main>
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}

// メモコンポーネント（デバウンス付き自動保存）
// 非制御コンポーネント：React が textarea.value を強制セットしないので IME 変換が壊れない
const MemoSection = forwardRef(function MemoSection({ value, onChange, selectedDate }, ref) {
  const textareaRef  = useRef(null);
  const isComposing  = useRef(false);
  const savedValue   = useRef(value);
  const userHasTyped = useRef(false);
  const timerRef     = useRef(null);

  // 日付が変わったときはリセット
  useEffect(() => {
    savedValue.current = value;
    userHasTyped.current = false;
    if (textareaRef.current) textareaRef.current.value = value;
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ユーザーがまだ入力していない間だけ、外部データ（初回ロード等）を反映
  useEffect(() => {
    if (!userHasTyped.current && textareaRef.current) {
      textareaRef.current.value = value;
      savedValue.current = value;
    }
  }, [value]);

  function scheduleSave(text) {
    userHasTyped.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (text !== savedValue.current) {
        savedValue.current = text;
        onChange(text);
      }
    }, 800);
  }

  // 外部（不在ボタン等）からメモに1行追記し、即座に保存する
  useImperativeHandle(ref, () => ({
    appendLine(text) {
      const current  = textareaRef.current?.value || "";
      const newValue = current ? `${current}\n${text}` : text;
      userHasTyped.current = true;
      clearTimeout(timerRef.current);
      if (textareaRef.current) textareaRef.current.value = newValue;
      savedValue.current = newValue;
      onChange(newValue);
    }
  }));

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
});
