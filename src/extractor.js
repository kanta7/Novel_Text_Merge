'use strict';

const fs = require('fs');

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

const EXTRACTION_PROMPT_JOIN_LINES = `あなたは日本語OCRの専門家です。この画像から日本語テキストを正確に抽出してください。

以下のルールに従ってください:
1. 縦書き（右から左、上から下）と横書き（左から右、上から下）の両方に対応する
2. 字下げ（インデント）を全角スペースで再現する
3. 文の途中での改行（「。」「！」「？」「…」「―」などの文末記号で終わっていない行末の改行）は取り除き、その行と次の行をつなげて一文として出力する。段落の区切り（字下げや意味的な段落境界）には改行を使う
4. 「」『』（）などの記号・括弧類を正確に転写する
5. ルビ（振り仮名）がある場合は無視してメインテキストのみを抽出する
6. ページ番号・ノンブルは抽出しない
7. 画像にテキストが存在しない場合は空文字列を返す
8. 抽出したテキスト以外の説明文・コメントは一切含めない

テキストをそのまま出力してください:`;

const EXTRACTION_PROMPT_EN = `You are an expert OCR assistant. Extract all English text from this image accurately.

Follow these rules:
1. Support both horizontal (left to right) and vertical text layouts
2. Reproduce indentation with spaces
3. Preserve line breaks as they appear in the image
4. Accurately transcribe punctuation and symbols
5. Exclude page numbers
6. Return an empty string if no text is found in the image
7. Output extracted text only — no explanations or comments

Output the text as-is:`;

const EXTRACTION_PROMPT_EN_JOIN_LINES = `You are an expert OCR assistant. Extract all English text from this image accurately.

Follow these rules:
1. Support both horizontal (left to right) and vertical text layouts
2. Reproduce indentation with spaces
3. Remove mid-sentence line breaks (line breaks not following sentence-ending punctuation such as period, exclamation mark, or question mark). Join such broken lines into a single continuous sentence. Use line breaks only at paragraph boundaries
4. Accurately transcribe punctuation and symbols
5. Exclude page numbers
6. Return an empty string if no text is found in the image
7. Output extracted text only — no explanations or comments

Output the text as-is:`;

/**
 * Encodes an image file to base64 string.
 * @param {string} imagePath
 * @returns {string}
 */
function encodeImage(imagePath) {
  return fs.readFileSync(imagePath).toString('base64');
}

/**
 * Creates a provider-specific API client.
 * @param {string} provider - 'anthropic' | 'openai' | 'google'
 * @param {string} apiKey
 * @returns {object}
 */
function createClient(provider, apiKey) {
  switch (provider) {
    case 'openai': {
      const { OpenAI } = require('openai');
      return new OpenAI({ apiKey });
    }
    case 'google': {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      return new GoogleGenerativeAI(apiKey);
    }
    default: { // anthropic
      const Anthropic = require('@anthropic-ai/sdk');
      return new Anthropic({ apiKey });
    }
  }
}

/**
 * Calls the provider-specific vision API and returns extracted text.
 * @param {object} client
 * @param {string} provider
 * @param {string} model
 * @param {string} b64 - base64 encoded image
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function callVisionAPI(client, provider, model, b64, prompt) {
  switch (provider) {
    case 'openai': {
      const response = await client.chat.completions.create({
        model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/webp;base64,${b64}` } },
            { type: 'text', text: prompt },
          ],
        }],
      });
      return response.choices[0].message.content.trim();
    }
    case 'google': {
      const genModel = client.getGenerativeModel({ model });
      const result = await genModel.generateContent([
        prompt,
        { inlineData: { data: b64, mimeType: 'image/webp' } },
      ]);
      return result.response.text().trim();
    }
    default: { // anthropic
      const message = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/webp', data: b64 } },
            { type: 'text', text: prompt },
          ],
        }],
      });
      return message.content[0].text.trim();
    }
  }
}

/**
 * Calls vision API to extract text from a WebP image.
 * Retries on rate limit (429) with exponential backoff.
 *
 * @param {object} client - Provider-specific client created by createClient()
 * @param {string} imagePath - absolute path to .webp file
 * @param {string} model
 * @param {number} maxRetries
 * @param {string} language - 'ja' | 'en'
 * @param {string} provider - 'anthropic' | 'openai' | 'google'
 * @returns {Promise<string>}
 */
async function extractTextFromImage(client, imagePath, model, maxRetries = 3, language = 'ja', provider = 'anthropic', joinLines = false) {
  const b64 = encodeImage(imagePath);
  let prompt;
  if (language === 'en') {
    prompt = joinLines ? EXTRACTION_PROMPT_EN_JOIN_LINES : EXTRACTION_PROMPT_EN;
  } else {
    prompt = joinLines ? EXTRACTION_PROMPT_JOIN_LINES : EXTRACTION_PROMPT;
  }
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callVisionAPI(client, provider, model, b64, prompt);
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

module.exports = { extractTextFromImage, createClient, EXTRACTION_PROMPT, EXTRACTION_PROMPT_EN, EXTRACTION_PROMPT_JOIN_LINES, EXTRACTION_PROMPT_EN_JOIN_LINES };
