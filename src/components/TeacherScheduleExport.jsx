import { useState } from "react";
import * as XLSX from "xlsx";
import { CLASSES, getClassColor } from "../utils/constants";

const DISPLAY_PERIODS = ["1限", "2限", "3限", "4限", "給食", "5限", "6限"];
const DAYS_JA = ["月", "火", "水", "木", "金"];

function getMonday(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  
  // getDay() は 日:0, 月:1, 火:2, 水:3, 木:4, 金:5, 土:6
  // 月曜日(1)を基準として、何日前（または何日後）に引けば月曜日になるかを計算
  // 日曜日(0)の場合は 6日前 に戻す
  const diff = day === 0 ? -6 : 1 - day;
  
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

export default function TeacherScheduleExport({ allData, teachers }) {
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [baseDate, setBaseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [weekData, setWeekData] = useState(null);

  function buildWeekData() {
    if (!selectedTeacher) {
      alert("教員を選択してください");
      return;
    }

    const monday = getMonday(baseDate);

    // 月〜金の日付リスト
    const weekDates = DAYS_JA.map((day, i) => ({
      day,
      date: addDays(monday, i),
    }));

    // 各日・各時限のスケジュール構築
    const schedule = weekDates.map(({ day, date }) => {
      const periods = DISPLAY_PERIODS.map(period => {
        // 全クラスの中からこの日・時限・教員に一致するレコードを探す
        const record = allData.find(
          r =>
            r.date === date &&
            r.period === period &&
            r.teacher === selectedTeacher &&
            r.class_name &&
            r.class_name !== "DAY_TEMPLATE" &&
            !r.config_key
        );
        return {
          period,
          class_name: record?.class_name || "",
          subject: record?.subject || "",
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

    // ============================================================
    // シート1: 週間サマリー表（時限 × 曜日）
    // ============================================================
    const summaryRows = [];

    // タイトル
    summaryRows.push([`${weekData.teacher} 先生　週間時間割`]);
    summaryRows.push([`対象週：${weekData.monday}（月）〜 ${addDays(weekData.monday, 4)}（金）`]);
    summaryRows.push([]); // 空行

    // ヘッダー行
    summaryRows.push([
      "時限",
      ...weekData.schedule.map(d => `${d.day}曜日\n${d.date}`),
    ]);

    // 時限ごとの行
    for (const period of DISPLAY_PERIODS) {
      const row = [period];
      for (const dayData of weekData.schedule) {
        const cell = dayData.periods.find(p => p.period === period);
        if (cell && cell.class_name) {
          row.push(`${cell.class_name}\n${cell.subject}`);
        } else {
          row.push("—");
        }
      }
      summaryRows.push(row);
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

    // セルスタイル・列幅
    wsSummary["!cols"] = [
      { wch: 8 },   // 時限
      { wch: 16 },  // 月
      { wch: 16 },  // 火
      { wch: 16 },  // 水
      { wch: 16 },  // 木
      { wch: 16 },  // 金
    ];

    // 行高（ヘッダー行・データ行）
    wsSummary["!rows"] = [
      { hpt: 20 },  // タイトル
      { hpt: 16 },  // 日付
      { hpt: 8 },   // 空行
      { hpt: 32 },  // ヘッダー
      ...DISPLAY_PERIODS.map(() => ({ hpt: 32 })),
    ];

    XLSX.utils.book_append_sheet(wb, wsSummary, "週間サマリー");

    // ============================================================
    // シート2: 詳細リスト（1行1レコード）
    // ============================================================
    const detailRows = [];

    detailRows.push([`${weekData.teacher} 先生　週間詳細リスト`]);
    detailRows.push([`対象週：${weekData.monday}（月）〜 ${addDays(weekData.monday, 4)}（金）`]);
    detailRows.push([]);

    detailRows.push(["日付", "曜日", "時限", "クラス", "教科"]);

    let hasAny = false;
    for (const dayData of weekData.schedule) {
      for (const cell of dayData.periods) {
        if (cell.class_name) {
          detailRows.push([
            dayData.date,
            `${dayData.day}曜日`,
            cell.period,
            cell.class_name,
            cell.subject,
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
      { wch: 14 },  // 日付
      { wch: 8 },   // 曜日
      { wch: 8 },   // 時限
      { wch: 12 },  // クラス
      { wch: 12 },  // 教科
    ];

    XLSX.utils.book_append_sheet(wb, wsDetail, "詳細リスト");

    // 出力
    const fileName = `${weekData.teacher}_週間時間割_${weekData.monday}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // プレビュー用: 担当コマ数カウント
  const totalCount = weekData
    ? weekData.schedule.reduce((sum, d) =>
        sum + d.periods.filter(p => p.class_name).length, 0)
    : 0;

  return (
    <div className="tab-content">
      {/* 入力フォーム */}
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

      {/* プレビュー */}
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

          {/* 週間サマリー表 */}
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
                {DISPLAY_PERIODS.map(period => (
                  <tr key={period}>
                    <td className="td-period-fixed">{period}</td>
                    {weekData.schedule.map(d => {
                      const cell = d.periods.find(p => p.period === period);
                      const hasClass = cell?.class_name;
                      return (
                        <td
                          key={d.day}
                          className={`teacher-cell ${hasClass ? "teacher-cell-filled" : ""}`}
                        >
                          {hasClass ? (
                            <>
                              <div className="teacher-cell-class">{cell.class_name}</div>
                              <div className="teacher-cell-subject">{cell.subject}</div>
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

          {/* 詳細リスト */}
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
                </tr>
              </thead>
              <tbody>
                {weekData.schedule.flatMap(d =>
                  d.periods
                    .filter(p => p.class_name)
                    .map((p, i) => (
                      <tr key={`${d.day}-${i}`}>
                        <td>{d.date}</td>
                        <td>{d.day}曜</td>
                        <td>{p.period}</td>
                        <td>{p.class_name}</td>
                        <td>{p.subject}</td>
                      </tr>
                    ))
                )}
                {totalCount === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "12px" }}>
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