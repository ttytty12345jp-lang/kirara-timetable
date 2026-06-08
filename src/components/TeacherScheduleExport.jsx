import { useState } from "react";
import { CLASSES } from "../utils/constants";

const DISPLAY_PERIODS = ["1限", "2限", "3限", "4限", "給食", "5限", "6限"];
const DAYS_JA = ["月", "火", "水", "木", "金"];

// --- 補助関数: 指定日が含まれる週の月曜日を取得 ---
function getMonday(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  const dayOfWeek = d.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const rDay = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${rDay}`;
}

// --- 補助関数: 日付を加算 ---
function addDays(dateStr, n) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const rDay = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${rDay}`;
}

// --- 補助関数: 曜日のラベルを取得 ---
function getWeekdayLabel(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  const labels = ["日", "月", "火", "水", "木", "金", "土"];
  return labels[d.getDay()];
}

export default function TeacherScheduleExport({ allData, teachers }) {
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [baseDate, setBaseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [weekData, setWeekData] = useState(null);

  // --- 教員の該当日の持ちコマを検索（優先順位: 実データ > テンプレート） ---
  function findCellForTeacher(date, dayLabel, period) {
    // 1. 実データから検索
    const actual = allData.find(
      r =>
        r.date === date &&
        r.period === period &&
        r.teacher === selectedTeacher &&
        r.class_name &&
        r.class_name !== "DAY_TEMPLATE" &&
        !r.config_key
    );
    if (actual) {
      return { class_name: actual.class_name, subject: actual.subject || "", source: "actual" };
    }

    // 2. テンプレートから検索
    if (!["月", "火", "水", "木", "金"].includes(dayLabel)) return null;
    const tmpl = allData.find(
      r =>
        r.class_name === "DAY_TEMPLATE" &&
        r.day_template_day === dayLabel &&
        r.day_template_period === period &&
        r.day_template_teacher === selectedTeacher
    );
    if (!tmpl) return null;

    // 実データが存在する場合はテンプレートを使用しない
    const actualExists = allData.some(
      r =>
        r.date === date &&
        r.class_name === tmpl.day_template_class &&
        r.period === period &&
        !r.config_key &&
        r.class_name !== "DAY_TEMPLATE"
    );
    if (actualExists) return null;

    return { class_name: tmpl.day_template_class, subject: tmpl.day_template_subject || "", source: "template" };
  }

  // --- 画面上のプレビュー用データ構築 ---
  function buildWeekData() {
    if (!selectedTeacher) {
      alert("教員を選択してください");
      return;
    }
    const monday = getMonday(baseDate);
    const schedule = DAYS_JA.map((day, i) => {
      const date = addDays(monday, i);
      const periods = DISPLAY_PERIODS.map(period => {
        const result = findCellForTeacher(date, day, period);
        return {
          period,
          class_name: result?.class_name || "",
          subject: result?.subject || "",
          source: result?.source || ""
        };
      });
      return { day, date, periods };
    });
    setWeekData({ teacher: selectedTeacher, monday, schedule });
  }

  // --- 🌟 Edge Functionへデータを送りExcelをダウンロードする関数 ---
  async function exportToExcel() {
    if (!weekData) return;

    try {
      // ⚠️ ご自身のSupabaseのURL（https://〜.functions.supabase.co）に書き換えてください
      const SUPABASE_PROJECT_URL = "https://ddzpylceuerwnnbiefrd.supabase.co"; 
      const url = `${SUPABASE_PROJECT_URL}/functions/v1/export-weekly-sheet`;

      // サーバー（Edge Function）へPOSTリクエストを送信
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // もしSupabase側で認証キーが必須の場合は以下のコメントアウトを外してください
          // "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ weekData }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Excelの生成に失敗しました");
      }

      // レスポンスをバイナリファイル（Blob）として取得
      const blob = await response.blob();
      
      // ブラウザ上で擬似的なリンクを作って自動クリック（ダウンロード発火）
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${weekData.teacher}_週案_${weekData.monday}.xlsx`;
      link.click();
      
    } catch (error) {
      console.error(error);
      alert("Excel出力中にエラーが発生しました: " + error.message);
    }
  }

  // コマ数の集計
  const totalCount = weekData
    ? weekData.schedule.reduce((sum, d) => sum + d.periods.filter(p => p.class_name).length, 0)
    : 0;

  return (
    <div className="tab-content">
      {/* 条件選択フォーム */}
      <div className="form-group">
        <label className="form-label">教員を選択</label>
        <select
          className="form-select"
          value={selectedTeacher}
          onChange={e => { setSelectedTeacher(e.target.value); setWeekData(null); }}
        >
          <option value="">— 選択してください —</option>
          {teachers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">対象週（この日を含む月〜金）</label>
        <input
          type="date"
          className="date-input"
          value={baseDate}
          onChange={e => { setBaseDate(e.target.value); setWeekData(null); }}
        />
      </div>

      {/* ボタンエリア */}
      <div className="btn-row">
        <button className="primary-btn" onClick={buildWeekData}>🔍 検索</button>
        <button
          className="secondary-btn"
          onClick={exportToExcel}
          disabled={!weekData}
          style={{ opacity: weekData ? 1 : 0.4 }}
        >
          📥 Excelダウンロード
        </button>
      </div>

      {/* 画面上の時間割プレビュー表示 */}
      {weekData && (
        <div className="teacher-preview">
          <div className="teacher-preview-header">
            <span className="teacher-preview-title">
              {weekData.teacher} 先生 {weekData.monday}（月）〜 {addDays(weekData.monday, 4)}（金）
            </span>
            <span className="teacher-total-badge">週計 {totalCount} コマ</span>
          </div>

          <div className="teacher-table-scroll">
            <table className="teacher-table">
              <thead>
                <tr>
                  <th className="th-period-fixed">時限</th>
                  {weekData.schedule.map(d => (
                    <th key={d.day}>
                      <div className="th-day">{d.day}曜</div>
                      <div className="th-date">{d.date.slice(5)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DISPLAY_PERIODS.map((period, periodIdx) => (
                  <tr key={period}>
                    <td className="td-period-fixed">{period}</td>
                    {weekData.schedule.map(d => {
                      const cell = d.periods[periodIdx];
                      const hasClass = cell?.class_name;
                      return (
                        <td key={d.day}
                          className={`teacher-cell ${hasClass ? "teacher-cell-filled" : ""} ${cell?.source === "template" ? "teacher-cell-template" : ""}`}
                        >
                          {hasClass ? (
                            <>
                              <div className="teacher-cell-class">{cell.class_name}</div>
                              <div className="teacher-cell-subject">{cell.subject}</div>
                              {cell.source === "template" && <div className="teacher-cell-badge">テンプレ</div>}
                            </>
                          ) : (
                            <span className="teacher-cell-empty">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 開閉式アコーディオン（詳細リスト） */}
          <details className="teacher-details">
            <summary>詳細リストを表示</summary>
            <table className="teacher-detail-table">
              <thead>
                <tr><th>日付</th><th>曜日</th><th>時限</th><th>クラス</th><th>教科</th><th>種別</th></tr>
              </thead>
              <tbody>
                {weekData.schedule.flatMap(d =>
                  d.periods.filter(p => p.class_name).map((p, i) => (
                    <tr key={`${d.day}-${i}`}>
                      <td>{d.date}</td>
                      <td>{getWeekdayLabel(d.date)}曜</td>
                      <td>{p.period}</td>
                      <td>{p.class_name}</td>
                      <td>{p.subject}</td>
                      <td style={{ color: p.source === "template" ? "var(--text-muted)" : "var(--success)", fontSize: "9px" }}>
                        {p.source === "template" ? "テンプレ" : "入力済"}
                      </td>
                    </tr>
                  ))
                )}
                {totalCount === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "12px" }}>この週の担当授業はありません</td></tr>
                )}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </div>
  );
}