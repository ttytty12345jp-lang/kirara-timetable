import React, { useState, useRef, useEffect } from "react";
import { CLASSES, getClassColor } from "../utils/constants";

const DISPLAY_PERIODS = ["1限", "2限", "3限", "4限", "給食", "5限", "6限"];

function isCellChanged(templateVal, currentVal) {
  if (!templateVal && !currentVal) return false;
  if (!templateVal && currentVal) return true;
  if (templateVal && templateVal !== currentVal) return true;
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
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function TimetableGrid({
  selectedDate, dayOfWeek, dayData, getTemplateData,
  subjects, teachers, specialSubjects, onSave, onShowToast
}) {
  const [pendingChanges, setPendingChanges] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const clickTimer = useRef(null);

  useEffect(() => { setPendingChanges({}); }, [selectedDate]);

  function getCellValue(cls, period, field) {
    const key = `${cls}|${period}`;
    
    // 1. 未保存の変更があればそれを返す
    if (pendingChanges[key]?.[field] !== undefined) {
      return pendingChanges[key][field];
    }
    
    // 2. 保存済みデータがあればそれを返す
    const rec = dayData.find(r => r.class_name === cls && r.period === period);
    if (rec && rec[field]) {
      return rec[field];
    }
    
    // 3. データがなければテンプレート値を返す（デフォルト表示）
    return getTemplateValue(cls, period, field);
  }

  function getTemplateValue(cls, period, field) {
    if (!["月","火","水","木","金"].includes(dayOfWeek)) return "";
    const tData = getTemplateData(dayOfWeek, cls);
    const rec = tData.find(r => r.day_template_period === period);
    return rec?.[field === "subject" ? "day_template_subject" : "day_template_teacher"] || "";
  }

  function handleSingleOrDouble(cls, period, field) {
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
  }

  function handleConfirm(cls, period, field, value) {
    setEditingCell(null);
    const key = `${cls}|${period}`;
    setPendingChanges(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value }
    }));
  }

  function handleCancel() { setEditingCell(null); }

  function handleSaveAll() {
    const toSave = [];
    
    // 未保存の変更を保存
    for (const [key, changes] of Object.entries(pendingChanges)) {
      const [cls, period] = key.split("|");
      const existing = dayData.find(r => r.class_name === cls && r.period === period);
      const templateSubject = getTemplateValue(cls, period, "subject");
      const templateTeacher = getTemplateValue(cls, period, "teacher");
      
      const subject = changes.subject !== undefined ? changes.subject : (existing?.subject || templateSubject);
      const teacher = changes.teacher !== undefined ? changes.teacher : (existing?.teacher || templateTeacher);
      
      toSave.push({
        class_name: cls,
        date: selectedDate,
        period,
        subject,
        teacher,
      });
    }
    
    // 既存データで変更されていないものも保持
    for (const rec of dayData) {
      const key = `${rec.class_name}|${rec.period}`;
      if (!pendingChanges[key]) {
        toSave.push(rec);
      }
    }
    
    for (const rec of toSave) onSave(rec);
    setPendingChanges({});
    onShowToast("保存しました ✓");
  }

  const hasPending = Object.keys(pendingChanges).length > 0;

  return (
    <section className="timetable-section">
      <div className="section-header">
        <h2 className="section-title">
          時間割
          <span className="date-label">{selectedDate} ({dayOfWeek})</span>
        </h2>
        <button className={`save-btn ${hasPending ? "pending" : ""}`} onClick={handleSaveAll}>
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
                <th key={p} className={`th-period-col${p === "給食" ? " th-lunch-col" : ""}`}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLASSES.map(cls => {
              const bgColor = getClassColor(cls);
              const isEikani = cls === "えい・かに";

              if (isEikani) {
                const subRows = ["教①", "教②", "教③"];
                const tchrRows = ["員①", "員②", "員③"];
                const suffixes = ["", "_2", "_3"];

                return (
                  <React.Fragment key={cls}>
                    {subRows.map((label, i) => {
                      const sfx = suffixes[i];
                      return (
                        <tr key={label} className="class-subject-row eikani-row">
                          {i === 0 && (
                            <td className="td-class-label" rowSpan={6} style={{ backgroundColor: bgColor }}>
                              <span className="class-label">{cls}</span>
                            </td>
                          )}
                          <td className="td-kind" style={{ backgroundColor: bgColor }}>
                            <span className="kind-label">{label}</span>
                          </td>
                          {DISPLAY_PERIODS.map(period => {
                            const isLunch = period === "給食";
                            const pKey = isLunch ? period : `${period}${sfx}`;
                            const value = getCellValue(cls, pKey, "subject");
                            const templateValue = getTemplateValue(cls, pKey, "subject");
                            const changed = isCellChanged(templateValue, value);
                            const isEditing = editingCell?.cls === cls && editingCell?.period === pKey && editingCell?.field === "subject";
                            return (
                              <td
                                key={period}
                                className={`timetable-cell subject-cell${changed ? " changed" : ""}${isLunch ? " lunch-cell" : ""}`}
                                style={{ backgroundColor: isEditing ? "#fef9c3" : isLunch ? "#e0f2fe" : changed ? "#fca5a5" : bgColor }}
                                onClick={() => handleSingleOrDouble(cls, pKey, "subject")}
                              >
                                {isEditing ? (
                                  <CellEditor value={value} options={specialSubjects} onConfirm={v => handleConfirm(cls, pKey, "subject", v)} onCancel={handleCancel} isDouble={editingCell.isDouble} />
                                ) : (
                                  <span className="cell-text subject-text">{value || (isLunch ? "給食" : "")}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {tchrRows.map((label, i) => {
                      const sfx = suffixes[i];
                      return (
                        <tr key={label} className="class-teacher-row eikani-row">
                          <td className="td-kind" style={{ backgroundColor: bgColor }}>
                            <span className="kind-label">{label}</span>
                          </td>
                          {DISPLAY_PERIODS.map(period => {
                            const isLunch = period === "給食";
                            const pKey = isLunch ? period : `${period}${sfx}`;
                            const value = getCellValue(cls, pKey, "teacher");
                            const templateValue = getTemplateValue(cls, pKey, "teacher");
                            const changed = isCellChanged(templateValue, value);
                            const isEditing = editingCell?.cls === cls && editingCell?.period === pKey && editingCell?.field === "teacher";
                            return (
                              <td
                                key={period}
                                className={`timetable-cell teacher-cell${changed ? " changed" : ""}${isLunch ? " lunch-cell" : ""}`}
                                style={{ backgroundColor: isEditing ? "#fef9c3" : isLunch ? "#e0f2fe" : changed ? "#fca5a5" : bgColor }}
                                onClick={() => handleSingleOrDouble(cls, pKey, "teacher")}
                              >
                                {isEditing ? (
                                  <CellEditor value={value} options={teachers} onConfirm={v => handleConfirm(cls, pKey, "teacher", v)} onCancel={handleCancel} isDouble={editingCell.isDouble} />
                                ) : (
                                  <span className="cell-text teacher-text">{value}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              }

              // 通常クラス
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
                      const value = getCellValue(cls, period, "subject");
                      const templateValue = getTemplateValue(cls, period, "subject");
                      const changed = isCellChanged(templateValue, value);
                      const isEditing = editingCell?.cls === cls && editingCell?.period === period && editingCell?.field === "subject";
                      return (
                        <td
                          key={period}
                          className={`timetable-cell subject-cell${changed ? " changed" : ""}${isLunch ? " lunch-cell" : ""}`}
                          style={{ backgroundColor: isEditing ? "#fef9c3" : isLunch ? "#e0f2fe" : changed ? "#fca5a5" : bgColor }}
                          onClick={() => handleSingleOrDouble(cls, period, "subject")}
                        >
                          {isEditing ? (
                            <CellEditor value={value} options={subjects} onConfirm={v => handleConfirm(cls, period, "subject", v)} onCancel={handleCancel} isDouble={editingCell.isDouble} />
                          ) : (
                            <span className="cell-text subject-text">{value || (isLunch ? "給食" : "")}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="class-teacher-row">
                    <td className="td-kind" style={{ backgroundColor: bgColor }}>
                      <span className="kind-label">教員</span>
                    </td>
                    {DISPLAY_PERIODS.map(period => {
                      const isLunch = period === "給食";
                      const value = getCellValue(cls, period, "teacher");
                      const templateValue = getTemplateValue(cls, period, "teacher");
                      const changed = isCellChanged(templateValue, value);
                      const isEditing = editingCell?.cls === cls && editingCell?.period === period && editingCell?.field === "teacher";
                      return (
                        <td
                          key={period}
                          className={`timetable-cell teacher-cell${changed ? " changed" : ""}${isLunch ? " lunch-cell" : ""}`}
                          style={{ backgroundColor: isEditing ? "#fef9c3" : isLunch ? "#e0f2fe" : changed ? "#fca5a5" : bgColor }}
                          onClick={() => handleSingleOrDouble(cls, period, "teacher")}
                        >
                          {isEditing ? (
                            <CellEditor value={value} options={teachers} onConfirm={v => handleConfirm(cls, period, "teacher", v)} onCancel={handleCancel} isDouble={editingCell.isDouble} />
                          ) : (
                            <span className="cell-text teacher-text">{value}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="legend">
        <span className="legend-item"><span className="legend-dot changed-dot" />テンプレートと異なる</span>
        <span className="legend-item"><span className="legend-dot pending-legend-dot" />未保存の変更</span>
        <span className="legend-sep">クリック: ドロップダウン / ダブルクリック: 手入力</span>
      </div>
    </section>
  );
}