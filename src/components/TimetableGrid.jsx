import React, { useState, useRef, useEffect } from "react";
import { CLASSES, PERIODS, getClassColor } from "../utils/constants";

// 判定ロジック : isCellChanged()
function isCellChanged(templateVal, currentVal) {
  if (!templateVal && !currentVal) return false;
  if (!templateVal && currentVal) return true;
  if (templateVal && templateVal !== currentVal) return true;
  return false;
}

// ─── 編集用エディタ（ドロップダウン / インプット） ───
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
          if (e.key === "Enter") onConfirm(text);
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
      onBlur={() => onCancel()}
      onKeyDown={e => { if (e.key === "Escape") onCancel(); }}
    >
      <option value="">—</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

// ─── 1マスのセルコンポーネント（スマホ最適化版） ───
function GridCell({ className, period, type, value, templateValue, options, onUpdate, isLunch }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDouble, setIsDouble] = useState(false);
  const clickTimer = useRef(null);

  const isChanged = isCellChanged(templateValue, value);
  const isSpecial = className === "えい・かに" || className === "いるか";
  const isLunchLocked = isLunch && type === "subject";

  function handleClick() {
    if (isLunchLocked) return;
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setIsDouble(true);
      setIsEditing(true);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        setIsDouble(false);
        setIsEditing(true);
      }, 220);
    }
  }

  // 📱 スマホの超極小セル用に、文字数をスマートに間引くロジック
  const formatValueForMobile = (val) => {
    if (!val) return "";
    if (val === "きららタイム") return "き";
    if (val === "ク･委" || val === "学活") return val.slice(0, 1); 
    if (val.length > 2) return val.slice(0, 2); // 「2-2算」などは「2-」に、最大2文字でカット
    return val;
  };

  // 背景色判定
  let cellBg = "#ffffff";
  if (isLunch) cellBg = "#e0f2fe"; // 給食はスカイ100
  else if (isEditing) cellBg = "#fef9c3"; // 編集時は黄色
  else if (isChanged) cellBg = "#fca5a5"; // テンプレート違いは赤
  else if (isSpecial) cellBg = "#e0e7ff"; // 特別クラスはインディゴ100
  else cellBg = getClassColor(className);

  return (
    <td 
      className={`timetable-grid-cell ${isLunchLocked ? "lunch-locked" : ""}`}
      style={{ backgroundColor: cellBg }}
      onClick={handleClick}
      /* 💡 マスを長押し・ホバーすると本来の文字列（長い名前）がポップアップします */
      title={`${className} ${period} [${type === 'subject' ? '教科' : '教員'}]: ${value || '未設定'}`}
    >
      {isLunchLocked ? (
        ""
      ) : isEditing ? (
        <CellEditor
          value={value}
          options={options}
          onConfirm={(v) => { onUpdate(v); setIsEditing(false); }}
          onCancel={() => setIsEditing(false)}
          isDouble={isDouble}
        />
      ) : (
        <span className="block text-[9px] md:text-[11px] font-medium tracking-tighter leading-none select-none">
          {formatValueForMobile(value)}
        </span>
      )}
    </td>
  );
}

// ─── 時間割テーブル全体（親コンポーネント） ───
export default function TimetableGrid({
  selectedDate, dayOfWeek, dayData, getTemplateData,
  subjects, teachers, specialSubjects, onSave, onShowToast
}) {
  const [pendingChanges, setPendingChanges] = useState({});

  useEffect(() => { setPendingChanges({}); }, [selectedDate]);

  function getCellValue(className, period, field) {
    const key = `${className}|${period}`;
    if (pendingChanges[key]?.[field] !== undefined) return pendingChanges[key][field];
    const rec = dayData.find(r => r.class_name === className && r.period === period);
    return rec?.[field] || "";
  }

  function getTemplateValue(className, period, field) {
    if (!["月", "火", "水", "木", "金"].includes(dayOfWeek)) return "";
    const tData = getTemplateData(dayOfWeek, className);
    const rec = tData.find(r => r.day_template_period === period);
    return rec?.[field === "subject" ? "day_template_subject" : "day_template_teacher"] || "";
  }

  function handleCellUpdate(className, period, field, value) {
    const key = `${className}|${period}`;
    setPendingChanges(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value }
    }));
  }

  function handleSaveAll() {
    const toSave = [];
    for (const [key, changes] of Object.entries(pendingChanges)) {
      const [className, period] = key.split("|");
      const existing = dayData.find(r => r.class_name === className && r.period === period);
      toSave.push({
        class_name: className,
        date: selectedDate,
        period,
        subject: changes.subject !== undefined ? changes.subject : (existing?.subject || ""),
        teacher: changes.teacher !== undefined ? changes.teacher : (existing?.teacher || ""),
      });
    }
    for (const rec of dayData) {
      const key = `${rec.class_name}|${rec.period}`;
      if (!pendingChanges[key]) toSave.push(rec);
    }
    for (const rec of toSave) onSave(rec);
    setPendingChanges({});
    onShowToast("保存しました ✓");
  }

  const hasPending = Object.keys(pendingChanges).length > 0;

  // えい・かに の6行バラシ構造の定義
  const getSubRows = (cls) => {
    if (cls === "えい・かに") {
      return [
        { id: "sub1", label: "教①", type: "subject", periodSuffix: "" },
        { id: "sub2", label: "教②", type: "subject", periodSuffix: "_2" },
        { id: "sub3", label: "教③", type: "subject", periodSuffix: "_3" },
        { id: "tea1", label: "員①", type: "teacher", periodSuffix: "" },
        { id: "tea2", label: "員②", type: "teacher", periodSuffix: "_2" },
        { id: "tea3", label: "員③", type: "teacher", periodSuffix: "_3" },
      ];
    }
    return [
      { id: "subject", label: "教科", type: "subject", periodSuffix: "" },
      { id: "teacher", label: "教員", type: "teacher", periodSuffix: "" }
    ];
  };

  return (
    <section className="timetable-section">
      <div className="section-header">
        <h2 className="section-title">
          時間割 <span className="date-label">{selectedDate} ({dayOfWeek})</span>
        </h2>
        <button className={`save-btn ${hasPending ? "pending" : ""}`} onClick={handleSaveAll}>
          💾 保存 {hasPending && <span className="pending-dot" />}
        </button>
      </div>

      <div className="table-scroll-wrapper">
        <table className="timetable-table horizontal-layout">
          <thead>
            <tr>
              <th className="th-class-main" colSpan="2" style={{ fontSize: '10px', padding: '4px 0' }}>クラス</th>
              {PERIODS.map(p => (
                <th key={p} className={`th-period-header ${p === "給食" ? "lunch-header" : ""}`}>
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLASSES.map(cls => {
              const subRows = getSubRows(cls);
              const rowCount = subRows.length;
              const bgColor = getClassColor(cls);

              return subRows.map((subRow, index) => (
                <tr key={`${cls}-${subRow.id}`} className={`row-${subRow.type}`}>
                  {index === 0 && (
                    <td className="td-class-name" rowSpan={rowCount} style={{ backgroundColor: bgColor }}>
                      <span className="class-vertical-text">{cls}</span>
                    </td>
                  )}
                  <td className="td-sub-label">{subRow.label}</td>
                  {PERIODS.map(period => {
                    const isLunch = period === "給食";
                    const targetPeriod = cls === "えい・かに" ? `${period}${subRow.periodSuffix}` : period;

                    return (
                      <GridCell
                        key={`${cls}-${targetPeriod}-${subRow.type}`}
                        className={cls}
                        period={targetPeriod}
                        type={subRow.type}
                        value={getCellValue(cls, targetPeriod, subRow.type)}
                        templateValue={getTemplateValue(cls, targetPeriod, subRow.type)}
                        options={subRow.type === "subject" ? (cls === "えい・かに" ? specialSubjects : subjects) : teachers}
                        onUpdate={(val) => handleCellUpdate(cls, targetPeriod, subRow.type, val)}
                        isLunch={isLunch}
                      />
                    );
                  })}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}