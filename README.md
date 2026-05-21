# ✨ きらら時間割

学校の複数クラスの時間割を一元管理・編集するWebアプリケーション。

## 機能

- 📅 日付ごとの時間割表示・編集
- 📋 曜日別テンプレート機能
- 🎨 学年別カラーコーディング
- 🔴 テンプレートとの差分ハイライト
- 💾 ブラウザlocalStorageでデータ永続化
- 📤 JSONエクスポート/インポート

## クラス構成

- 通常クラス: 1-1 〜 6-2 (12クラス)
- 特別クラス: いるか / えい・かに

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開く

## ビルド

```bash
npm run build
```

`dist/` フォルダに静的ファイルが生成されます。

## GitHub Pagesへのデプロイ

1. GitHubにリポジトリを作成してプッシュ
2. Settings → Pages → Source: GitHub Actions を選択
3. `main` ブランチにプッシュすると自動デプロイ

vite.config.js の `base` にリポジトリ名を設定が必要な場合:
```js
base: "/your-repo-name/",
```

## フォルダ構成

```
kirara-timetable/
├── src/
│   ├── App.jsx              ← アプリ全体の状態管理
│   ├── main.jsx             ← エントリーポイント
│   ├── index.css            ← 全スタイル（CSS変数で管理）
│   ├── components/
│   │   ├── Header.jsx       ← ヘッダー
│   │   ├── DatePicker.jsx   ← 日付選択
│   │   ├── TimetableGrid.jsx ← メイン時間割表
│   │   ├── SettingsSection.jsx ← 設定（タブUI）
│   │   ├── TemplateEditor.jsx ← 曜日別テンプレート編集
│   │   └── Toast.jsx        ← 通知トースト
│   ├── hooks/
│   │   └── useStorage.js    ← localStorage CRUD
│   └── utils/
│       └── constants.js     ← クラス/時限/カラー定義
├── .github/workflows/
│   └── deploy.yml           ← GitHub Pages 自動デプロイ
├── index.html
├── vite.config.js
└── package.json
```

## 主要ファイルの編集ガイド

| 変更内容 | 編集ファイル |
|----------|-------------|
| クラス追加/削除 | `src/utils/constants.js` → `CLASSES` |
| 時限追加 | `src/utils/constants.js` → `PERIODS` |
| 学年カラー変更 | `src/utils/constants.js` → `GRADE_COLORS` |
| UI色/テーマ変更 | `src/index.css` → `:root` CSS変数 |
| データ永続化をDBに変更 | `src/hooks/useStorage.js` |
| テーブルのセル挙動変更 | `src/components/TimetableGrid.jsx` |

## データ構造

localStorageキー: `kirara_timetable_data`

```json
[
  // 時間割レコード
  { "class_name": "1-1", "date": "2025-01-15", "period": "1限", "subject": "国", "teacher": "村上" },
  
  // テンプレートレコード
  { "class_name": "DAY_TEMPLATE", "day_template_day": "月", "day_template_class": "1-1", "day_template_period": "1限", "day_template_subject": "国", "day_template_teacher": "村上" },
  
  // 設定レコード
  { "config_key": "subjects_list", "config_value": "国,算,理,社..." }
]
```

## 将来の拡張案

- [ ] Firebase/Supabase連携（マルチデバイス同期）
- [ ] CSV一括インポート/エクスポート
- [ ] 印刷用レイアウト
- [ ] 変更履歴
- [ ] QRコード配布機能
