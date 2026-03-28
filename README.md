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
- **⚡ 並列処理（最大 10 件同時）** — 1 枚ずつではなく最大 10 枚を同時に AI 処理し、大幅に高速化
- **個別ファイル保存** — 各画像の抽出結果を `output/<フォルダ名>/<ファイル名>.txt` に随時保存。途中エラーでもそれまでの成果を保持
- **自動再開（Resume）機能** — 前回処理済みの画像はスキップして続きから再開。中断後も二重処理なし
- **名前順処理** — ファイルを自然順（1, 2, … 10, 11）でソートして処理
- **一括統合** — 最大 500 枚の画像を 1 つのテキストファイルに統合
- **リアルタイム進捗表示** — 処理中の進捗をブラウザにストリーミング表示（並列処理バッジ・スキップ件数を表示）
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

> **Google Gemini（`gemini-2.5-flash`）をおすすめします。**

### プロバイダ比較表

| 項目 | ⭐ Google Gemini | Anthropic Claude | OpenAI GPT-4o |
|---|---|---|---|
| デフォルトモデル | `gemini-2.5-flash` | `claude-sonnet-4-6` | `gpt-4o` |
| コスト（目安/1000枚） | **約 $0.5〜1** | 約 $3〜5 | 約 $3〜5 |
| 他社との比較 | **最安（約 1/5〜1/10）** | Gemini の約 5〜10倍 | Gemini の約 5〜10倍 |
| 無料枠 | **あり**（毎分10リクエスト） | なし | なし |
| 処理速度 | **◎ 高速** | ○ 普通 | ○ 普通 |
| OCR 精度 | **◎ 高精度** | ◎ 最高精度 | ◎ 高精度 |
| 日本語縦書き対応 | ◎ 向上 | **◎ 最も得意** | ○ |
| キー取得先 | [AI Studio](https://aistudio.google.com/app/apikey) | [Console](https://console.anthropic.com/) | [Platform](https://platform.openai.com/api-keys) |

### Gemini モデル選択の目安

| モデル | 特徴 | 向いている用途 |
|---|---|---|
| `gemini-2.5-flash` ⭐ | 高速・低コスト・高精度のバランス型 | 大量ページの一括処理（推奨） |
| `gemini-2.5-pro` | 最高精度・思考モデル搭載 | 精度最優先・難読文字が多い場合 |
| `gemini-1.5-flash` | 旧世代・最安 | コストを極限まで抑えたい場合 |

### Gemini をおすすめする理由

1. **大幅なコスト優位性** — `gemini-2.5-flash` は他の2プロバイダと比べて約 1/5〜1/10 のコストで処理できます。数百ページの小説でもほとんど費用がかかりません。
2. **無料枠がある** — Google AI Studio の無料枠（1分あたり10リクエスト）内であれば費用ゼロで試せます。
3. **最新モデルで高精度** — `gemini-2.5-flash` は旧世代（1.5）から OCR 精度・日本語理解が大幅に向上しており、小説テキストの抽出精度は Claude・GPT-4o と同等水準です。
4. **高速処理** — レスポンスが速く、大量ページの処理でも待ち時間が短くなります。

> 縦書き日本語の精度を最優先する場合は **Anthropic Claude** が最も得意としています。
> さらに高精度が必要な場合は `gemini-2.5-pro` への変更も選択肢です（CLI: `--model gemini-2.5-pro`）。

> Web UI の「使用する AI プロバイダ」ドロップダウンで実行時に切り替えられます。
> CLI では `--model` オプションで任意のモデル名を指定できます。

---

## データ構造 / Data Structure

```
Novel_Text_Merge/
├── Novel_data/
│   ├── Novel1/          ← 処理したいフォルダ
│   │   ├── 1.webp
│   │   ├── 2.webp
│   │   └── ...
│   └── Novel2/
│       └── ...
└── output/
    ├── Novel1/          ← 個別 txt（処理中に随時保存・再開用キャッシュ）
    │   ├── 1.txt
    │   ├── 2.txt
    │   └── ...
    └── Novel1.txt       ← 最終統合ファイル（ダウンロード対象）
```

`Novel_data/` フォルダ内にサブフォルダを作り、その中に WebP 画像を連番で格納してください。

> **個別 txt について:** `output/<フォルダ名>/` に処理が終わるたびに保存されます。途中でエラーや中断が起きても次回実行時に自動スキップして続きから処理します。すべて揃った段階で `output/<フォルダ名>.txt` に統合されます。

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

| ファイル | 説明 |
|---|---|
| `output/<フォルダ名>/<画像名>.txt` | 各画像の個別抽出結果（中間ファイル・再開用） |
| `output/<フォルダ名>.txt` | 全ページを順番通りに統合した最終ファイル（ダウンロード対象） |

- **文字コード:** UTF-8 BOM 付き（Windows Notepad・日本語テキストエディタ対応）
- **ページ区切り:** 画像間は空行（`\n\n`）で区切られます

---

## エラーについて / Error Handling

- **API クレジット不足・認証エラー** — 致命的エラーを検出した時点で全ワーカーを停止し、即座にエラーを表示します（無駄な API 呼び出しをしません）
- **API レート制限（429）** — 最大 3 回まで指数バックオフ（2秒, 4秒, 8秒）で自動リトライします
- **一部画像のエラー** — 致命的でないエラーは `[OCR ERROR: ファイル名 - エラー内容]` として個別 txt に保存し、残りの処理を続行します
- **途中中断・サーバー再起動** — `output/<フォルダ名>/` に保存済みの個別 txt が残るため、次回実行時に自動的に続きから再開します

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
