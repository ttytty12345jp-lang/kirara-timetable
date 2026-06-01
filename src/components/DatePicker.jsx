import { getDateString } from "../utils/constants";

export default function DatePicker({ selectedDate, onDateChange, dayOfWeek }) {
  const today = getDateString(new Date());

  // ➔ 画面の「input（日付欄）」の値をその場で直接読み取って安全に計算する関数
  function handleNav(direction) {
    // 画面上のinput要素から、現在確実に入力されている日付文字列を取得します
    const inputEl = document.querySelector(".date-input");
    const currentStr = inputEl ? inputEl.value : selectedDate;

    // タイムゾーンのズレを防ぐため、お昼の12時を基準にオブジェクトを作成
    const d = new Date(currentStr + "T12:00:00");
    
    // directionが "prev" なら -1日、"next" なら +1日 する
    if (direction === "prev") {
      d.setDate(d.getDate() - 1);
    } else {
      d.setDate(d.getDate() + 1);
    }

    // 計算した日付を確実に上の階層（App.jsx）に伝える
    onDateChange(getDateString(d));
  }

  const isWeekend = dayOfWeek === "土" || dayOfWeek === "日";

  return (
    <section className="date-section">
      <div className="date-picker-row">
        {/* 左ボタン */}
        <button className="date-nav-btn" onClick={() => handleNav("prev")} aria-label="前の日">
          ‹
        </button>
        <div className="date-center">
          <input
            type="date"
            className="date-input"
            value={selectedDate}
            onChange={e => onDateChange(e.target.value)}
          />
          <span className={`day-badge ${isWeekend ? "weekend" : ""}`}>
            ({dayOfWeek})
          </span>
          {selectedDate === today && (
            <span className="today-badge">今日</span>
          )}
        </div>
        {/* 右ボタン */}
        <button className="date-nav-btn" onClick={() => handleNav("next")} aria-label="次の日">
          ›
        </button>
      </div>
      {selectedDate !== today && (
        <button className="today-btn" onClick={() => onDateChange(today)}>
          今日に戻る
        </button>
      )}
    </section>
  );
}