export const CLASSES = [
  "1-1", "1-2",
  "2-1", "2-2",
  "3-1", "3-2",
  "4-1", "4-2",
  "5-1", "5-2",
  "6-1", "6-2",
  "いるか",
  "えい・かに",
  "F",
];

export const PERIODS = ["1限", "2限", "3限", "4限", "5限", "6限", "給食"];

// えい・かに用の複数行対応時限
export const EIKANI_PERIODS = [
  "1限", "1限_2", "1限_3",
  "2限", "2限_2", "2限_3",
  "3限", "3限_2", "3限_3",
  "4限", "4限_2", "4限_3",
  "5限", "5限_2", "5限_3",
  "6限", "6限_2", "6限_3",
  "給食",
];

export const DEFAULT_SUBJECTS = [
  "国語", "と書", "算数", "生活", "理科", "社会", "英語",
  "図工", "体育","プール", "音楽", "総合", "家庭科", "道徳", "学活", "ク･委", "きららタイム"
];

export const DEFAULT_TEACHERS = [
  "村上", "西口", "福多", "北池", "生嶋", "後藤",
  "坂下", "佐藤", "信永", "川野", "木全", "山本", "在川"
];

export const DEFAULT_SPECIAL_SUBJECTS = [
  "2-2算", "４年国", "4-1算", "５年国","5-1国", "5-1算", "5-2算", "６年国"
];

export const GRADE_COLORS = {
  1: "#fce7f3",
  2: "#fef3c7",
  3: "#fecaca",
  4: "#dcfce7",
  5: "#fed7aa",
  6: "#ffffff",
};

export const IRUKA_COLOR  = "#eef0ff";
export const EIKANI_COLOR = "#c7d2fe";

export const DAYS = ["月", "火", "水", "木", "金"];

// ⭐【最重要・修正】世界標準時(UTC)を使わず、日本時間のまま「YYYY-MM-DD」の文字列を作ります
export function getDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ⭐【修正】こちらもタイムゾーンのズレを絶対に起こさないよう、お昼12時基準に統一します
export function getDayOfWeek(dateStr) {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const d = new Date(dateStr + "T12:00:00");
  return days[d.getDay()];
}

export function getGrade(className) {
  const match = className.match(/^(\d)/);
  return match ? parseInt(match[1]) : null;
}

export const F_CLASS_COLOR = "#ccfbf1";

export function getClassColor(className) {
  if (className === "F")       return F_CLASS_COLOR;
  if (className === "えい・かに" || className === "かに") return EIKANI_COLOR;
  if (className === "いるか")  return IRUKA_COLOR;
  const grade = getGrade(className);
  return grade && GRADE_COLORS[grade] ? GRADE_COLORS[grade] : "#f1f5f9";
}

export function getBasePeriod(period) {
  return period.replace(/_\d+$/, "");
}

export function isMainPeriod(period) {
  return !period.includes("_");
}

// テーブル表示用の時限順序（給食を4限と5限の間に）
export const DISPLAY_PERIODS = ["1限", "2限", "3限", "4限", "給食", "5限", "6限"];