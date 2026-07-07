import React, { useState, useRef, useEffect, useCallback } from "react";
import { CLASSES, getClassColor, DISPLAY_PERIODS } from "../utils/constants";
const WEEKDAYS = new Set(["月", "火", "水", "木", "金"]);

// クラス名・時限名に絶対含まれないタブ文字でキーを生成
const makeKey  = (cls, period) => `${cls}\t${period}`;
const parseKey = (key) => {
  const i = key.indexOf("\t");
  return { cls: key.slice(0, i), period: key.slice(i + 1) };
};

// 指定した時限（表示上の列）に属する編集可能セルを全クラス分列挙する。
// カット機能で列全体を空白にするために使用。render のロジックと対応させる。
function cellsForPeriod(period) {
  const isLunch = period === "給食";
  const cells = [];
  for (const cls of CLASSES) {
    if (cls === "F") {
      if (isLunch) {
        cells.push({ cls, pKey: "給食", field: "teacher" });
      } else {
        cells.push({ cls, pKey: period,        field: "teacher" });
        cells.push({ cls, pKey: `${period}_2`, field: "teacher" });
      }
    } else if (cls === "えい・かに") {
      if (isLunch) {
        cells.push({ cls, pKey: "給食", field: "teacher" });
      } else {
        for (const sfx of ["", "_2", "_3"]) {
          cells.push({ cls, pKey: `${period}${sfx}`, field: "subject" });
          cells.push({ cls, pKey: `${period}${sfx}`, field: "teacher" });
        }
      }
    } else {
      // 通常クラス・いるか（給食の教科は固定なので教員のみ）
      if (isLunch) {
        cells.push({ cls, pKey: "給食", field: "teacher" });
      } else {
        cells.push({ cls, pKey: period, field: "subject" });
        cells.push({ cls, pKey: period, field: "teacher" });
      }
    }
  }
  return cells;
}

function isCellChanged(tpl, cur) {
  if (!tpl && !cur)       return false;
  if (!tpl &&  cur)       return true;
  if ( tpl && tpl !== cur) return true;
  return false;
}

const RESET_SENTINEL = "__RESET__";

function CellEditor({ value, options, onConfirm, onCancel, isDouble, templateValue }) {
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
      {templateValue && (
        <option value={RESET_SENTINEL}>↩ {templateValue}（デフォルト）</option>
      )}
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

  // 1. 未保存の変更（空文字も有効）
  if (pendingChanges[key]?.[field] !== undefined) {
    return pendingChanges[key][field];
  }

  // 2. 保存済みデータ（空文字も有効・nullのみ除外）
  const rec = dayDataMap.get(key);
  if (rec && field in rec && rec[field] !== null && rec[field] !== undefined) {
    return rec[field];
  }

  // 3. テンプレート（データが一切ない場合のみ）
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
    if (value === RESET_SENTINEL) {
      // テンプレート値を pending に入れる（保存済みデータより pending が優先されるため）
      const templateVal = getTemplateValue(cls, period, field);
      setPendingChanges(prev => ({
        ...prev,
        [key]: { ...(prev[key] || {}), [field]: templateVal },
      }));
    } else {
      setPendingChanges(prev => ({
        ...prev,
        [key]: { ...(prev[key] || {}), [field]: value },
      }));
    }
  }, [getTemplateValue]);

  const handleCancel = useCallback(() => setEditingCell(null), []);

  // 未保存の変更をすべて破棄し、保存前の状態に戻す
  const handleCancelAll = useCallback(() => {
    setPendingChanges({});
    setEditingCell(null);
  }, []);

  // その時限の全欄を空白にする（pending に "" を入れるだけ。保存は別途）
  const handleCutPeriod = useCallback((period) => {
    setPendingChanges(prev => {
      const next = { ...prev };
      for (const { cls, pKey, field } of cellsForPeriod(period)) {
        const key = makeKey(cls, pKey);
        next[key] = { ...(next[key] || {}), [field]: "" };
      }
      return next;
    });
  }, []);

  const handleSaveAll = useCallback(() => {
  const toSave = [];
  const savedKeys = new Set();

  for (const [key, changes] of Object.entries(pendingChanges)) {
    const { cls, period } = parseKey(key);
    const existing = dayDataMap.get(key);

    // ?? を使うことで空文字 "" を有効な値として扱う
    const subject = changes.subject !== undefined
      ? changes.subject
      : (existing !== undefined && existing.subject !== null && existing.subject !== undefined
          ? existing.subject
          : getTemplateValue(cls, period, "subject"));

    const teacher = changes.teacher !== undefined
      ? changes.teacher
      : (existing !== undefined && existing.teacher !== null && existing.teacher !== undefined
          ? existing.teacher
          : getTemplateValue(cls, period, "teacher"));

    toSave.push({
      class_name: cls,
      date:       selectedDate,
      period,
      subject,
      teacher,
    });
    savedKeys.add(key);
  }

  // pendingChanges にない既存データはそのまま保持
  for (const [key, rec] of dayDataMap.entries()) {
    if (!savedKeys.has(key)) {
      toSave.push(rec);
    }
  }

  for (const rec of toSave) onSave(rec);
  setPendingChanges({});
  onShowToast("保存しました ✓");
}, [pendingChanges, dayDataMap, selectedDate, getTemplateValue, onSave, onShowToast]);  const hasPending = Object.keys(pendingChanges).length > 0;

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
            templateValue={getTemplateValue(cls, pKey, field)}
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
        <div className="save-btn-group">
          <button
            className="cancel-btn"
            onClick={handleCancelAll}
            disabled={!hasPending}
          >
            ✕ キャンセル
          </button>
          <button
            className={`save-btn ${hasPending ? "pending" : ""}`}
            onClick={handleSaveAll}
          >
            💾 保存{hasPending && <span className="pending-dot" />}
          </button>
        </div>
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
              const isF      = cls === "F";
              const subjectOptions = (isEikani || isIruka) ? specialSubjects : subjects;

              if (isF) {
                const rowDefs = [
                  { label: "①", sfx: ""   },
                  { label: "②", sfx: "_2" },
                ];
                return (
                  <React.Fragment key={cls}>
                    {rowDefs.map((def, i) => (
                      <tr key={def.label} className="class-teacher-row">
                        {i === 0 && (
                          <td className="td-class-label" rowSpan={2} style={{ backgroundColor: bgColor }}>
                            <span className="class-label">{cls}</span>
                          </td>
                        )}
                        <td className="td-kind" style={{ backgroundColor: bgColor }}>
                          <span className="kind-label">{def.label}</span>
                        </td>
                        {DISPLAY_PERIODS.map(period => {
                          const isLunch = period === "給食";
                          const pKey    = isLunch ? period : `${period}${def.sfx}`;
                          return renderCell(cls, pKey, "teacher", teachers, isLunch, bgColor);
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              }

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
            <tr className="cut-row">
              <td colSpan={2} className="cut-row-label"></td>
              {DISPLAY_PERIODS.map(period => (
                <td key={period} className="cut-cell">
                  <button
                    type="button"
                    className="cut-btn"
                    onClick={() => handleCutPeriod(period)}
                    title={`${period}の全欄を空白にする（保存で確定）`}
                  >
                    カット
                  </button>
                </td>
              ))}
            </tr>
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