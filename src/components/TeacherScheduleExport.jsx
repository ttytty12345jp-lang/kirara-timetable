import { useState } from "react";
import * as XLSX from "xlsx";
import { CLASSES } from "../utils/constants";

const DISPLAY_PERIODS = ["1限", "2限", "3限", "4限", "給食", "5限", "6限"];
const DAYS_JA = ["月", "火", "水", "木", "金"];

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

function addDays(dateStr, n) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const rDay = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${rDay}`;
}

function getWeekdayLabel(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  const labels = ["日", "月", "火", "水", "木", "金", "土"];
  return labels[d.getDay()];
}

// 曜日ラベル（月〜金）→ day_template_day の値に対応
const DAY_LABEL_MAP = { "月": "月", "火": "火", "水": "水", "木": "木", "金": "金" };

export default function TeacherScheduleExport({ allData, teachers }) {
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [baseDate, setBaseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [weekData, setWeekData] = useState(null);

  // テンプレートから特定クラス・曜日・時限の教員・教科を取得
  function getTemplateRecord(dayLabel, cls, period) {
    return allData.find(
      r =>
        r.class_name === "DAY_TEMPLATE" &&
        r.day_template_day === dayLabel &&
        r.day_template_class === cls &&
        r.day_template_period === period
    );
  }

  // 実データから特定日・クラス・時限のレコードを取得
  function getActualRecord(date, cls, period) {
    return allData.find(
      r =>
        r.date === date &&
        r.class_name === cls &&
        r.period === period &&
        !r.config_key &&
        r.class_name !== "DAY_TEMPLATE"
    );
  }

  // 指定教員が該当日・時限に担当しているクラス・教科を返す
  // 優先順位: 実データ > テンプレート
  function findCellForTeacher(date, dayLabel, period) {
    // 1. 実データから検索（全クラス）
    const actualRecord = allData.find(
      r =>
        r.date === date &&
        r.period === period &&
        r.teacher === selectedTeacher &&
        r.class_name &&
        r.class_name !== "DAY_TEMPLATE" &&
        !r.config_key
    );
    if (actualRecord) {
      return {
        class_name: actualRecord.class_name,
        subject: actualRecord.subject || "",
        source: "actual",
      };
    }

    // 2. テンプレートから検索（全クラス）
    // ただし、実データが存在する日のクラスはテンプレートより実データを優先
    if (!["月", "火", "水", "木", "金"].includes(dayLabel)) return null;

    const templateMatch = allData.find(
      r =>
        r.class_name === "DAY_TEMPLATE" &&
        r.day_template_day === dayLabel &&
        r.day_template_period === period &&
        r.day_template_teacher === selectedTeacher
    );

    if (!templateMatch) return null;

    const cls = templateMatch.day_template_class;

    // このクラス・日付の実データが存在する場合はテンプレートを使わない
    const actualExists = allData.some(
      r =>
        r.date === date &&
        r.class_name === cls &&
        r.period === period &&
        !r.config_key &&
        r.class_name !== "DAY_TEMPLATE"
    );

    if (actualExists) return null;

    return {
      class_name: cls,
      subject: templateMatch.day_template_subject || "",
      source: "template",
    };
  }

  function buildWeekData() {
    if (!selectedTeacher) {
      alert("教員を選択してください");
      return;
    }

    const monday = getMonday(baseDate);

    const weekDates = DAYS_JA.map((day, i) => ({
      day,
      date: addDays(monday, i),
    }));

    const schedule = weekDates.map(({ day, date }) => {
      const periods = DISPLAY_PERIODS.map(period => {
        const result = findCellForTeacher(date, day, period);
        return {
          period,
          class_name: result?.class_name || "",
          subject: result?.subject || "",
          source: result?.source || "",
        };
      });
      return { day, date, periods };
    });

    setWeekData({
      teacher: selectedTeacher,
      monday,
      schedule,
    });
  }

  function exportToExcel() {
    if (!weekData) return;

    const wb = XLSX.utils.book_new();

    // シート1: 週間サマリー
    const summaryRows = [];
    summaryRows.push([`${weekData.teacher} 先生　週間時間割`]);
    summaryRows.push([`対象週：${weekData.monday}（月）〜 ${addDays(weekData.monday, 4)}（金）`]);
    summaryRows.push([]);
    summaryRows.push([
      "時限",
      ...weekData.schedule.map(d => `${d.day}曜日\n${d.date}`),
    ]);

    DISPLAY_PERIODS.forEach((period, periodIdx) => {
      const row = [period];
      weekData.schedule.forEach(dayData => {
        const cell = dayData.periods[periodIdx];
        if (cell && cell.class_name) {
          row.push(`${cell.class_name}\n${cell.subject}`);
        } else {
          row.push("—");
        }
      });
      summaryRows.push(row);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [
      { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }
    ];
    wsSummary["!rows"] = [
      { hpt: 20 }, { hpt: 16 }, { hpt: 8 }, { hpt: 32 },
      ...DISPLAY_PERIODS.map(() => ({ hpt: 32 })),
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, "週間サマリー");

    // シート2: 詳細リスト
    const detailRows = [];
    detailRows.push([`${weekData.teacher} 先生　週間詳細リスト`]);
    detailRows.push([`対象週：${weekData.monday}（月）〜 ${addDays(weekData.monday, 4)}（金）`]);
    detailRows.push([]);
    detailRows.push(["日付", "曜日", "時限", "クラス", "教科", "データ種別"]);

    let hasAny = false;
    for (const dayData of weekData.schedule) {
      for (const cell of dayData.periods) {
        if (cell.class_name) {
          detailRows.push([
            dayData.date,
            `${getWeekdayLabel(dayData.date)}曜日`,
            cell.period,
            cell.class_name,
            cell.subject,
            cell.source === "template" ? "テンプレート" : "入力済み",
          ]);
          hasAny = true;
        }
      }
    }

    if (!hasAny) {
      detailRows.push(["この週の担当授業はありません"]);
    }

    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
    wsDetail["!cols"] = [
      { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, "詳細リスト");

    const fileName = `${weekData.teacher}_週間時間割_${weekData.monday}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  const totalCount = weekData
    ? weekData.schedule.reduce((sum, d) => sum + d.periods.filter(p => p.class_name).length, 0)
    : 0;

  return (
    <div className="tab-content">
      <div className="form-group">
        <label className="form-label">教員を選択</label>
        <select
          className="form-select"
          value={selectedTeacher}
          onChange={e => { setSelectedTeacher(e.target.value); setWeekData(null); }}
        >
          <option value="">— 選択してください —</option>
          {teachers.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
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

      <div className="btn-row">
        <button className="primary-btn" onClick={buildWeekData}>
          🔍 検索
        </button>
        <button
          className="secondary-btn"
          onClick={exportToExcel}
          disabled={!weekData}
          style={{ opacity: weekData ? 1 : 0.4 }}
        >
          📥 Excelダウンロード
        </button>
      </div>

      {weekData && (
        <div className="teacher-preview">
          <div className="teacher-preview-header">
            <span className="teacher-preview-title">
              {weekData.teacher} 先生　{weekData.monday}（月）〜 {addDays(weekData.monday, 4)}（金）
            </span>
            <span className="teacher-total-badge">
              週計 {totalCount} コマ
            </span>
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
                        <td
                          key={d.day}
                          className={`teacher-cell ${hasClass ? "teacher-cell-filled" : ""} ${cell?.source === "template" ? "teacher-cell-template" : ""}`}
                        >
                          {hasClass ? (
                            <>
                              <div className="teacher-cell-class">{cell.class_name}</div>
                              <div className="teacher-cell-subject">{cell.subject}</div>
                              {cell.source === "template" && (
                                <div className="teacher-cell-badge">テンプレ</div>
                              )}
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

          <details className="teacher-details">
            <summary>詳細リストを表示</summary>
            <table className="teacher-detail-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>曜日</th>
                  <th>時限</th>
                  <th>クラス</th>
                  <th>教科</th>
                  <th>種別</th>
                </tr>
              </thead>
              <tbody>
                {weekData.schedule.flatMap(d =>
                  d.periods
                    .filter(p => p.class_name)
                    .map((p, i) => (
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
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "12px" }}>
                      この週の担当授業はありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </div>
  );
}