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

export default function TeacherScheduleExport({ allData, teachers }) {
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [baseDate, setBaseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [weekData, setWeekData] = useState(null);

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
    if (actual) return { class_name: actual.class_name, subject: actual.subject || "", source: "actual" };

    // 2. テンプレートから検索
    if (!["月","火","水","木","金"].includes(dayLabel)) return null;
    const tmpl = allData.find(
      r =>
        r.class_name === "DAY_TEMPLATE" &&
        r.day_template_day === dayLabel &&
        r.day_template_period === period &&
        r.day_template_teacher === selectedTeacher
    );
    if (!tmpl) return null;

    // 実データが存在する場合はテンプレート不使用
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

  function buildWeekData() {
    if (!selectedTeacher) { alert("教員を選択してください"); return; }
    const monday = getMonday(baseDate);
    const schedule = DAYS_JA.map((day, i) => {
      const date = addDays(monday, i);
      const periods = DISPLAY_PERIODS.map(period => {
        const result = findCellForTeacher(date, day, period);
        return { period, class_name: result?.class_name || "", subject: result?.subject || "", source: result?.source || "" };
      });
      return { day, date, periods };
    });
    setWeekData({ teacher: selectedTeacher, monday, schedule });
  }

  function exportToExcel() {
    if (!weekData) return;

    const wb = XLSX.utils.book_new();

    // ============================================================
    // 画像と同じ形式のシート
    // 列: A=時限, B=空, C=月曜日(3列), F=火曜日(3列)...
    // 各時限3行: [クラス/教員], [教科/学習内容], [場所]
    // ============================================================

    const ws = {};
    const range = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };

    function setCell(row, col, value, style) {
      const addr = XLSX.utils.encode_cell({ r: row, c: col });
      ws[addr] = { v: value, t: typeof value === "number" ? "n" : "s", ...style };
      if (row > range.e.r) range.e.r = row;
      if (col > range.e.c) range.e.c = col;
    }

    // --- 列レイアウト ---
    // A(0): 時限ラベル
    // 各曜日: 3列ずつ (クラス列, 教科列, 場所列)
    // 月: B(1)C(2)D(3), 火: E(4)F(5)G(6), 水: H(7)I(8)J(9), 木: K(10)L(11)M(12), 金: N(13)O(14)P(15)
    const DAY_COL_START = [1, 4, 7, 10, 13]; // 各曜日の開始列

    // --- 行レイアウト ---
    // 行0: 空
    // 行1: ヘッダー（週の日付）
    // 各時限: 3行ずつ
    // 給食: 2行

    // 時限ごとの開始行を計算
    const PERIOD_ROW_START = {};
    let currentRow = 2; // ヘッダー行の次から

    for (const period of DISPLAY_PERIODS) {
      PERIOD_ROW_START[period] = currentRow;
      if (period === "給食") {
        currentRow += 2; // 給食は2行
      } else {
        currentRow += 3; // 通常は3行
      }
    }

    const totalRows = currentRow + 1; // まとめ行

    // --- ヘッダー行（行1）---
    const monday = weekData.monday;
    setCell(0, 0, `${weekData.teacher} 先生　週案`);
    setCell(1, 0, "");

    // 曜日ヘッダー
    weekData.schedule.forEach((d, i) => {
      const colStart = DAY_COL_START[i];
      const [, mm, dd] = d.date.split("-");
      setCell(1, colStart, `${parseInt(mm)}月${parseInt(dd)}日`);
      setCell(1, colStart + 1, `（${d.day}）`);
    });

    // --- 時限ラベル列（A列）---
    for (const period of DISPLAY_PERIODS) {
      const rowStart = PERIOD_ROW_START[period];
      const isLunch = period === "給食";
      const rowSpan = isLunch ? 2 : 3;

      // 時限ラベル（中央に配置）
      const midRow = rowStart + Math.floor(rowSpan / 2);
      setCell(midRow, 0, period);

      // 各曜日のデータを配置
      weekData.schedule.forEach((d, dayIdx) => {
        const colStart = DAY_COL_START[dayIdx];
        const cell = d.periods.find(p => p.period === period);

        if (isLunch) {
          // 給食: 2行
          setCell(rowStart,     colStart,     cell?.class_name || "");
          setCell(rowStart,     colStart + 1, cell?.subject    || "");
          setCell(rowStart + 1, colStart,     "");
          setCell(rowStart + 1, colStart + 1, "");
        } else {
          // 通常時限: 3行
          // 行1: クラス名 / 教員名
          setCell(rowStart,     colStart,     cell?.class_name ? cell.class_name : "");
          setCell(rowStart,     colStart + 1, cell?.class_name ? weekData.teacher : "");
          // 行2: 教科 / 学習内容
          setCell(rowStart + 1, colStart,     cell?.subject    || "");
          setCell(rowStart + 1, colStart + 1, "");
          // 行3: 場所
          setCell(rowStart + 2, colStart,     cell?.class_name ? "教室" : "");
          setCell(rowStart + 2, colStart + 1, "");
        }
      });
    }

    // まとめ行
    setCell(currentRow, 0, "まとめ");

    // --- 右側の凡例エリア（P列以降）---
    const legendCol = 17;
    setCell(1,  legendCol,     "学級・学年");
    setCell(1,  legendCol + 1, "児童名");
    setCell(3,  legendCol,     "教科等");
    setCell(3,  legendCol + 1, "学習内容");
    setCell(6,  legendCol,     "週初めの日付");
    setCell(8,  legendCol,     parseInt(monday.split("-")[2]));

    // --- ワークシート設定 ---
    ws["!ref"] = XLSX.utils.encode_range(range);

    // 列幅設定
    ws["!cols"] = [
      { wch: 5  },  // A: 時限
      { wch: 8  },  // B: 月曜クラス
      { wch: 10 },  // C: 月曜教科
      { wch: 8  },  // D: 月曜場所
      { wch: 8  },  // E: 火曜クラス
      { wch: 10 },  // F: 火曜教科
      { wch: 8  },  // G: 火曜場所
      { wch: 8  },  // H: 水曜クラス
      { wch: 10 },  // I: 水曜教科
      { wch: 8  },  // J: 水曜場所
      { wch: 8  },  // K: 木曜クラス
      { wch: 10 },  // L: 木曜教科
      { wch: 8  },  // M: 木曜場所
      { wch: 8  },  // N: 金曜クラス
      { wch: 10 },  // O: 金曜教科
      { wch: 8  },  // P: 金曜場所
      { wch: 3  },  // Q: 余白
      { wch: 10 },  // R: 凡例ラベル
      { wch: 12 },  // S: 凡例値
    ];

    // 行高設定
    ws["!rows"] = [
      { hpt: 16 }, // タイトル行
      { hpt: 20 }, // ヘッダー行
    ];
    for (const period of DISPLAY_PERIODS) {
      const isLunch = period === "給食";
      if (isLunch) {
        ws["!rows"].push({ hpt: 18 });
        ws["!rows"].push({ hpt: 18 });
      } else {
        ws["!rows"].push({ hpt: 18 });
        ws["!rows"].push({ hpt: 18 });
        ws["!rows"].push({ hpt: 14 }); // 場所行は少し小さく
      }
    }
    ws["!rows"].push({ hpt: 16 }); // まとめ行

    XLSX.utils.book_append_sheet(wb, ws, "週案");

    // --- シート2: 詳細リスト ---
    const detailRows = [];
    detailRows.push([`${weekData.teacher} 先生　週間詳細リスト`]);
    detailRows.push([`対象週：${weekData.monday}（月）〜 ${addDays(weekData.monday, 4)}（金）`]);
    detailRows.push([]);
    detailRows.push(["日付", "曜日", "時限", "クラス", "教科", "種別"]);

    let hasAny = false;
    for (const d of weekData.schedule) {
      for (const p of d.periods) {
        if (p.class_name) {
          detailRows.push([
            d.date,
            `${getWeekdayLabel(d.date)}曜日`,
            p.period,
            p.class_name,
            p.subject,
            p.source === "template" ? "テンプレート" : "入力済み",
          ]);
          hasAny = true;
        }
      }
    }

    if (!hasAny) detailRows.push(["この週の担当授業はありません"]);

    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
    wsDetail["!cols"] = [
      { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, "詳細リスト");

    const fileName = `${weekData.teacher}_週案_${weekData.monday}.xlsx`;
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

      {weekData && (
        <div className="teacher-preview">
          <div className="teacher-preview-header">
            <span className="teacher-preview-title">
              {weekData.teacher} 先生　{weekData.monday}（月）〜 {addDays(weekData.monday, 4)}（金）
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