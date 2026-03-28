'use strict';

const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { extractTextFromImage } = require('./extractor');
const { getImagePaths, writeOutput } = require('./fileUtils');

/**
 * Async generator that processes each image and yields progress events.
 * Event shape: { current, total, filename, done, output }
 *
 * @param {string} folderPath
 * @param {string} outputDir
 * @param {string} apiKey
 * @param {string} model
 */
async function* processFolderStream(folderPath, outputDir, apiKey, model = 'claude-sonnet-4-6') {
  const client = new Anthropic({ apiKey });
  const images = getImagePaths(folderPath);
  const total = images.length;
  const parts = [];

  for (let idx = 0; idx < images.length; idx++) {
    const imgPath = images[idx];
    const filename = path.basename(imgPath);
    let text;
    try {
      text = await extractTextFromImage(client, imgPath, model);
    } catch (err) {
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
 * @returns {Promise<string>} output file path
 */
async function processFolder(folderPath, outputDir, apiKey, progressCb = null, model = 'claude-sonnet-4-6') {
  const client = new Anthropic({ apiKey });
  const images = getImagePaths(folderPath);
  const total = images.length;
  const parts = [];

  for (let idx = 0; idx < images.length; idx++) {
    const imgPath = images[idx];
    const filename = path.basename(imgPath);
    let text;
    try {
      text = await extractTextFromImage(client, imgPath, model);
    } catch (err) {
      text = `[OCR ERROR: ${filename} - ${err.message}]`;
    }
    parts.push(text);
    if (progressCb) progressCb(idx + 1, total, filename);
  }

  const merged = parts.filter(p => p).join('\n\n');
  return writeOutput(merged, path.basename(folderPath), outputDir);
}

module.exports = { processFolderStream, processFolder };
