from pathlib import Path
from typing import Callable, Generator

import anthropic

from .extractor import extract_text_from_image
from .file_utils import get_image_paths, write_output

ProgressCallback = Callable[[int, int, str], None]


def process_folder(
    folder: Path,
    output_dir: Path,
    api_key: str,
    progress_cb: ProgressCallback = None,
    model: str = 'claude-sonnet-4-6',
) -> Path:
    client = anthropic.Anthropic(api_key=api_key)
    images = get_image_paths(folder)
    total = len(images)
    parts = []

    for idx, img_path in enumerate(images, start=1):
        try:
            text = extract_text_from_image(client, img_path, model)
        except Exception as exc:
            text = f'[OCR ERROR: {img_path.name} - {exc}]'
        parts.append(text)
        if progress_cb:
            progress_cb(idx, total, img_path.name)

    merged = '\n\n'.join(p for p in parts if p)
    return write_output(merged, folder.name, output_dir)


def process_folder_stream(
    folder: Path,
    output_dir: Path,
    api_key: str,
    model: str = 'claude-sonnet-4-6',
) -> Generator[dict, None, None]:
    client = anthropic.Anthropic(api_key=api_key)
    images = get_image_paths(folder)
    total = len(images)
    parts = []

    for idx, img_path in enumerate(images, start=1):
        try:
            text = extract_text_from_image(client, img_path, model)
        except Exception as exc:
            text = f'[OCR ERROR: {img_path.name} - {exc}]'
        parts.append(text)
        yield {
            'current': idx,
            'total': total,
            'filename': img_path.name,
            'done': False,
            'output': None,
        }

    merged = '\n\n'.join(p for p in parts if p)
    out_path = write_output(merged, folder.name, output_dir)

    yield {
        'current': total,
        'total': total,
        'filename': '',
        'done': True,
        'output': str(out_path),
    }
