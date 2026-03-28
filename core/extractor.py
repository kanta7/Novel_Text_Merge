import base64
import time
from pathlib import Path

import anthropic

EXTRACTION_PROMPT = """あなたは日本語OCRの専門家です。この画像から日本語テキストを正確に抽出してください。

以下のルールに従ってください:
1. 縦書き（右から左、上から下）と横書き（左から右、上から下）の両方に対応する
2. 字下げ（インデント）を全角スペースで再現する
3. 改行は画像上の実際の行区切りに従い改行で再現する
4. 「」『』（）などの記号・括弧類を正確に転写する
5. ルビ（振り仮名）がある場合は無視してメインテキストのみを抽出する
6. ページ番号・ノンブルは抽出しない
7. 画像にテキストが存在しない場合は空文字列を返す
8. 抽出したテキスト以外の説明文・コメントは一切含めない

テキストをそのまま出力してください:"""


def encode_image(path: Path) -> str:
    with open(path, 'rb') as f:
        return base64.standard_b64encode(f.read()).decode('utf-8')


def extract_text_from_image(
    client: anthropic.Anthropic,
    image_path: Path,
    model: str = 'claude-sonnet-4-6',
    max_retries: int = 3,
) -> str:
    b64 = encode_image(image_path)
    last_exc = None

    for attempt in range(max_retries):
        try:
            message = client.messages.create(
                model=model,
                max_tokens=4096,
                messages=[
                    {
                        'role': 'user',
                        'content': [
                            {
                                'type': 'image',
                                'source': {
                                    'type': 'base64',
                                    'media_type': 'image/webp',
                                    'data': b64,
                                },
                            },
                            {
                                'type': 'text',
                                'text': EXTRACTION_PROMPT,
                            },
                        ],
                    }
                ],
            )
            return message.content[0].text.strip()
        except anthropic.RateLimitError as exc:
            last_exc = exc
            wait = 2 ** attempt
            time.sleep(wait)
        except anthropic.APIError as exc:
            raise exc

    raise last_exc
