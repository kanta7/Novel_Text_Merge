import re
from pathlib import Path

MAX_IMAGES = 500


def natural_sort_key(path: Path) -> list:
    parts = re.split(r'(\d+)', path.stem)
    return [int(p) if p.isdigit() else p.lower() for p in parts]


def get_image_paths(folder: Path) -> list:
    images = sorted(
        [p for p in folder.iterdir() if p.suffix.lower() == '.webp'],
        key=natural_sort_key,
    )
    if not images:
        raise ValueError(f"フォルダ '{folder.name}' に .webp ファイルが見つかりません。")
    if len(images) > MAX_IMAGES:
        raise ValueError(
            f"フォルダ '{folder.name}' の画像枚数 ({len(images)}) が上限 ({MAX_IMAGES}) を超えています。"
        )
    return images


def list_novel_folders(data_dir: Path) -> list:
    return sorted(
        [p for p in data_dir.iterdir() if p.is_dir()],
        key=lambda p: p.name.lower(),
    )


def write_output(text: str, folder_name: str, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"{folder_name}.txt"
    out_path.write_text(text, encoding='utf-8-sig')
    return out_path
