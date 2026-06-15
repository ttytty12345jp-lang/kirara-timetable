import { useState, useCallback } from "react";
import { CLASSES, DAYS, PERIODS, DEFAULT_SUBJECTS, DEFAULT_TEACHERS, DEFAULT_SPECIAL_SUBJECTS } from "../utils/constants";
import TemplateEditor from "./TemplateEditor";
import TeacherScheduleExport from "./TeacherScheduleExport";

export default function SettingsSection({
  subjects, teachers, specialSubjects,
  getTemplateData, onSave, onDelete, onShowToast,
  selectedDate, dayData, allData
}) {
  const [activeTab, setActiveTab] = useState("master");
  const [subjectsInput, setSubjectsInput] = useState(subjects.join(","));
  const [teachersInput, setTeachersInput] = useState(teachers.join(","));
  const [specialInput, setSpecialInput] = useState(specialSubjects.join(","));

  function saveConfig(key, value) {
    onSave({ config_key: key, config_value: value });
  }

  function handleMasterSave() {
    saveConfig("subjects_list", subjectsInput);
    saveConfig("teachers_list", teachersInput);
    saveConfig("special_subject", specialInput);
    onShowToast("設定を更新しました ✓");
  }

  function handleMasterReset() {
    const s = DEFAULT_SUBJECTS.join(",");
    const t = DEFAULT_TEACHERS.join(",");
    const sp = DEFAULT_SPECIAL_SUBJECTS.join(",");
    setSubjectsInput(s);
    setTeachersInput(t);
    setSpecialInput(sp);
    saveConfig("subjects_list", s);
    saveConfig("teachers_list", t);
    saveConfig("special_subject", sp);
    onShowToast("デフォルトにリセットしました");
  }

  const tabs = [
    { id: "master", label: "📚 教科・教員" },
    { id: "template", label: "📅 テンプレート" },
    { id: "teacher", label: "👨‍🏫 教員スケジュール" },
    { id: "export", label: "📤 データ管理" },
  ];

  return (
    <section className="settings-section">
      <div className="settings-header">
        <h2 className="section-title">⚙️ 設定</h2>
      </div>

      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "master" && (
        <div className="tab-content">
          <div className="form-group">
            <label className="form-label">教科リスト（カンマ区切り）</label>
            <textarea
              className="form-textarea"
              value={subjectsInput}
              onChange={e => setSubjectsInput(e.target.value)}
              rows={3}
              placeholder="国,算,理,社,英..."
            />
            <div className="chip-preview">
              {subjectsInput.split(",").filter(Boolean).map(s => (
                <span key={s} className="chip">{s.trim()}</span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">教員リスト（カンマ区切り）</label>
            <textarea
              className="form-textarea"
              value={teachersInput}
              onChange={e => setTeachersInput(e.target.value)}
              rows={3}
              placeholder="山田,田中,鈴木..."
            />
            <div className="chip-preview">
              {teachersInput.split(",").filter(Boolean).map(t => (
                <span key={t} className="chip chip-teacher">{t.trim()}</span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">特別クラス教科（えい・かに用、カンマ区切り）</label>
            <textarea
              className="form-textarea"
              value={specialInput}
              onChange={e => setSpecialInput(e.target.value)}
              rows={2}
              placeholder="2-2算,４年国..."
            />
          </div>

          <div className="btn-row">
            <button className="primary-btn" onClick={handleMasterSave}>設定を更新</button>
            <button className="ghost-btn" onClick={handleMasterReset}>デフォルトに戻す</button>
          </div>
        </div>
      )}

      {activeTab === "template" && (
        <TemplateEditor
          teachers={teachers}
          subjects={subjects}
          specialSubjects={specialSubjects}
          getTemplateData={getTemplateData}
          onSave={onSave}
          onDelete={onDelete}
          onShowToast={onShowToast}
          selectedDate={selectedDate}
          dayData={dayData}
          allData={allData}
        />
      )}

      {activeTab === "teacher" && (
        <TeacherScheduleExport
          dayData={dayData}
          allData={allData}
          teachers={teachers}
          getTemplateData={getTemplateData}
        />
      )}

      {activeTab === "export" && (
        <DataManagement allData={allData} onShowToast={onShowToast} />
      )}
    </section>
  );
}

function DataManagement({ allData, onShowToast }) {
  function handleExport() {
    const json = JSON.stringify(allData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kirara_timetable_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast("エクスポートしました ✓");
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        localStorage.setItem("kirara_timetable_data", JSON.stringify(data));
        onShowToast("インポートしました。ページを更新してください。");
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        onShowToast("ファイルの読み込みに失敗しました", "error");
      }
    };
    reader.readAsText(file);
  }

  const timetableCount = allData.filter(r => r.date && !r.config_key && r.class_name !== "DAY_TEMPLATE").length;
  const templateCount = allData.filter(r => r.class_name === "DAY_TEMPLATE").length;
  const configCount = allData.filter(r => r.config_key).length;

  return (
    <div className="tab-content">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-num">{timetableCount}</div>
          <div className="stat-label">時間割レコード</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{templateCount}</div>
          <div className="stat-label">テンプレート</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{configCount}</div>
          <div className="stat-label">設定</div>
        </div>
      </div>

      <div className="btn-row">
        <button className="primary-btn" onClick={handleExport}>
          📤 JSONエクスポート
        </button>
        <label className="ghost-btn" style={{ cursor: "pointer" }}>
          📥 JSONインポート
          <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
        </label>
      </div>
      <p className="hint-text">データはブラウザのlocalStorageに保存されています。バックアップのためJSONエクスポートを推奨します。</p>
    </div>
  );
}