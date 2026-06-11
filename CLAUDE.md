# きらら時間割 - Claude Code 引き継ぎドキュメント

## プロジェクト概要

小学校の時間割を複数クラス・複数端末でリアルタイム管理するWebアプリ。
スマホ・PC両対応。教員が日々の時間割を入力・共有できる。

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フロント | React 18 + Vite |
| スタイル | CSS（CSS変数でテーマ管理） |
| DB・リアルタイム | Supabase（PostgreSQL + Realtime） |
| ホスティング | GitHub Pages（無料） |
| CI/CD | GitHub Actions（main pushで自動デプロイ） |
| Excel出力 | Supabase Edge Functions（Deno + xlsx） |

---

## フォルダ構成

```
kirara-timetable/
├── src/
│   ├── App.jsx                      ← ルート・状態管理・メモ機能
│   ├── main.jsx                     ← エントリーポイント
│   ├── index.css                    ← 全スタイル（CSS変数で管理）
│   ├── components/
│   │   ├── Header.jsx               ← 固定ヘッダー
│   │   ├── DatePicker.jsx           ← 日付選択・前後ナビ
│   │   ├── TimetableGrid.jsx        ← メイン時間割表（最重要）
│   │   ├── SettingsSection.jsx      ← 設定タブUI（4タブ）
│   │   ├── TemplateEditor.jsx       ← 曜日別テンプレート編集
│   │   ├── TeacherScheduleExport.jsx ← 教員週案Excel出力
│   │   └── Toast.jsx                ← 通知
│   ├── hooks/
│   │   └── useStorage.js            ← Supabase/localStorage CRUD
│   └── utils/
│       └── constants.js             ← クラス/時限/カラー定義
├── supabase/
│   └── functions/
│       └── export-weekly-sheet/     ← Edge Function（週案Excel生成）
│           └── index.ts
├── .github/workflows/
│   └── deploy.yml                   ← GitHub Pages 自動デプロイ
├── .env                             ← ローカル環境変数（gitignore済み）
├── CLAUDE.md                        ← このファイル
└── README.md
```

---

## クラス構成

```
通常クラス: 1-1, 1-2, 2-1, 2-2, 3-1, 3-2, 4-1, 4-2, 5-1, 5-2, 6-1, 6-2
特別クラス: いるか（1行表示）
           えい・かに（6行表示: 教①②③ / 員①②③）
```

---

## 時限表示順

```
1限 → 2限 → 3限 → 4限 → 給食 → 5限 → 6限
```

給食は4限と5限の間に配置。

---

## データ構造（Supabaseテーブル: `timetable`）

```sql
CREATE TABLE timetable (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 時間割レコード
  date TEXT,          -- "2026-06-11"
  class_name TEXT,    -- "1-1", "えい・かに" など
  period TEXT,        -- "1限", "給食", "1限_2"（えい・かに用サフィックス）
  subject TEXT,       -- "国語"
  teacher TEXT,       -- "村上"

  -- テンプレートレコード（class_name = "DAY_TEMPLATE"）
  day_template_day TEXT,      -- "月"〜"金"
  day_template_class TEXT,    -- クラス名
  day_template_period TEXT,   -- 時限
  day_template_subject TEXT,
  day_template_teacher TEXT,

  -- 設定レコード
  config_key TEXT,    -- "subjects_list", "teachers_list", "memo_2026-06-11" など
  config_value TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### レコード種別の判別方法

```js
if (record.config_key)              → 設定・メモ
if (record.class_name === "DAY_TEMPLATE") → テンプレート
else                                → 通常時間割
```

### えい・かにのperiodサフィックス

```
1限    → 教①/員① の行
1限_2  → 教②/員② の行
1限_3  → 教③/員③ の行
給食   → サフィックスなし（1行のみ）
```

---

## 主要な実装上の注意点

### 1. pendingChangesのキー形式

クラス名に `えい・かに` のように特殊文字が含まれるため、
キー区切りは `|`（パイプ）ではなく **タブ文字** を使用：

```js
const makeKey  = (cls, period) => `${cls}\t${period}`;
const parseKey = (key) => {
  const i = key.indexOf("\t");
  return { cls: key.slice(0, i), period: key.slice(i + 1) };
};
```

### 2. 空文字の保存

空文字 `""` も有効な値として扱う（テンプレートに戻さない）。
判定には `||` ではなく明示的な `null`/`undefined` チェックを使用：

```js
// ❌ ダメ（空文字がfalsyなのでテンプレートに戻る）
existing?.teacher || getTemplateValue(...)

// ✅ 正しい
existing !== undefined && existing.teacher !== null && existing.teacher !== undefined
  ? existing.teacher
  : getTemplateValue(...)
```

### 3. getCellValueの優先順位

```
1. pendingChanges（未保存の変更）
2. dayDataMap（保存済みデータ）← 空文字も有効
3. getTemplateValue（テンプレート）← データが一切ない場合のみ
```

### 4. Supabaseの1000件上限

デフォルトで1000件しか取得できないため、ページネーションで全件取得：

```js
while (true) {
  const { data } = await supabase
    .from("timetable")
    .select("*")
    .range(from, from + 999);
  allRecords = allRecords.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}
```

### 5. テンプレートの自動適用

その日の保存データがない場合、曜日に対応したテンプレートを自動表示。
保存ボタンを押すと実際のデータとして保存される。

---

## 設定タブの構成

| タブ | 内容 |
|------|------|
| 📚 教科・教員 | 教科/教員/特別教科リストの管理（カンマ区切り） |
| 📅 テンプレート | 曜日×クラス別のデフォルト時間割設定 |
| 👨‍🏫 教員スケジュール | 教員個人の週間スケジュール検索・Excel出力 |
| 📤 データ管理 | JSON エクスポート/インポート・統計表示 |

---

## Excel出力（教員週案）

### Edge Function

- 関数名: `export-weekly-sheet`（Supabaseダッシュボードからデプロイ）
- エンドポイント: `{SUPABASE_URL}/functions/v1/export-weekly-sheet`
- 認証: `--no-verify-jwt`（Anon Keyで呼び出し可能）

### 出力形式

```
行1: 月 + 担任名
行2: 週範囲（〇月〇日（月）〜〇月〇日（金））
行3: ヘッダー（1日（月）/ 2日（火）...）
各時限: 2行（クラス+教科行 / 場所行）
給食: 1行（クラスのみ）
まとめ: 大きな空欄（8行分）
```

### 場所の表示ルール

```js
if (className === "いるか")    → "いるか"
if (className === "えい・かに") → "きらら教室（えい）"
else                           → "教室"
```

---

## 環境変数

`.env` ファイル（プロジェクトルート）:

```
VITE_SUPABASE_URL=https://ddzpylceuerwnnbiefrd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...（Supabase Settings → API から取得）
```

GitHub Secrets にも同じ値を設定（Actions自動デプロイ用）:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## メモ機能

- 日付ごとに `config_key: "memo_{date}"` で保存
- 入力後800msのデバウンスで自動保存
- `App.jsx` の `MemoSection` コンポーネントで実装

---

## 既知の問題・注意点

1. **えい・かにのサフィックス付きperiod**（`1限_2`, `1限_3`等）は
   テンプレート・時間割・Excel出力すべてで対応が必要

2. **テンプレート編集画面**:
   - いるか → 通常の1行表示（`NormalTemplateTable`）
   - えい・かに → 3行表示（`EikaniTemplateTable`）

3. **リアルタイム同期**はSupabase Realtimeを使用。
   他端末の変更を受信したら `loadFromSupabase()` で全件再取得。

4. **GitHub Pages** へのデプロイ後は `.env` の変数が使われず、
   GitHub Secretsの値がビルド時に埋め込まれる。

---

## よく編集するファイルと用途

| ファイル | 編集タイミング |
|----------|--------------|
| `constants.js` | クラス追加・時限変更・カラー変更 |
| `index.css` | UI調整・スマホ対応・レイアウト変更 |
| `TimetableGrid.jsx` | 時間割表の表示・編集ロジック変更 |
| `useStorage.js` | データ保存・取得ロジック変更 |
| `TemplateEditor.jsx` | テンプレート編集UI変更 |
| `TeacherScheduleExport.jsx` | 教員スケジュール表示・Excel出力変更 |
| `supabase/functions/export-weekly-sheet/index.ts` | ExcelフォーマットをSupabase側で変更 |

---

## ローカル開発

```bash
npm install
npm run dev
# → http://localhost:5173
```

## ビルド・デプロイ

```bash
# ローカルビルド確認
npm run build
npm run preview

# 本番デプロイ（mainブランチにpushで自動）
git add .
git commit -m "変更内容"
git push origin main
```
