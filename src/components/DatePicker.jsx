import { getDateString } from "../utils/constants";

export default function DatePicker({ selectedDate, onDateChange, dayOfWeek }) {
  const today = getDateString(new Date());

  function prevDay() {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() - 1);
    onDateChange(getDateString(d));
  }

  function nextDay() {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    onDateChange(getDateString(d));
  }

  const isWeekend = dayOfWeek === "土" || dayOfWeek === "日";

  return (
    <section className="date-section">
      <div className="date-picker-row">
        <button className="date-nav-btn" onClick={prevDay} aria-label="前の日">
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
        <button className="date-nav-btn" onClick={nextDay} aria-label="次の日">
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
