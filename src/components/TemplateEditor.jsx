import React, { useState, useEffect } from "react";
import { CLASSES, DAYS, getClassColor } from "../utils/constants";

const TEMPLATE_PERIODS = ["1限", "2限", "3限", "4限", "給食", "5限", "6限"];

export default function TemplateEditor({
  teachers, subjects, specialSubjects,
  getTemplateData, onSave, onDelete, onShowToast,
  selectedDate, dayData, allData
}) {
  const [selectedDay, setSelectedDay] = useState("月");
  const [selectedClass, setSelectedClass] = useState("1-1");
  const [localTemplate, setLocalTemplate] = useState({});

  // 3段表示（レイアウト）にするのは「えい・かに」のみ
  const isEikani = selectedClass === "えい・かに";
  
  // 特別クラス教科（specialSubjects）を参照するのは「えい・かに」と「いるか」
  const isSpecialSubjectClass = selectedClass === "えい・かに" || selectedClass === "いるか";

  useEffect(() => {
    const tData = getTemplateData(selectedDay, selectedClass);
    const map = {};
    for (const rec of tData) {
      map[rec.day_template_period] = {
        subject: rec.day_template_subject || "",
        teacher: rec.day_template_teacher || "",
      };
    }
    setLocalTemplate(map);
  }, [selectedDay, selectedClass, allData]);

  function handleCellChange(period, field, value) {
    setLocalTemplate(prev => ({
      ...prev,
      [period]: { ...(prev[period] || {}), [field]: value }
    }));
  }

  function handleSaveTemplate() {
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
        day_template_subject: vals.subject || "",
        day_template_teacher: vals.teacher || "",
      });
    }
    onShowToast(`${selectedDay}曜 ${selectedClass} テンプレートを保存しました ✓`);
  }

  function handleDeleteTemplate() {
    if (!confirm(`${selectedDay}曜 ${selectedClass} のテンプレートを削除しますか？`)) return;
    onDelete(r =>
      r.class_name === "DAY_TEMPLATE" &&
      r.day_template_day === selectedDay &&
      r.day_template_class === selectedClass
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
      </div>

      {isEikani ? (
        <EikaniTemplateTable
          periods={TEMPLATE_PERIODS}
          localTemplate={localTemplate}
          subjectOptions={subjectOptions}
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
        <button className="primary-btn" onClick={handleSaveTemplate}>
          💾 テンプレート保存
        </button>
        <button className="secondary-btn" onClick={handleApplyToDate}>
          📋 {selectedDate} に適用
        </button>
        <button className="danger-btn" onClick={handleDeleteTemplate}>
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