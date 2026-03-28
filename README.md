# Novel Text Merge

小説・書籍の画像（WebP形式）からテキストを自動抽出し、1つのテキストファイルに統合するツールです。
Anthropic Claude・OpenAI GPT-4o・Google Gemini の3つの AI プロバイダに対応しており、縦書き・横書きの両方に対応しています。

> A tool that extracts text from novel/book images (WebP format) using AI vision (Claude, GPT-4o, or Gemini), supporting both vertical and horizontal text layouts.

---

## 特徴 / Features

- **マルチプロバイダ対応** — Anthropic Claude・OpenAI GPT-4o・Google Gemini を UI から切り替えて使用可能
- **日本語・英語 OCR** — 抽出言語（日本語 / English）を選択可能
- **縦書き・横書き対応** — 縦組み・横組みどちらの書籍にも対応
- **高精度 OCR** — インデント・改行・記号も正確に再現
- **名前順処理** — ファイルを自然順（1, 2, … 10, 11）でソートして処理
- **一括統合** — 最大 500 枚の画像を 1 つのテキストファイルに統合
- **リアルタイム進捗表示** — 処理中の進捗をブラウザにストリーミング表示
- **2 つのインターフェース** — コマンドライン（CLI）とブラウザ（Web UI）の両方で使用可能
- **Windows PowerShell 対応** — Node.js ベースのため `python` コマンド不要

---

## 必要要件 / Requirements

- [Node.js](https://nodejs.org/) 18.0.0 以上
- 以下のいずれかの API キー（使用するプロバイダ分のみ）:
  - [Anthropic API キー](https://console.anthropic.com/)（Claude）
  - [OpenAI API キー](https://platform.openai.com/api-keys)（GPT-4o）
  - [Google AI Studio API キー](https://aistudio.google.com/app/apikey)（Gemini）

---

## インストール / Installation

```powershell
# 1. リポジトリをクローン
git clone https://github.com/kanta7/Novel_Text_Merge.git
cd Novel_Text_Merge

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数を設定
copy .env.example .env.local
# .env.local をメモ帳で開いて API キーを設定
```

---

## API キーの設定 / API Key Configuration

`.env.local` に使いたいプロバイダのキーを追加するだけです。使わないプロバイダは省略できます。

```env
# Anthropic (デフォルト)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI を使う場合
OPENAI_API_KEY=sk-...

# Google Gemini を使う場合
GOOGLE_API_KEY=AIza...
```

> **ファイル名は必ず `.env.local`** にしてください（`.env` ではなく）。

各 API キーの取得先:
- Anthropic: https://console.anthropic.com/
- OpenAI: https://platform.openai.com/api-keys
- Google: https://aistudio.google.com/app/apikey

---

## おすすめプロバイダ / Recommended Provider

> **Google Gemini（`gemini-1.5-flash`）をおすすめします。**

### プロバイダ比較表

| 項目 | Anthropic (Claude) | OpenAI (GPT-4o) | ⭐ Google (Gemini) |
|---|---|---|---|
| デフォルトモデル | `claude-sonnet-4-6` | `gpt-4o` | `gemini-1.5-flash` |
| OCR 精度 | ◎ 高精度 | ◎ 高精度 | ○ 十分な精度 |
| 処理速度 | ○ 普通 | ○ 普通 | ◎ 高速 |
| コスト（目安/1000枚） | 約 $3〜5 | 約 $3〜5 | 約 $0.3〜0.5 |
| 無料枠 | なし | なし | あり（1分15リクエスト） |
| 日本語縦書き対応 | ◎ | ○ | ○ |

### Gemini をおすすめする理由

1. **圧倒的なコスト優位性** — `gemini-1.5-flash` は他の2プロバイダと比べて約 1/10 のコストで処理できます。数百ページの小説を処理してもほとんど費用がかかりません。
2. **無料枠がある** — Google AI Studio の無料枠（1分あたり15リクエスト）内であれば費用ゼロで試せます。
3. **十分な OCR 精度** — 小説テキストの抽出には十分な認識精度を持っています。
4. **高速処理** — レスポンスが速く、大量ページの処理でも待ち時間が短くなります。

> 縦書き日本語の精度を最優先する場合は **Anthropic Claude** が最も得意としています。

> Web UI の「使用する AI プロバイダ」ドロップダウンで実行時に切り替えられます。
> CLI では `--model` オプションで任意のモデル名を指定できます。

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

`Novel_data/` フォルダ内にサブフォルダを作り、その中に WebP 画像を連番で格納してください。

---

## 使い方 / Usage

### Web UI（推奨）

```powershell
node server.js
```

ブラウザが自動で開きます。開かない場合は `http://localhost:3000` を手動で開いてください。

1. **処理するフォルダ** を選択
2. **AI プロバイダ** を選択（Anthropic / OpenAI / Google）
3. **抽出言語** を選択（日本語 / English）
4. **「処理を開始」** をクリック
5. 完了後、**「テキストファイルをダウンロード」** で結果を取得

### コマンドライン（CLI）

```powershell
# 利用可能なフォルダ一覧を表示
node cli.js --list

# フォルダを指定して処理（Anthropic・日本語・デフォルトモデル）
node cli.js --folder Novel1

# OpenAI で処理する場合
node cli.js --folder Novel1 --api-key $env:OPENAI_API_KEY --model gpt-4o

# オプションをすべて指定する場合
node cli.js --folder Novel1 --data-dir ./Novel_data --output-dir ./output --model claude-sonnet-4-6
```

**CLI オプション:**

| オプション | デフォルト | 説明 |
|---|---|---|
| `--folder NAME` | (必須) | 処理するフォルダ名 |
| `--data-dir PATH` | `./Novel_data` | 小説フォルダの親ディレクトリ |
| `--output-dir PATH` | `./output` | テキスト出力先ディレクトリ |
| `--api-key KEY` | 環境変数から取得 | API キー |
| `--model MODEL` | `claude-sonnet-4-6` | 使用するモデル名 |
| `--list` | — | フォルダ一覧を表示して終了 |
| `--help` | — | ヘルプを表示 |

---

## 出力 / Output

- **保存先:** `output/{フォルダ名}.txt`
- **文字コード:** UTF-8 BOM 付き（Windows Notepad・日本語テキストエディタ対応）
- **ページ区切り:** 画像間は空行（`\n\n`）で区切られます

---

## エラーについて / Error Handling

- **API クレジット不足・認証エラー** — 最初の画像でエラーを検出し、即座に処理を中断してエラーメッセージを表示します（全画像を無駄に処理しません）
- **API レート制限（429）** — 最大 3 回まで指数バックオフ（2秒, 4秒, 8秒）で自動リトライします
- **一部画像のエラー** — 致命的でないエラーは `[OCR ERROR: ファイル名 - エラー内容]` として出力に含め、残りの処理を続行します

---

## 制限事項 / Limitations

- 1 フォルダあたりの最大画像枚数: **500 枚**
- 対応画像形式: **WebP のみ**
- 各プロバイダの利用料金が発生します
- Web UI からの処理中キャンセルはサーバー側処理を停止しません

---

## ライセンス / License

MIT License

---

## 謝辞 / Acknowledgements

- [Anthropic Claude](https://www.anthropic.com/) — 画像テキスト認識
- [OpenAI](https://openai.com/) — 画像テキスト認識
- [Google Gemini](https://deepmind.google/technologies/gemini/) — 画像テキスト認識
- [Express](https://expressjs.com/) — Web サーバーフレームワーク
