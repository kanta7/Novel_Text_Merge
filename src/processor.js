'use strict';

const fs = require('fs');
const path = require('path');
const { extractTextFromImage, createClient } = require('./extractor');
const { getImagePaths, writeOutput, writeTempFile, readTempFile, appendHistory } = require('./fileUtils');

/** 最大並列処理数 */
const CONCURRENCY = 10;

/**
 * 4xx 系の致命的エラーを取り出す。429 はリトライ対象なので致命的扱いしない。
 * @param {Error} err
 * @returns {Error|null}
 */
function extractFatalError(err) {
  const status = err.status ?? err.statusCode;
  if (!status || status === 429) return null;
  if (status >= 400 && status < 500) {
    // Anthropic スタイル: "400 {\"type\":\"error\",...}"
    try {
      const jsonStr = err.message.replace(/^\d+\s+/, '');
      const parsed = JSON.parse(jsonStr);
      const msg = parsed?.error?.message;
      if (msg) {
        const e = new Error(msg);
        e.isFatal = true;
        return e;
      }
    } catch {}
    // OpenAI / Google スタイル: メッセージがそのまま人間が読める形式
    if (err.message) {
      const e = new Error(err.message);
      e.isFatal = true;
      return e;
    }
  }
  return null;
}

/**
 * Scans all temp files for OCR errors. Returns array of { filename, message }.
 * @param {string[]} images - array of image paths
 * @param {string} tempDir - directory containing temp files
 * @returns {Array<{filename: string, message: string}>}
 */
function scanAllErrors(images, tempDir) {
  const allErrors = [];
  for (const imgPath of images) {
    const filename = path.basename(imgPath);
    const stem = path.basename(imgPath, path.extname(imgPath));
    const tmpFile = path.join(tempDir, `${stem}.txt`);
    if (!fs.existsSync(tmpFile)) continue;
    try {
      const content = readTempFile(tmpFile).trim();
      const match = content.match(/^\[OCR ERROR: .+? - (.+)\]$/);
      if (match) allErrors.push({ filename, message: match[1] });
    } catch {}
  }
  return allErrors;
}

/**
 * 並列処理 + 個別保存 + 再開対応のストリーミング版。
 *
 * 動作:
 * 1. output/<folderName>/ に個別 txt を保存しながら処理
 * 2. 既存の txt があれば対応画像をスキップ（再開機能）
 * 3. 最大 CONCURRENCY 件を同時並列処理
 * 4. 完了都度 SSE イベントを yield
 * 5. 全完了後に output/<folderName>.txt へ統合
 *
 * イベント形状: { current, total, filename, done, output, skipped?, errors? }
 *
 * @param {string} folderPath
 * @param {string} outputDir
 * @param {string} apiKey
 * @param {string} model
 * @param {string} language - 'ja' | 'en'
 * @param {string} provider - 'anthropic' | 'openai' | 'google'
 */
async function* processFolderStream(
  folderPath, outputDir, apiKey, model, language = 'ja', provider = 'anthropic', merge = 'both', joinLines = false
) {
  const client = createClient(provider, apiKey);
  const images  = getImagePaths(folderPath);
  const total   = images.length;
  const folderName = path.basename(folderPath);

  // 個別 txt の保存先: output/<folderName>/
  const tempDir = path.join(outputDir, folderName);
  fs.mkdirSync(tempDir, { recursive: true });

  // 再開チェック: 既存 txt があればスキップ
  const toProcess = images.filter(imgPath => {
    const stem = path.basename(imgPath, path.extname(imgPath));
    return !fs.existsSync(path.join(tempDir, `${stem}.txt`));
  });

  const skippedCount = total - toProcess.length;
  let completedCount = skippedCount;

  // スキップがあれば最初に通知
  if (skippedCount > 0) {
    yield {
      current:  completedCount,
      total,
      filename: `${skippedCount}枚スキップ済み（前回の続きから再開）`,
      done:     false,
      output:   null,
      skipped:  skippedCount,
    };
  }

  // Track errors during this run
  const errors = [];

  // 未処理画像を並列処理
  if (toProcess.length > 0) {
    /** イベントキュー（ワーカー → ジェネレータへ非同期受け渡し） */
    const eventQueue  = [];
    let waitResolve   = null;
    let fatalError    = null;

    function pushEvent(ev) {
      eventQueue.push(ev);
      if (waitResolve) {
        const r    = waitResolve;
        waitResolve = null;
        r();
      }
    }

    const taskQueue = [...toProcess];
    let activeWorkers = 0;

    /** 1 ワーカーの処理ループ */
    async function runWorker() {
      while (taskQueue.length > 0 && !fatalError) {
        const imgPath = taskQueue.shift();
        if (!imgPath) break;

        const filename = path.basename(imgPath);
        const stem     = path.basename(imgPath, path.extname(imgPath));
        const tmpFile  = path.join(tempDir, `${stem}.txt`);

        let text;
        try {
          text = await extractTextFromImage(client, imgPath, model, 3, language, provider, joinLines);
          writeTempFile(tmpFile, text);
        } catch (err) {
          if (fatalError) break;
          const fatal = extractFatalError(err);
          if (fatal) {
            fatalError = fatal;
            break;
          }
          text = `[OCR ERROR: ${filename} - ${err.message}]`;
          writeTempFile(tmpFile, text);
          errors.push({ filename, message: err.message });
        }

        if (!fatalError) {
          completedCount++;
          pushEvent({ current: completedCount, total, filename, done: false, output: null });
        }
      }

      activeWorkers--;
      if (activeWorkers === 0) {
        pushEvent(null); // 全ワーカー完了シグナル
      }
    }

    // ワーカー起動（fire & forget）
    const workerCount = Math.min(CONCURRENCY, toProcess.length);
    activeWorkers = workerCount;
    for (let i = 0; i < workerCount; i++) runWorker();

    // キューからイベントを yield
    let workersDone = false;
    while (!workersDone) {
      if (eventQueue.length === 0) {
        await new Promise(r => { waitResolve = r; });
      }
      while (eventQueue.length > 0) {
        const ev = eventQueue.shift();
        if (ev === null) { workersDone = true; break; }
        yield ev;
      }
    }

    if (fatalError) throw fatalError;
  }

  // Scan ALL temp files for errors (covers resume runs where previous errors exist)
  const allErrors = scanAllErrors(images, tempDir);

  if (merge === 'extract-only') {
    // 結合スキップ: 個別 txt のみ保存済み、最終ファイルは作らない
    yield { current: total, total, filename: '', done: true, output: null, mergeSkipped: true, errors: allErrors };
    return;
  }

  // 全個別 txt を順番通りに結合 → output/<folderName>.txt（進捗イベントつき）
  const textParts = [];
  for (let i = 0; i < images.length; i++) {
    const imgPath = images[i];
    const stem    = path.basename(imgPath, path.extname(imgPath));
    const tmpFile = path.join(tempDir, `${stem}.txt`);
    try {
      textParts.push(readTempFile(tmpFile));
    } catch {
      textParts.push(`[ERROR: ${path.basename(imgPath)} は処理されませんでした]`);
    }
    yield { mergeStep: true, current: i + 1, total: images.length, done: false };
  }

  let finalText = textParts.filter(t => t).join('\n\n');

  // Append error summary section if errors exist
  if (allErrors.length > 0) {
    const errorLines = allErrors.map(e => `  ・${e.filename}: ${e.message}`).join('\n');
    finalText += `\n\n${'='.repeat(44)}\n【処理エラー一覧 (${allErrors.length}件)】\n${errorLines}\n${'='.repeat(44)}`;
  }

  const outPath = writeOutput(finalText, folderName, outputDir);

  // Write history entry
  appendHistory(outputDir, {
    id: Date.now(),
    folder: folderName,
    timestamp: new Date().toISOString(),
    total,
    processed: total - allErrors.length,
    errors: allErrors,
    provider,
    model,
    language,
    outputFile: `${folderName}.txt`,
  });

  yield { current: total, total, filename: '', done: true, output: outPath, errors: allErrors };
}

/**
 * CLI 向け非ストリーミング版（並列処理 + 個別保存 + 再開対応）。
 *
 * @param {string}        folderPath
 * @param {string}        outputDir
 * @param {string}        apiKey
 * @param {Function|null} progressCb  (current, total, filename) コールバック
 * @param {string}        model
 * @param {string}        language - 'ja' | 'en'
 * @param {string}        provider - 'anthropic' | 'openai' | 'google'
 * @returns {Promise<string>} 出力ファイルパス
 */
async function processFolder(
  folderPath, outputDir, apiKey,
  progressCb = null,
  model    = 'claude-sonnet-4-6',
  language = 'ja',
  provider = 'anthropic'
) {
  const client     = createClient(provider, apiKey);
  const images     = getImagePaths(folderPath);
  const total      = images.length;
  const folderName = path.basename(folderPath);

  const tempDir = path.join(outputDir, folderName);
  fs.mkdirSync(tempDir, { recursive: true });

  // スキップチェック
  const toProcess    = images.filter(imgPath => {
    const stem = path.basename(imgPath, path.extname(imgPath));
    return !fs.existsSync(path.join(tempDir, `${stem}.txt`));
  });
  const skippedCount = total - toProcess.length;
  let completedCount = skippedCount;

  if (skippedCount > 0 && progressCb) {
    progressCb(completedCount, total, `(${skippedCount}枚スキップ済み – 再開)`);
  }

  let fatalError = null;

  async function runWorker(queue) {
    while (queue.length > 0 && !fatalError) {
      const imgPath = queue.shift();
      if (!imgPath) break;

      const filename = path.basename(imgPath);
      const stem     = path.basename(imgPath, path.extname(imgPath));
      const tmpFile  = path.join(tempDir, `${stem}.txt`);

      let text;
      try {
        text = await extractTextFromImage(client, imgPath, model, 3, language, provider);
        writeTempFile(tmpFile, text);
      } catch (err) {
        const fatal = extractFatalError(err);
        if (fatal) { fatalError = fatal; break; }
        text = `[OCR ERROR: ${filename} - ${err.message}]`;
        writeTempFile(tmpFile, text);
      }

      if (!fatalError) {
        completedCount++;
        if (progressCb) progressCb(completedCount, total, filename);
      }
    }
  }

  const taskQueue   = [...toProcess];
  const workerCount = Math.min(CONCURRENCY, toProcess.length);
  if (workerCount > 0) {
    await Promise.all(Array.from({ length: workerCount }, () => runWorker(taskQueue)));
  }

  if (fatalError) throw fatalError;

  // 結合
  const textParts = images.map(imgPath => {
    const stem    = path.basename(imgPath, path.extname(imgPath));
    const tmpFile = path.join(tempDir, `${stem}.txt`);
    try { return readTempFile(tmpFile); }
    catch { return `[ERROR: ${path.basename(imgPath)} は処理されませんでした]`; }
  });

  let finalText = textParts.filter(t => t).join('\n\n');

  // Scan ALL temp files for errors (covers resume runs)
  const allErrors = scanAllErrors(images, tempDir);

  // Append error summary section if errors exist
  if (allErrors.length > 0) {
    const errorLines = allErrors.map(e => `  ・${e.filename}: ${e.message}`).join('\n');
    finalText += `\n\n${'='.repeat(44)}\n【処理エラー一覧 (${allErrors.length}件)】\n${errorLines}\n${'='.repeat(44)}`;
  }

  const outPath = writeOutput(finalText, folderName, outputDir);

  // Write history entry
  appendHistory(outputDir, {
    id: Date.now(),
    folder: folderName,
    timestamp: new Date().toISOString(),
    total,
    processed: total - allErrors.length,
    errors: allErrors,
    provider,
    model,
    language,
    outputFile: `${folderName}.txt`,
  });

  return outPath;
}

module.exports = { processFolderStream, processFolder };
