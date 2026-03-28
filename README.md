# Novel Text Merge

小説・書籍の画像（WebP形式）から日本語テキストを自動抽出し、1つのテキストファイルに統合するツールです。
Claude AIの画像認識機能を使用し、縦書き・横書きの両方に対応しています。

> A tool that extracts Japanese text from novel/book images (WebP format) using Claude AI vision, supporting both vertical and horizontal text layouts.

---

## 特徴 / Features

- **縦書き・横書き対応** — 縦組み・横組みどちらの書籍にも対応
- **高精度OCR** — Claude claude-sonnet-4-6 による画像認識でインデント・改行・記号も正確に再現
- **名前順処理** — ファイルを自然順（1, 2, … 10, 11）でソートして処理
- **一括統合** — 最大500枚の画像を1つのテキストファイルに統合
- **2つのインターフェース** — コマンドライン（CLI）とブラウザ（Web UI）の両方で使用可能
- **Windows PowerShell 対応** — Node.js ベースのため `python` コマンド不要

---

## 必要要件 / Requirements

- [Node.js](https://nodejs.org/) 18.0.0 以上
- [Anthropic API キー](https://console.anthropic.com/)（有料）

---

## インストール / Installation

```powershell
# 1. リポジトリをクローン
git clone https://github.com/kanta7/Novel_Text_Merge.git
cd Novel_Text_Merge

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数を設定
copy .env.example .env
# .env をメモ帳で開いて ANTHROPIC_API_KEY=sk-ant-... を設定
```

---

## データ構造 / Data Structure

```
Novel_Text_Merge/
└── Novel_data/
    ├── Novel1/          ← 処理したいフォルダ
    │   ├── 1.webp
    │   ├── 2.webp
    │   └── ...
    └── Novel2/
        └── ...
```

`Novel_data/` フォルダ内にサブフォルダを作り、その中にWebP画像を連番で格納してください。

---

## 使い方 / Usage

### Web UI（推奨）

```powershell
node server.js
```

ブラウザが自動で開きます。開かない場合は `http://localhost:3000` を手動で開いてください。

フォルダを選択して「処理を開始」をクリックするだけです。

### コマンドライン（CLI）

```powershell
# 利用可能なフォルダ一覧を表示
node cli.js --list

# フォルダを指定して処理
node cli.js --folder Novel1

# オプションをすべて指定する場合
node cli.js --folder Novel1 --data-dir ./Novel_data --output-dir ./output --model claude-sonnet-4-6
```

**CLIオプション:**

| オプション | デフォルト | 説明 |
|---|---|---|
| `--folder NAME` | (必須) | 処理するフォルダ名 |
| `--data-dir PATH` | `./Novel_data` | 小説フォルダの親ディレクトリ |
| `--output-dir PATH` | `./output` | テキスト出力先ディレクトリ |
| `--api-key KEY` | 環境変数から取得 | Anthropic APIキー |
| `--model MODEL` | `claude-sonnet-4-6` | 使用するClaudeモデル |
| `--list` | — | フォルダ一覧を表示して終了 |
| `--help` | — | ヘルプを表示 |

---

## 出力 / Output

- **保存先:** `output/{フォルダ名}.txt`
- **文字コード:** UTF-8 BOM付き（Windows Notepad・日本語テキストエディタ対応）
- **ページ区切り:** 画像間は空行（`\n\n`）で区切られます

---

## 制限事項 / Limitations

- 1フォルダあたりの最大画像枚数: **500枚**
- 対応画像形式: **WebP のみ**
- Anthropic APIの利用料金が発生します（claude-sonnet-4-6 は1ページあたり約 $0.003〜$0.005 程度）
- Web UIからの処理中キャンセルはサーバー側処理を停止しません

---

## ライセンス / License

MIT License

---

## 謝辞 / Acknowledgements

- [Anthropic Claude](https://www.anthropic.com/) — 画像テキスト認識
- [Express](https://expressjs.com/) — Web サーバーフレームワーク
