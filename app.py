import json
import os
import sys
import threading
import webbrowser
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request, send_file

load_dotenv()

# Windows でカレントディレクトリに関わらず core モジュールを確実にインポートできるようにする
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

DATA_DIR = Path(os.environ.get('NOVEL_DATA_DIR') or (BASE_DIR / 'Novel_data'))
OUTPUT_DIR = Path(os.environ.get('NOVEL_OUTPUT_DIR') or (BASE_DIR / 'output'))

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / 'web' / 'templates'),
    static_folder=str(BASE_DIR / 'web' / 'static'),
)


def get_api_key():
    return os.environ.get('ANTHROPIC_API_KEY', '')


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/folders')
def list_folders():
    if not DATA_DIR.exists():
        return jsonify({'error': f'データディレクトリが見つかりません: {DATA_DIR}'}), 500

    from core.file_utils import list_novel_folders, get_image_paths

    folders = list_novel_folders(DATA_DIR)
    result = []
    for f in folders:
        try:
            images = get_image_paths(f)
            result.append({'name': f.name, 'count': len(images)})
        except ValueError:
            result.append({'name': f.name, 'count': None})

    return jsonify({'folders': result})


@app.route('/api/process')
def process():
    folder_name = request.args.get('folder', '').strip()
    if not folder_name:
        return jsonify({'error': 'folder パラメータが必要です'}), 400

    api_key = get_api_key()
    if not api_key:
        return jsonify({'error': 'ANTHROPIC_API_KEY が設定されていません'}), 500

    folder_path = DATA_DIR / folder_name
    if not folder_path.exists():
        return jsonify({'error': f'フォルダが見つかりません: {folder_name}'}), 404

    model = request.args.get('model', 'claude-sonnet-4-6')

    from core.processor import process_folder_stream

    def generate():
        try:
            for event in process_folder_stream(folder_path, OUTPUT_DIR, api_key, model):
                yield f'data: {json.dumps(event, ensure_ascii=False)}\n\n'
        except ValueError as exc:
            error_event = {'error': str(exc), 'done': True}
            yield f'data: {json.dumps(error_event, ensure_ascii=False)}\n\n'
        except Exception as exc:
            error_event = {'error': f'予期しないエラー: {exc}', 'done': True}
            yield f'data: {json.dumps(error_event, ensure_ascii=False)}\n\n'

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'X-Accel-Buffering': 'no',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    )


@app.route('/api/download/<folder_name>')
def download(folder_name: str):
    out_path = OUTPUT_DIR / f'{folder_name}.txt'
    if not out_path.exists():
        return jsonify({'error': 'ファイルが見つかりません'}), 404
    return send_file(out_path, as_attachment=True, download_name=f'{folder_name}.txt')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    url = f'http://localhost:{port}'
    print(f'サーバー起動中: {url}')
    print('ブラウザが自動で開きます。開かない場合は上記URLを手動で開いてください。')

    # Windows でも SSE が正常に動作するよう、起動後にブラウザを開く
    threading.Timer(1.2, lambda: webbrowser.open(url)).start()

    app.run(
        debug=False,
        host='0.0.0.0',
        port=port,
        threaded=True,       # Windows で SSE ストリーミングに必須
        use_reloader=False,  # リローダー無効化（Windows での二重起動を防ぐ）
    )
