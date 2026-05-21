import { useState, useRef, useEffect, useCallback } from "react";
import { CLASSES, PERIODS, getClassColor, getGrade, SPECIAL_CLASS_COLOR } from "../utils/constants";

function isCellChanged(templateVal, currentVal) {
  if (!templateVal && !currentVal) return false;
  if (!templateVal && currentVal) return true;
  if (templateVal && templateVal !== currentVal) return true;
  return false;
}

function CellEditor({ value, options, onConfirm, onCancel, isDouble }) {
  const [text, setText] = useState(value || "");
  const ref = useRef();

  useEffect(() => {
    ref.current?.focus();
  }, []);

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
      onChange={e => {
        onConfirm(e.target.value);
      }}
      onBlur={() => onCancel()}
      onKeyDown={e => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <option value="">—</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function TimetableCell({ className, period, subject, teacher, templateSubject, templateTeacher, subjects, teachers, onUpdate, isLunch }) {
  const [editingField, setEditingField] = useState(null); // 'subject' | 'teacher' | null
  const [isDouble, setIsDouble] = useState(false);
  const clickTimer = useRef(null);

  const subjectChanged = isCellChanged(templateSubject, subject);
  const teacherChanged = isCellChanged(templateTeacher, teacher);

  function handleClick(field) {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setIsDouble(true);
      setEditingField(field);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        setIsDouble(false);
        setEditingField(field);
      }, 220);
    }
  }

  function handleConfirm(field, value) {
    setEditingField(null);
    onUpdate(field, value);
  }

  function handleCancel() {
    setEditingField(null);
  }

  const bgColor = getClassColor(className);
  const isSpecial = className === "えい・かに" || className === "いるか";

  return (
    <td className={`timetable-cell ${isSpecial ? "special-cell" : ""}`}
      style={{ backgroundColor: editingField ? "#fef9c3" : bgColor }}>
      {/* Subject row */}
      {isLunch ? (
        <div className="cell-lunch-placeholder" style={{ background: "#e0f2fe" }} />
      ) : (
        <div
          className={`cell-subject ${subjectChanged ? "changed" : ""}`}
          onClick={() => handleClick("subject")}
          title={`${className} ${period} 教科 (ダブルクリックで手入力)`}
        >
          {editingField === "subject" ? (
            <CellEditor
              value={subject}
              options={isSpecial ? [] : subjects}
              onConfirm={v => handleConfirm("subject", v)}
              onCancel={handleCancel}
              isDouble={isDouble}
            />
          ) : (
            <span className="cell-text subject-text">{subject || ""}</span>
          )}
        </div>
      )}
      {/* Teacher row */}
      <div
        className={`cell-teacher ${teacherChanged ? "changed" : ""}`}
        onClick={() => handleClick("teacher")}
        title={`${className} ${period} 教員 (ダブルクリックで手入力)`}
      >
        {editingField === "teacher" ? (
          <CellEditor
            value={teacher}
            options={teachers}
            onConfirm={v => handleConfirm("teacher", v)}
            onCancel={handleCancel}
            isDouble={isDouble}
          />
        ) : (
          <span className="cell-text teacher-text">{teacher || ""}</span>
        )}
      </div>
    </td>
  );
}

export default function TimetableGrid({
  selectedDate, dayOfWeek, dayData, getTemplateData,
  subjects, teachers, specialSubjects, onSave, onShowToast
}) {
  const [pendingChanges, setPendingChanges] = useState({});

  // Reset pending changes when date changes
  useEffect(() => {
    setPendingChanges({});
  }, [selectedDate]);

  function getCellValue(className, period, field) {
    const key = `${className}|${period}`;
    if (pendingChanges[key]?.[field] !== undefined) {
      return pendingChanges[key][field];
    }
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

    // Also save unchanged cells that exist in dayData (to preserve)
    for (const rec of dayData) {
      const key = `${rec.class_name}|${rec.period}`;
      if (!pendingChanges[key]) {
        toSave.push(rec);
      }
    }

    for (const rec of toSave) {
      onSave(rec);
    }
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
        <button
          className={`save-btn ${hasPending ? "pending" : ""}`}
          onClick={handleSaveAll}
        >
          💾 保存
          {hasPending && <span className="pending-dot" />}
        </button>
      </div>

      <div className="table-scroll-wrapper">
        <table className="timetable-table">
          <thead>
            <tr>
              <th className="th-period">時限</th>
              {CLASSES.map(cls => (
                <th key={cls} className="th-class" style={{ backgroundColor: getClassColor(cls) }}>
                  {cls}
                </th>
              ))}
            </tr>
            <tr className="th-subrow">
              <th></th>
              {CLASSES.map(cls => (
                <th key={cls} className="th-subheader">
                  <span>教科</span>
                  <span>教員</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(period => {
              const isLunch = period === "給食";
              return (
                <tr key={period} className={isLunch ? "lunch-row" : ""}>
                  <td className="td-period">
                    <span className="period-label">{period}</span>
                  </td>
                  {CLASSES.map(cls => (
                    <TimetableCell
                      key={`${cls}|${period}`}
                      className={cls}
                      period={period}
                      subject={getCellValue(cls, period, "subject")}
                      teacher={getCellValue(cls, period, "teacher")}
                      templateSubject={getTemplateValue(cls, period, "subject")}
                      templateTeacher={getTemplateValue(cls, period, "teacher")}
                      subjects={subjects}
                      teachers={teachers}
                      onUpdate={(field, value) => handleCellUpdate(cls, period, field, value)}
                      isLunch={isLunch}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="legend">
        <span className="legend-item">
          <span className="legend-dot changed-dot" />
          テンプレートと異なる（ハイライト）
        </span>
        <span className="legend-item">
          <span className="legend-dot pending-legend-dot" />
          未保存の変更
        </span>
        <span className="legend-sep">クリック: ドロップダウン / ダブルクリック: 手入力</span>
      </div>
    </section>
  );
}
