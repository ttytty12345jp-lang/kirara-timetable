import React, { useState, useEffect } from "react";
import { CLASSES, DAYS, getClassColor } from "../utils/constants";

// テンプレート編集時の表示順（給食を4限と5限の間に）
const TEMPLATE_PERIODS = ["1限", "2限", "3限", "4限", "給食", "5限", "6限"];

export default function TemplateEditor({
  teachers, subjects, specialSubjects,
  getTemplateData, onSave, onDelete, onShowToast,
  selectedDate, dayData, allData
}) {
  const [selectedDay, setSelectedDay] = useState("月");
  const [selectedClass, setSelectedClass] = useState("1-1");
  const [localTemplate, setLocalTemplate] = useState({});

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
    const isEikani = selectedClass === "えい・かに";

    for (const period of TEMPLATE_PERIODS) {
      if (period === "給食") {
        periodsToSave.push("給食");
      } else if (isEikani) {
        // 「えい・かに」だけ3つのキーを保存対象にする
        periodsToSave.push(period);
        periodsToSave.push(`${period}_2`);
        periodsToSave.push(`${period}_3`);
      } else {
        // 「いるか」を含むその他のクラスは通常通り1つだけ
        periodsToSave.push(period);
      }
    }

    for (const pKey of periodsToSave) {
      const vals = localTemplate[pKey] || {};
      onSave({
        class_name: "DAY_TEMPLATE",
        day_template_day: selectedDay,
        day_template_class: selectedClass,
        day_template_period: pKey,
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

  // 「えい・かに」と「いるか」は専科用の教科リストを使用
  const isSpecialClass = selectedClass === "えい・かに" || selectedClass === "いるか";
  const subjectOptions = isSpecialClass ? specialSubjects : subjects;

  // 「えい・かに」だけを3段表示にする判定
  const isEikani = selectedClass === "えい・かに";

  const subRows = ["教①", "教②", "教③"];
  const tchrRows = ["員①", "員②", "員③"];
  const suffixes = ["", "_2", "_3"];

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

      <div className="template-table-wrapper">
        <table className="template-table">
          <thead>
            <tr>
              <th>時限</th>
              <th>種別</th>
              <th>教科</th>
              <th>教員</th>
            </tr>
          </thead>
          <tbody>
            {TEMPLATE_PERIODS.map(period => {
              const isLunch = period === "給食";

              // ─── パターンA: 給食時間（全クラス共通） ───
              if (isLunch) {
                const vals = localTemplate["給食"] || {};
                return (
                  <tr key={period} className="lunch-row">
                    <td className="td-period-sm">{period}</td>
                    <td className="td-kind-sm">—</td>
                    <td>
                      <select className="template-cell-select" value="" disabled>
                        <option value="">—</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="template-cell-select"
                        value={vals.teacher || ""}
                        onChange={e => handleCellChange("給食", "teacher", e.target.value)}
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

              // ─── パターンB: 「えい・かに」クラス（3段構成） ───
              if (isEikani) {
                return (
                  <React.Fragment key={period}>
                    {subRows.map((label, i) => {
                      const pKey = `${period}${suffixes[i]}`;
                      const vals = localTemplate[pKey] || {};
                      return (
                        <tr key={`${period}-${label}`}>
                          {i === 0 && (
                            <td className="td-period-sm" rowSpan={6}>
                              {period}
                            </td>
                          )}
                          <td className="td-kind-sm" style={{ color: "#4b5563", fontWeight: "bold" }}>{label}</td>
                          <td>
                            <select
                              className="template-cell-select"
                              value={vals.subject || ""}
                              onChange={e => handleCellChange(pKey, "subject", e.target.value)}
                            >
                              <option value="">—</option>
                              {subjectOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ backgroundColor: "#f9fafb" }}>
                            <select className="template-cell-select" value="" disabled></select>
                          </td>
                        </tr>
                      );
                    })}
                    {tchrRows.map((label, i) => {
                      const pKey = `${period}${suffixes[i]}`;
                      const vals = localTemplate[pKey] || {};
                      return (
                        <tr key={`${period}-${label}`} style={{ borderBottom: i === 2 ? "2px solid #e5e7eb" : "1px dashed #e5e7eb" }}>
                          <td className="td-kind-sm" style={{ color: "#4b5563", fontWeight: "bold" }}>{label}</td>
                          <td style={{ backgroundColor: "#f9fafb" }}>
                            <select className="template-cell-select" value="" disabled></select>
                          </td>
                          <td>
                            <select
                              className="template-cell-select"
                              value={vals.teacher || ""}
                              onChange={e => handleCellChange(pKey, "teacher", e.target.value)}
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
              }

              // ─── パターンC: 「いるか」および通常クラス（1段構成） ───
              const vals = localTemplate[period] || {};
              return (
                <tr key={period}>
                  <td className="td-period-sm">{period}</td>
                  <td className="td-kind-sm">{selectedClass === "いるか" ? "専科" : "通常"}</td>
                  <td>
                    <select
                      className="template-cell-select"
                      value={vals.subject || ""}
                      onChange={e => handleCellChange(period, "subject", e.target.value)}
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
                      onChange={e => handleCellChange(period, "teacher", e.target.value)}
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