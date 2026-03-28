'use strict';

const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const EXTRACTION_PROMPT = `あなたは日本語OCRの専門家です。この画像から日本語テキストを正確に抽出してください。

以下のルールに従ってください:
1. 縦書き（右から左、上から下）と横書き（左から右、上から下）の両方に対応する
2. 字下げ（インデント）を全角スペースで再現する
3. 改行は画像上の実際の行区切りに従い改行で再現する
4. 「」『』（）などの記号・括弧類を正確に転写する
5. ルビ（振り仮名）がある場合は無視してメインテキストのみを抽出する
6. ページ番号・ノンブルは抽出しない
7. 画像にテキストが存在しない場合は空文字列を返す
8. 抽出したテキスト以外の説明文・コメントは一切含めない

テキストをそのまま出力してください:`;

/**
 * Encodes an image file to base64 string.
 * @param {string} imagePath
 * @returns {string}
 */
function encodeImage(imagePath) {
  return fs.readFileSync(imagePath).toString('base64');
}

/**
 * Calls Claude vision API to extract Japanese text from a WebP image.
 * Retries on rate limit (429) with exponential backoff.
 *
 * @param {Anthropic} client
 * @param {string} imagePath - absolute path to .webp file
 * @param {string} model
 * @param {number} maxRetries
 * @returns {Promise<string>}
 */
async function extractTextFromImage(client, imagePath, model = 'claude-sonnet-4-6', maxRetries = 3) {
  const b64 = encodeImage(imagePath);
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const message = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/webp',
                  data: b64,
                },
              },
              {
                type: 'text',
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      });
      return message.content[0].text.trim();
    } catch (err) {
      if (err.status === 429) {
        lastError = err;
        const waitMs = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

module.exports = { extractTextFromImage, EXTRACTION_PROMPT };
