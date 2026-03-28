'use strict';

const fs = require('fs');
const path = require('path');

const MAX_IMAGES = 500;

/**
 * Natural sort key: splits filename stem on digit runs.
 * e.g. "10" -> ["", 10, ""], "page2" -> ["page", 2, ""]
 */
function naturalSortKey(filePath) {
  const stem = path.basename(filePath, path.extname(filePath));
  return stem.split(/(\d+)/).map(part =>
    /^\d+$/.test(part) ? parseInt(part, 10) : part.toLowerCase()
  );
}

function compareNatural(a, b) {
  const ka = naturalSortKey(a);
  const kb = naturalSortKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const ai = i < ka.length ? ka[i] : '';
    const bi = i < kb.length ? kb[i] : '';
    if (ai < bi) return -1;
    if (ai > bi) return 1;
  }
  return 0;
}

/**
 * Returns sorted array of absolute .webp file paths within folderPath.
 * Throws if no images found or count exceeds MAX_IMAGES.
 */
function getImagePaths(folderPath) {
  const entries = fs.readdirSync(folderPath);
  const images = entries
    .filter(f => path.extname(f).toLowerCase() === '.webp')
    .map(f => path.join(folderPath, f))
    .sort(compareNatural);

  if (images.length === 0) {
    throw new Error(`フォルダ '${path.basename(folderPath)}' に .webp ファイルが見つかりません。`);
  }
  if (images.length > MAX_IMAGES) {
    throw new Error(
      `フォルダ '${path.basename(folderPath)}' の画像枚数 (${images.length}) が上限 (${MAX_IMAGES}) を超えています。`
    );
  }
  return images;
}

/**
 * Returns sorted array of subfolder paths inside dataDir.
 */
function listNovelFolders(dataDir) {
  return fs.readdirSync(dataDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(dataDir, d.name))
    .sort((a, b) =>
      path.basename(a).toLowerCase().localeCompare(path.basename(b).toLowerCase(), 'ja')
    );
}

/**
 * Writes text to outputDir/<folderName>.txt with UTF-8 BOM.
 * Returns the full output file path.
 */
function writeOutput(text, folderName, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, `${folderName}.txt`);
  // UTF-8 BOM (EF BB BF) for Windows Notepad and Japanese text editors
  const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
  const content = Buffer.concat([BOM, Buffer.from(text, 'utf8')]);
  fs.writeFileSync(outPath, content);
  return outPath;
}

/**
 * Writes text to an individual temp file with UTF-8 BOM.
 * Used for per-image intermediate results.
 * @param {string} filePath - absolute path to the temp file
 * @param {string} text
 */
function writeTempFile(filePath, text) {
  const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
  fs.writeFileSync(filePath, Buffer.concat([BOM, Buffer.from(text, 'utf8')]));
}

/**
 * Reads a temp file, stripping UTF-8 BOM if present.
 * @param {string} filePath - absolute path to the temp file
 * @returns {string}
 */
function readTempFile(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return buf.slice(3).toString('utf8');
  }
  return buf.toString('utf8');
}

/**
 * Returns the path to the history JSON file.
 */
function getHistoryPath(outputDir) {
  return path.join(outputDir, 'history.json');
}

/**
 * Reads the conversion history array from disk.
 * Returns [] if the file doesn't exist or is malformed.
 * @param {string} outputDir
 * @returns {Array}
 */
function readHistory(outputDir) {
  const histPath = getHistoryPath(outputDir);
  if (!fs.existsSync(histPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(histPath, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Prepends a new entry to the history file (newest first). Keeps at most 100 entries.
 * @param {string} outputDir
 * @param {object} entry
 */
function appendHistory(outputDir, entry) {
  const history = readHistory(outputDir);
  history.unshift(entry);
  const trimmed = history.slice(0, 100);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(getHistoryPath(outputDir), JSON.stringify(trimmed, null, 2), 'utf8');
}

/**
 * Clears the history file.
 * @param {string} outputDir
 */
function clearHistory(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(getHistoryPath(outputDir), '[]', 'utf8');
}

module.exports = { getImagePaths, listNovelFolders, writeOutput, writeTempFile, readTempFile, readHistory, appendHistory, clearHistory };
