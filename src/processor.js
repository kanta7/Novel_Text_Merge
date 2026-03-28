'use strict';

const path = require('path');
const { extractTextFromImage, createClient } = require('./extractor');
const { getImagePaths, writeOutput } = require('./fileUtils');

/**
 * Attempts to extract a clean, human-readable message from a fatal API error.
 * Returns an Error with isFatal=true if it's a non-retryable 4xx error, otherwise null.
 * @param {Error} err
 * @returns {Error|null}
 */
function extractFatalError(err) {
  const status = err.status ?? err.statusCode;
  if (!status || status === 429) return null;
  if (status >= 400 && status < 500) {
    // Try Anthropic-style JSON message: "400 {\"type\":\"error\",...}"
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
    // OpenAI / Google style: message is already human-readable
    if (err.message) {
      const e = new Error(err.message);
      e.isFatal = true;
      return e;
    }
  }
  return null;
}

/**
 * Async generator that processes each image and yields progress events.
 * Event shape: { current, total, filename, done, output }
 *
 * @param {string} folderPath
 * @param {string} outputDir
 * @param {string} apiKey
 * @param {string} model
 * @param {string} language - 'ja' | 'en'
 * @param {string} provider - 'anthropic' | 'openai' | 'google'
 */
async function* processFolderStream(folderPath, outputDir, apiKey, model, language = 'ja', provider = 'anthropic') {
  const client = createClient(provider, apiKey);
  const images = getImagePaths(folderPath);
  const total = images.length;
  const parts = [];

  for (let idx = 0; idx < images.length; idx++) {
    const imgPath = images[idx];
    const filename = path.basename(imgPath);
    let text;
    try {
      text = await extractTextFromImage(client, imgPath, model, 3, language, provider);
    } catch (err) {
      const fatal = extractFatalError(err);
      if (fatal) throw fatal;
      text = `[OCR ERROR: ${filename} - ${err.message}]`;
    }
    parts.push(text);

    yield {
      current: idx + 1,
      total,
      filename,
      done: false,
      output: null,
    };
  }

  const merged = parts.filter(p => p).join('\n\n');
  const outPath = writeOutput(merged, path.basename(folderPath), outputDir);

  yield {
    current: total,
    total,
    filename: '',
    done: true,
    output: outPath,
  };
}

/**
 * Non-streaming version for CLI use.
 * Calls progressCb(current, total, filename) after each image.
 *
 * @param {string} folderPath
 * @param {string} outputDir
 * @param {string} apiKey
 * @param {Function|null} progressCb
 * @param {string} model
 * @param {string} language - 'ja' | 'en'
 * @param {string} provider - 'anthropic' | 'openai' | 'google'
 * @returns {Promise<string>} output file path
 */
async function processFolder(folderPath, outputDir, apiKey, progressCb = null, model = 'claude-sonnet-4-6', language = 'ja', provider = 'anthropic') {
  const client = createClient(provider, apiKey);
  const images = getImagePaths(folderPath);
  const total = images.length;
  const parts = [];

  for (let idx = 0; idx < images.length; idx++) {
    const imgPath = images[idx];
    const filename = path.basename(imgPath);
    let text;
    try {
      text = await extractTextFromImage(client, imgPath, model, 3, language, provider);
    } catch (err) {
      const fatal = extractFatalError(err);
      if (fatal) throw fatal;
      text = `[OCR ERROR: ${filename} - ${err.message}]`;
    }
    parts.push(text);
    if (progressCb) progressCb(idx + 1, total, filename);
  }

  const merged = parts.filter(p => p).join('\n\n');
  return writeOutput(merged, path.basename(folderPath), outputDir);
}

module.exports = { processFolderStream, processFolder };
