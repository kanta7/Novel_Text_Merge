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

module.exports = { getImagePaths, listNovelFolders, writeOutput };
