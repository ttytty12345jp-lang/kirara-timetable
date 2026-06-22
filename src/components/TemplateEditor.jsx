import React, { useState, useEffect } from "react";
import { CLASSES, DAYS, DISPLAY_PERIODS } from "../utils/constants";

const TEMPLATE_PERIODS = DISPLAY_PERIODS;

export default function TemplateEditor({
  teachers, subjects, specialSubjects,
  getTemplateData, onSave, onDelete, onShowToast,
  selectedDate, dayData, allData
}) {
  const [selectedDay, setSelectedDay] = useState("月");
  const [selectedClass, setSelectedClass] = useState("1-1");
  const [fromMode, setFromMode] = useState(null); // null | "base" | "dated"
  const [fromDate, setFromDate] = useState("");
  const [localTemplate, setLocalTemplate] = useState({});

  // 3段表示（レイアウト）にするのは「えい・かに」のみ
  const isEikani = selectedClass === "えい・かに";
  const isF      = selectedClass === "F";

  // 特別クラス教科（specialSubjects）を参照するのは「えい・かに」と「いるか」
  const isSpecialSubjectClass = selectedClass === "えい・かに" || selectedClass === "いるか";

  // 実際に使う fromDate 値（base モードなら ""）
  const effectiveFrom = fromMode === "base" ? "" : fromMode === "dated" ? fromDate : null;

  useEffect(() => {
    if (effectiveFrom === null) { setLocalTemplate({}); return; }
    const tData = getTemplateData(selectedDay, selectedClass, effectiveFrom || undefined);
    const map = {};
    for (const rec of tData) {
      map[rec.day_template_period] = {
        subject: rec.day_template_subject || "",
        teacher: rec.day_template_teacher || "",
      };
    }
    setLocalTemplate(map);
  }, [selectedDay, selectedClass, effectiveFrom, allData]);

  function handleCellChange(period, field, value) {
    setLocalTemplate(prev => ({
      ...prev,
      [period]: { ...(prev[period] || {}), [field]: value }
    }));
  }

  const canSave = fromMode === "base" || (fromMode === "dated" && fromDate !== "");

  function handleSaveTemplate() {
    if (!canSave) return;
    const periodsToSave = [];

    if (isEikani) {
      // えい・かにのみ：3行分を保存
      const suffixes = ["", "_2", "_3"];
      for (const basePeriod of TEMPLATE_PERIODS) {
        if (basePeriod === "給食") {
          periodsToSave.push(basePeriod);
        } else {
          for (const sfx of suffixes) {
            periodsToSave.push(`${basePeriod}${sfx}`);
          }
        }
      }
    } else if (isF) {
      // F：2行分（教員のみ）を保存
      for (const basePeriod of TEMPLATE_PERIODS) {
        periodsToSave.push(basePeriod);
        if (basePeriod !== "給食") periodsToSave.push(`${basePeriod}_2`);
      }
    } else {
      // いるか・通常クラス：1行
      periodsToSave.push(...TEMPLATE_PERIODS);
    }

    for (const period of periodsToSave) {
      const vals = localTemplate[period] || {};
      onSave({
        class_name: "DAY_TEMPLATE",
        day_template_day: selectedDay,
        day_template_class: selectedClass,
        day_template_period: period,
        day_template_from: effectiveFrom,
        day_template_subject: vals.subject || "",
        day_template_teacher: vals.teacher || "",
      });
    }
    const fromLabel = effectiveFrom ? `（${effectiveFrom}〜）` : "（ベース）";
    onShowToast(`${selectedDay}曜 ${selectedClass}${fromLabel} テンプレートを保存しました ✓`);
  }

  function handleDeleteTemplate() {
    if (!canSave) return;
    const fromLabel = effectiveFrom ? `（${effectiveFrom}〜）` : "（ベース）";
    if (!confirm(`${selectedDay}曜 ${selectedClass} ${fromLabel} のテンプレートを削除しますか？`)) return;
    onDelete(r =>
      r.class_name === "DAY_TEMPLATE" &&
      r.day_template_day === selectedDay &&
      r.day_template_class === selectedClass &&
      (r.day_template_from || "") === effectiveFrom
    );
    setLocalTemplate({});
    onShowToast("テンプレートを削除しました");
  }

  function handleApplyToDate() {
    if (!selectedDate) return;
    const tData = getTemplateData(selectedDay, selectedClass);
    if (tData.length === 0) {
      onShowToast("テンプレートが空です", "error");
      return;
    }
    for (const rec of tData) {
      onSave({
        class_name: rec.day_template_class,
        date: selectedDate,
        period: rec.day_template_period,
        subject: rec.day_template_subject || "",
        teacher: rec.day_template_teacher || "",
      });
    }
    onShowToast(`${selectedDate} に適用しました ✓`);
  }

  // クラスに応じて参照する教科を切り替え
  const subjectOptions = isSpecialSubjectClass ? specialSubjects : subjects;

  return (
    <div className="tab-content">
      <div className="template-selectors">
        <div className="form-group-inline">
          <label className="form-label">曜日</label>
          <div className="day-btn-group">
            {DAYS.map(d => (
              <button
                key={d}
                className={`day-btn ${selectedDay === d ? "active" : ""}`}
                onClick={() => setSelectedDay(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group-inline">
          <label className="form-label">クラス</label>
          <select
            className="form-select"
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
          >
            {CLASSES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="form-group-inline">
          <label className="form-label">種別</label>
          <label className="from-mode-label">
            <input
              type="radio"
              name="fromMode"
              value="base"
              checked={fromMode === "base"}
              onChange={() => setFromMode("base")}
            />
            ベース（全日付）
          </label>
          <label className="from-mode-label" style={{ marginLeft: 12 }}>
            <input
              type="radio"
              name="fromMode"
              value="dated"
              checked={fromMode === "dated"}
              onChange={() => setFromMode("dated")}
            />
            開始日指定
          </label>
          {fromMode === "dated" && (
            <input
              type="date"
              className="form-select"
              style={{ marginLeft: 8 }}
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          )}
        </div>
        {fromMode === null && (
          <p className="template-from-note" style={{ color: "var(--danger, #ef4444)" }}>
            ベースまたは開始日指定を選択してください
          </p>
        )}
        {fromMode === "base" && (
          <p className="template-from-note">
            全日付に適用されるベーステンプレートを編集中
          </p>
        )}
        {fromMode === "dated" && fromDate && (
          <p className="template-from-note">
            {fromDate} 以降に適用されるテンプレートを編集中
          </p>
        )}
      </div>

      {isEikani ? (
        <EikaniTemplateTable
          periods={TEMPLATE_PERIODS}
          localTemplate={localTemplate}
          subjectOptions={subjectOptions}
          teachers={teachers}
          onCellChange={handleCellChange}
        />
      ) : isF ? (
        <FTemplateTable
          periods={TEMPLATE_PERIODS}
          localTemplate={localTemplate}
          teachers={teachers}
          onCellChange={handleCellChange}
        />
      ) : (
        <NormalTemplateTable
          periods={TEMPLATE_PERIODS}
          localTemplate={localTemplate}
          subjectOptions={subjectOptions}
          teachers={teachers}
          onCellChange={handleCellChange}
        />
      )}

      <div className="btn-row">
        <button className="primary-btn" onClick={handleSaveTemplate} disabled={!canSave} style={{ opacity: canSave ? 1 : 0.4 }}>
          💾 テンプレート保存
        </button>
        <button className="secondary-btn" onClick={handleApplyToDate}>
          📋 {selectedDate} に適用
        </button>
        <button className="danger-btn" onClick={handleDeleteTemplate} disabled={!canSave} style={{ opacity: canSave ? 1 : 0.4 }}>
          🗑 削除
        </button>
      </div>
    </div>
  );
}

// 通常クラス・いるか用テンプレートテーブル（1段表示）
function NormalTemplateTable({ periods, localTemplate, subjectOptions, teachers, onCellChange }) {
  return (
    <div className="template-table-wrapper">
      <table className="template-table">
        <thead>
          <tr>
            <th>時限</th>
            <th>教科</th>
            <th>教員</th>
          </tr>
        </thead>
        <tbody>
          {periods.map(period => {
            const isLunch = period === "給食";
            const vals = localTemplate[period] || {};
            return (
              <tr key={period} className={isLunch ? "lunch-row" : ""}>
                <td className="td-period-sm">{period}</td>
                <td>
                  <select
                    className="template-cell-select"
                    value={isLunch ? "" : (vals.subject || "")}
                    disabled={isLunch}
                    onChange={e => onCellChange(period, "subject", e.target.value)}
                  >
                    <option value="">—</option>
                    {!isLunch && subjectOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="template-cell-select"
                    value={vals.teacher || ""}
                    onChange={e => onCellChange(period, "teacher", e.target.value)}
                  >
                    <option value="">—</option>
                    {teachers.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// F専用テンプレートテーブル（2行・教員のみ）
function FTemplateTable({ periods, localTemplate, teachers, onCellChange }) {
  const rowDefs = [
    { label: "①", sfx: ""   },
    { label: "②", sfx: "_2" },
  ];

  return (
    <div className="template-table-wrapper">
      <table className="template-table template-table-special">
        <thead>
          <tr>
            <th>時限</th>
            <th>行</th>
            <th>教員</th>
          </tr>
        </thead>
        <tbody>
          {periods.map(basePeriod => {
            const isLunch = basePeriod === "給食";
            if (isLunch) {
              const vals = localTemplate[basePeriod] || {};
              return (
                <tr key={basePeriod} className="lunch-row">
                  <td className="td-period-sm">{basePeriod}</td>
                  <td className="td-row-label">—</td>
                  <td>
                    <select
                      className="template-cell-select"
                      value={vals.teacher || ""}
                      onChange={e => onCellChange(basePeriod, "teacher", e.target.value)}
                    >
                      <option value="">—</option>
                      {teachers.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                </tr>
              );
            }
            return (
              <React.Fragment key={basePeriod}>
                {rowDefs.map((def, idx) => {
                  const period = `${basePeriod}${def.sfx}`;
                  const vals = localTemplate[period] || {};
                  return (
                    <tr key={period}>
                      {idx === 0 && (
                        <td className="td-period-sm" rowSpan={2}>{basePeriod}</td>
                      )}
                      <td className="td-row-label">{def.label}</td>
                      <td>
                        <select
                          className="template-cell-select"
                          value={vals.teacher || ""}
                          onChange={e => onCellChange(period, "teacher", e.target.value)}
                        >
                          <option value="">—</option>
                          {teachers.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// えい・かに専用テンプレートテーブル（3行表示）
function EikaniTemplateTable({ periods, localTemplate, subjectOptions, teachers, onCellChange }) {
  const suffixes = ["", "_2", "_3"];
  const rowLabels = ["①", "②", "③"];

  return (
    <div className="template-table-wrapper">
      <table className="template-table template-table-special">
        <thead>
          <tr>
            <th>時限</th>
            <th>行</th>
            <th>教科</th>
            <th>教員</th>
          </tr>
        </thead>
        <tbody>
          {periods.map(basePeriod => {
            const isLunch = basePeriod === "給食";
            
            if (isLunch) {
              const vals = localTemplate[basePeriod] || {};
              return (
                <tr key={basePeriod} className="lunch-row">
                  <td className="td-period-sm">{basePeriod}</td>
                  <td className="td-row-label">—</td>
                  <td>
                    <select
                      className="template-cell-select"
                      value=""
                      disabled
                    >
                      <option value="">—</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className="template-cell-select"
                      value={vals.teacher || ""}
                      onChange={e => onCellChange(basePeriod, "teacher", e.target.value)}
                    >
                      <option value="">—</option>
                      {teachers.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            }

            return (
              <React.Fragment key={basePeriod}>
                {suffixes.map((sfx, idx) => {
                  const period = `${basePeriod}${sfx}`;
                  const vals = localTemplate[period] || {};
                  return (
                    <tr key={period}>
                      {idx === 0 && (
                        <td className="td-period-sm" rowSpan={3}>{basePeriod}</td>
                      )}
                      <td className="td-row-label">{rowLabels[idx]}</td>
                      <td>
                        <select
                          className="template-cell-select"
                          value={vals.subject || ""}
                          onChange={e => onCellChange(period, "subject", e.target.value)}
                        >
                          <option value="">—</option>
                          {subjectOptions.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="template-cell-select"
                          value={vals.teacher || ""}
                          onChange={e => onCellChange(period, "teacher", e.target.value)}
                        >
                          <option value="">—</option>
                          {teachers.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}