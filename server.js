'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const fs = require('fs');
const { exec } = require('child_process');

const { listNovelFolders, getImagePaths } = require('./src/fileUtils');
const { processFolderStream } = require('./src/processor');

const BASE_DIR = __dirname;
const DATA_DIR = process.env.NOVEL_DATA_DIR
  ? path.resolve(process.env.NOVEL_DATA_DIR)
  : path.join(BASE_DIR, 'Novel_data');
const OUTPUT_DIR = process.env.NOVEL_OUTPUT_DIR
  ? path.resolve(process.env.NOVEL_OUTPUT_DIR)
  : path.join(BASE_DIR, 'output');
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
const PUBLIC_DIR = path.join(BASE_DIR, 'public');

// Serve public/ at root. Also serve at /static so index.html's
// <script src="/static/main.js"> resolves correctly.
app.use(express.static(PUBLIC_DIR));
app.use('/static', express.static(PUBLIC_DIR));

// GET /
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// GET /api/folders
app.get('/api/folders', (req, res) => {
  if (!fs.existsSync(DATA_DIR)) {
    return res.status(500).json({ error: `データディレクトリが見つかりません: ${DATA_DIR}` });
  }

  const folders = listNovelFolders(DATA_DIR);
  const result = folders.map(folderPath => {
    const name = path.basename(folderPath);
    try {
      const images = getImagePaths(folderPath);
      return { name, count: images.length };
    } catch {
      return { name, count: null };
    }
  });

  res.json({ folders: result });
});

// Helper: send an SSE error event and close
function sseError(res, message) {
  res.write(`data: ${JSON.stringify({ error: message, done: true })}\n\n`);
  res.end();
}

// GET /api/process?folder=NAME&model=MODEL  (SSE)
app.get('/api/process', async (req, res) => {
  // Set SSE headers FIRST so EventSource always gets a proper streaming response.
  // All errors are sent as SSE data events instead of HTTP error codes.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const folderName = (req.query.folder || '').trim();
  if (!folderName) {
    return sseError(res, 'folder パラメータが必要です');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return sseError(res, 'ANTHROPIC_API_KEY が設定されていません。.env.local を確認してください。');
  }

  const folderPath = path.join(DATA_DIR, folderName);
  if (!fs.existsSync(folderPath)) {
    return sseError(res, `フォルダが見つかりません: ${folderName}`);
  }

  const model = (req.query.model || 'claude-sonnet-4-6').trim();

  try {
    for await (const event of processFolderStream(folderPath, OUTPUT_DIR, apiKey, model)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: `予期しないエラー: ${err.message}`, done: true })}\n\n`);
  } finally {
    res.end();
  }
});

// GET /api/download/:folderName
app.get('/api/download/:folderName', (req, res) => {
  const folderName = req.params.folderName;
  const outPath = path.join(OUTPUT_DIR, `${folderName}.txt`);
  if (!fs.existsSync(outPath)) {
    return res.status(404).json({ error: 'ファイルが見つかりません' });
  }
  res.download(outPath, `${folderName}.txt`);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`サーバー起動中: ${url}`);
  console.log('ブラウザが自動で開きます。開かない場合は上記URLを手動で開いてください。');

  setTimeout(() => {
    let cmd;
    if (process.platform === 'win32') {
      cmd = `start "" "${url}"`;
    } else if (process.platform === 'darwin') {
      cmd = `open "${url}"`;
    } else {
      cmd = `xdg-open "${url}"`;
    }
    exec(cmd, err => {
      if (err) console.error('ブラウザ自動起動エラー:', err.message);
    });
  }, 1200);
});
