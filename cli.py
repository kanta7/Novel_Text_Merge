import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
DEFAULT_DATA_DIR = BASE_DIR / 'Novel_data'
DEFAULT_OUTPUT_DIR = BASE_DIR / 'output'


def main():
    parser = argparse.ArgumentParser(
        description='小説画像(webp)からテキストを抽出して統合するツール',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  フォルダ一覧を表示:
    python cli.py --list

  特定のフォルダを処理:
    python cli.py --folder Novel1

  出力先を指定して処理:
    python cli.py --folder Novel1 --output-dir /path/to/output
        """,
    )
    parser.add_argument(
        '--data-dir',
        type=Path,
        default=DEFAULT_DATA_DIR,
        help=f'小説フォルダが格納されているディレクトリ (デフォルト: {DEFAULT_DATA_DIR})',
    )
    parser.add_argument(
        '--folder',
        type=str,
        default=None,
        help='処理するフォルダ名 (省略時はフォルダ一覧を表示)',
    )
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f'出力先ディレクトリ (デフォルト: {DEFAULT_OUTPUT_DIR})',
    )
    parser.add_argument(
        '--api-key',
        type=str,
        default=None,
        help='Anthropic APIキー (省略時は環境変数 ANTHROPIC_API_KEY を使用)',
    )
    parser.add_argument(
        '--model',
        type=str,
        default='claude-sonnet-4-6',
        help='使用するClaudeモデル (デフォルト: claude-sonnet-4-6)',
    )
    parser.add_argument(
        '--list',
        action='store_true',
        help='利用可能なフォルダ一覧を表示して終了',
    )

    args = parser.parse_args()

    # Import here to avoid slow startup when just showing help
    from core.file_utils import list_novel_folders, get_image_paths
    from core.processor import process_folder

    data_dir = args.data_dir
    if not data_dir.exists():
        print(f'エラー: データディレクトリが見つかりません: {data_dir}', file=sys.stderr)
        sys.exit(1)

    folders = list_novel_folders(data_dir)

    if args.list or args.folder is None:
        if not folders:
            print(f'フォルダが見つかりません: {data_dir}')
        else:
            print(f'利用可能なフォルダ ({data_dir}):')
            for f in folders:
                try:
                    images = get_image_paths(f)
                    print(f'  {f.name}  ({len(images)} 枚)')
                except ValueError as e:
                    print(f'  {f.name}  (エラー: {e})')
        if args.folder is None:
            sys.exit(0)

    folder_path = data_dir / args.folder
    if not folder_path.exists():
        print(f'エラー: フォルダが見つかりません: {folder_path}', file=sys.stderr)
        sys.exit(1)

    api_key = args.api_key or os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        print(
            'エラー: Anthropic APIキーが設定されていません。\n'
            '  --api-key オプションか環境変数 ANTHROPIC_API_KEY を設定してください。',
            file=sys.stderr,
        )
        sys.exit(1)

    def progress_cb(current: int, total: int, filename: str):
        print(f'[{current:>4}/{total}] {filename}', file=sys.stderr)

    try:
        out_path = process_folder(
            folder=folder_path,
            output_dir=args.output_dir,
            api_key=api_key,
            progress_cb=progress_cb,
            model=args.model,
        )
        print(f'\n完了: {out_path}')
    except ValueError as e:
        print(f'エラー: {e}', file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print('\n中断されました。', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
