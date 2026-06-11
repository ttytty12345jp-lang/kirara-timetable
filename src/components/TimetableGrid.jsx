import React, { useState, useRef, useEffect, useCallback } from "react";
import { CLASSES, getClassColor } from "../utils/constants";

const DISPLAY_PERIODS = ["1限", "2限", "3限", "4限", "給食", "5限", "6限"];
const WEEKDAYS = new Set(["月", "火", "水", "木", "金"]);

// クラス名・時限名に絶対含まれないタブ文字でキーを生成
const makeKey  = (cls, period) => `${cls}\t${period}`;
const parseKey = (key) => {
  const i = key.indexOf("\t");
  return { cls: key.slice(0, i), period: key.slice(i + 1) };
};

function isCellChanged(tpl, cur) {
  if (!tpl && !cur)       return false;
  if (!tpl &&  cur)       return true;
  if ( tpl && tpl !== cur) return true;
  return false;
}

function CellEditor({ value, options, onConfirm, onCancel, isDouble }) {
  const [text, setText] = useState(value || "");
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);

  if (isDouble) {
    return (
      <input
        ref={ref}
        className="cell-inline-input"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter")  onConfirm(text);
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => onConfirm(text)}
      />
    );
  }
  return (
    <select
      ref={ref}
      className="cell-inline-select"
      value={text}
      onChange={e => onConfirm(e.target.value)}
      onBlur={onCancel}
      onKeyDown={e => { if (e.key === "Escape") onCancel(); }}
    >
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function TimetableGrid({
  selectedDate, dayOfWeek, dayData, getTemplateData,
  subjects, teachers, specialSubjects, onSave, onShowToast,
}) {
  const [pendingChanges, setPendingChanges] = useState({});
  const [editingCell,    setEditingCell]    = useState(null);
  const clickTimer = useRef(null);

  // 日付変更時に未保存変更をリセット
  useEffect(() => { setPendingChanges({}); }, [selectedDate]);

  // dayData をマップ化してO(1)検索
  const dayDataMap = React.useMemo(() => {
    const m = new Map();
    for (const r of dayData) m.set(makeKey(r.class_name, r.period), r);
    return m;
  }, [dayData]);

  const getTemplateValue = useCallback((cls, period, field) => {
    if (!WEEKDAYS.has(dayOfWeek)) return "";
    const tData = getTemplateData(dayOfWeek, cls);
    const rec = tData.find(r => r.day_template_period === period);
    return rec?.[field === "subject" ? "day_template_subject" : "day_template_teacher"] || "";
  }, [dayOfWeek, getTemplateData]);

  const getCellValue = useCallback((cls, period, field) => {
    const key = makeKey(cls, period);
    // 1. 未保存の変更
    if (pendingChanges[key]?.[field] !== undefined) return pendingChanges[key][field];
    // 2. 保存済みデータ
    const rec = dayDataMap.get(key);
    if (rec && field in rec && rec[field] !== null && rec[field] !== underfined) {
      return rec[field];
    }
    // 3. テンプレート
    return getTemplateValue(cls, period, field);
  }, [pendingChanges, dayDataMap, getTemplateValue]);

  const handleSingleOrDouble = useCallback((cls, period, field) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setEditingCell({ cls, period, field, isDouble: true });
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        setEditingCell({ cls, period, field, isDouble: false });
      }, 220);
    }
  }, []);

  const handleConfirm = useCallback((cls, period, field, value) => {
    setEditingCell(null);
    const key = makeKey(cls, period);
    setPendingChanges(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value },
    }));
  }, []);

  const handleCancel = useCallback(() => setEditingCell(null), []);

  const handleSaveAll = useCallback(() => {
   const toSave = [];
   const savedKeys = new Set();

  // 1. pendingChanges をすべて保存
  for (const [key, changes] of Object.entries(pendingChanges)) {
    const { cls, period } = parseKey(key);
    const existing = dayDataMap.get(key);

    toSave.push({
      class_name: cls,
      date:       selectedDate,
      period,
      subject: changes.subject !== undefined
        ? changes.subject
        : (existing?.subject || getTemplateValue(cls, period, "subject")),
      teacher: changes.teacher !== undefined
        ? changes.teacher
        : (existing?.teacher || getTemplateValue(cls, period, "teacher")),
    });
    savedKeys.add(key);
  }

  // 2. dayDataMap にある既存データのうち、pendingChanges にないものはそのまま保持
  for (const [key, rec] of dayDataMap.entries()) {
    if (!savedKeys.has(key)) {
      toSave.push(rec);
    }
  }

  for (const rec of toSave) onSave(rec);
  setPendingChanges({});
  onShowToast("保存しました ✓");
}, [pendingChanges, dayDataMap, selectedDate, getTemplateValue, onSave, onShowToast]);

  const hasPending = Object.keys(pendingChanges).length > 0;

  // セルレンダラー（通常クラス・えい・かに共通）
  const renderCell = (cls, pKey, field, options, isLunch, bgColor) => {
    const value     = getCellValue(cls, pKey, field);
    const tplVal    = getTemplateValue(cls, pKey, field);
    const changed   = isCellChanged(tplVal, value);
    const isEditing = editingCell?.cls === cls
                   && editingCell?.period === pKey
                   && editingCell?.field  === field;
    const isSubject = field === "subject";

    return (
      <td
        key={`${pKey}-${field}`}
        className={[
          "timetable-cell",
          isSubject ? "subject-cell" : "teacher-cell",
          changed  ? "changed"    : "",
          isLunch  ? "lunch-cell" : "",
        ].filter(Boolean).join(" ")}
        style={{
          backgroundColor: isEditing ? "#fef9c3"
                         : isLunch   ? "#e0f2fe"
                         : changed   ? "#fca5a5"
                         : bgColor,
        }}
        onClick={() => {
          if (isLunch && isSubject) return; // 給食の教科セルは編集不可
          handleSingleOrDouble(cls, pKey, field);
        }}
      >
        {isEditing ? (
          <CellEditor
            value={value}
            options={options}
            onConfirm={v => handleConfirm(cls, pKey, field, v)}
            onCancel={handleCancel}
            isDouble={editingCell.isDouble}
          />
        ) : (
          <span className={`cell-text ${isSubject ? "subject-text" : "teacher-text"}`}>
            {value || (isLunch && isSubject ? "給食" : "")}
          </span>
        )}
      </td>
    );
  };

  return (
    <section className="timetable-section">
      <div className="section-header">
        <h2 className="section-title">
          時間割
          <span className="date-label">{selectedDate} ({dayOfWeek})</span>
        </h2>
        <button
          className={`save-btn ${hasPending ? "pending" : ""}`}
          onClick={handleSaveAll}
        >
          💾 保存{hasPending && <span className="pending-dot" />}
        </button>
      </div>

      <div className="table-scroll-wrapper">
        <table className="timetable-table">
          <thead>
            <tr>
              <th className="th-class-col">クラス</th>
              <th className="th-kind-col">種別</th>
              {DISPLAY_PERIODS.map(p => (
                <th key={p} className={`th-period-col${p === "給食" ? " th-lunch-col" : ""}`}>
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLASSES.map(cls => {
              const bgColor  = getClassColor(cls);
              const isEikani = cls === "えい・かに";
              const isIruka  = cls === "いるか";
              const subjectOptions = (isEikani || isIruka) ? specialSubjects : subjects;

              if (isEikani) {
                const rowDefs = [
                  { label: "教①", sfx: "",   field: "subject" },
                  { label: "教②", sfx: "_2", field: "subject" },
                  { label: "教③", sfx: "_3", field: "subject" },
                  { label: "員①", sfx: "",   field: "teacher" },
                  { label: "員②", sfx: "_2", field: "teacher" },
                  { label: "員③", sfx: "_3", field: "teacher" },
                ];

                return (
                  <React.Fragment key={cls}>
                    {rowDefs.map((def, i) => (
                      <tr
                        key={def.label}
                        className={`${def.field === "subject" ? "class-subject-row" : "class-teacher-row"} eikani-row`}
                      >
                        {i === 0 && (
                          <td className="td-class-label" rowSpan={6} style={{ backgroundColor: bgColor }}>
                            <span className="class-label">{cls}</span>
                          </td>
                        )}
                        <td className="td-kind" style={{ backgroundColor: bgColor }}>
                          <span className="kind-label">{def.label}</span>
                        </td>
                        {DISPLAY_PERIODS.map(period => {
                          const isLunch = period === "給食";
                          const pKey    = isLunch ? period : `${period}${def.sfx}`;
                          return renderCell(
                            cls, pKey, def.field,
                            def.field === "subject" ? specialSubjects : teachers,
                            isLunch, bgColor,
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              }

              // 通常クラス・いるか（教科行＋教員行の2行）
              return (
                <React.Fragment key={cls}>
                  <tr className="class-subject-row">
                    <td className="td-class-label" rowSpan={2} style={{ backgroundColor: bgColor }}>
                      <span className="class-label">{cls}</span>
                    </td>
                    <td className="td-kind" style={{ backgroundColor: bgColor }}>
                      <span className="kind-label">教科</span>
                    </td>
                    {DISPLAY_PERIODS.map(period => {
                      const isLunch = period === "給食";
                      return renderCell(cls, period, "subject", subjectOptions, isLunch, bgColor);
                    })}
                  </tr>
                  <tr className="class-teacher-row">
                    <td className="td-kind" style={{ backgroundColor: bgColor }}>
                      <span className="kind-label">教員</span>
                    </td>
                    {DISPLAY_PERIODS.map(period => {
                      const isLunch = period === "給食";
                      return renderCell(cls, period, "teacher", teachers, isLunch, bgColor);
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="legend">
        <span className="legend-item">
          <span className="legend-dot changed-dot" />テンプレートと異なる
        </span>
        <span className="legend-item">
          <span className="legend-dot pending-legend-dot" />未保存の変更
        </span>
        <span className="legend-sep">クリック: ドロップダウン / ダブルクリック: 手入力</span>
      </div>
    </section>
  );
}