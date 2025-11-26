#!/usr/bin/env python3
"""
Import dataset exported from Label Studio (placed in `dataset2`) into the project's `dataset` folder.

What it does:
- reads classes from `dataset2/classes.txt` or `dataset2/notes.json`
- ensures `dataset/classes.txt` and `dataset/notes.json` exist (creates/updates if missing)
- copies images from `dataset2/images` -> `dataset/images`
- copies label files from `dataset2/labels` -> `dataset/labels` (skips files without image counterpart unless --force)
- avoids overwriting existing files unless `--overwrite` is provided

Usage:
    python3 scripts/import_labelstudio_dataset.py [--overwrite] [--force]

Options:
    --overwrite : overwrite files with same name in destination
    --force     : copy label files even if no matching image is found

"""
import argparse
import json
import os
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / 'dataset'
DATASET2 = ROOT / 'dataset2'


def read_classes_from_notes(notes_path: Path):
    with notes_path.open('r', encoding='utf8') as f:
        j = json.load(f)
    if 'categories' in j and isinstance(j['categories'], list):
        return [c['name'] for c in j['categories']]
    return None


def read_classes_from_txt(txt_path: Path):
    with txt_path.open('r', encoding='utf8') as f:
        lines = [l.strip() for l in f.readlines()]
    return [l for l in lines if l]


def ensure_dataset_dirs():
    (DATASET / 'images').mkdir(parents=True, exist_ok=True)
    (DATASET / 'labels').mkdir(parents=True, exist_ok=True)


def write_classes_txt(classes):
    out = DATASET / 'classes.txt'
    with out.open('w', encoding='utf8') as f:
        for c in classes:
            f.write(c + "\n")
    print('Wrote', out)


def write_notes_json(classes):
    out = DATASET / 'notes.json'
    categories = [{'id': i, 'name': name} for i, name in enumerate(classes)]
    payload = {'categories': categories}
    with out.open('w', encoding='utf8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print('Wrote', out)


def copy_files(overwrite=False, force=False):
    images_src = DATASET2 / 'images'
    labels_src = DATASET2 / 'labels'
    images_dst = DATASET / 'images'
    labels_dst = DATASET / 'labels'

    if not images_src.exists() and not labels_src.exists():
        print('No images/labels in dataset2 found. Nothing to copy.')
        return

    # copy images
    if images_src.exists():
        for img in images_src.iterdir():
            if not img.is_file():
                continue
            dst = images_dst / img.name
            if dst.exists() and not overwrite:
                print('Skipped image (exists):', dst.name)
                continue
            shutil.copy2(img, dst)
            print('Copied image:', img.name)

    # copy labels
    if labels_src.exists():
        for lab in labels_src.iterdir():
            if not lab.is_file():
                continue
            dst = labels_dst / lab.name
            basename = lab.stem
            # check there is an image with same basename (any extension)
            matching_image = None
            for ext in ('.jpg', '.jpeg', '.png', '.bmp', '.webp'):
                if (images_dst / (basename + ext)).exists():
                    matching_image = basename + ext
                    break
            if not matching_image and not force:
                print('Skipped label (no matching image):', lab.name)
                continue
            if dst.exists() and not overwrite:
                print('Skipped label (exists):', dst.name)
                continue
            shutil.copy2(lab, dst)
            print('Copied label:', lab.name)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--overwrite', action='store_true')
    parser.add_argument('--force', action='store_true', help='copy labels even if no matching image is found')
    args = parser.parse_args()

    if not DATASET2.exists():
        print('dataset2 not found at', DATASET2)
        return

    ensure_dataset_dirs()

    classes = None
    notes_path = DATASET2 / 'notes.json'
    classes_txt_path = DATASET2 / 'classes.txt'
    if notes_path.exists():
        try:
            classes = read_classes_from_notes(notes_path)
        except Exception as e:
            print('Failed reading notes.json:', e)
    if not classes and classes_txt_path.exists():
        try:
            classes = read_classes_from_txt(classes_txt_path)
        except Exception as e:
            print('Failed reading classes.txt:', e)

    if classes:
        # if dataset already has classes, compare
        existing = None
        existing_path = DATASET / 'classes.txt'
        if existing_path.exists():
            try:
                existing = read_classes_from_txt(existing_path)
            except Exception:
                existing = None
        if existing and existing != classes:
            print('WARNING: classes in dataset already exist and differ from dataset2. Overwriting not done by default.')
            print('dataset classes:', existing)
            print('dataset2 classes:', classes)
            print('If you want to overwrite, re-run with --overwrite and I will replace classes files.')
        else:
            write_classes_txt(classes)
            write_notes_json(classes)

    copy_files(overwrite=args.overwrite, force=args.force)
    print('Import finished. You may want to run your dataset split script (scripts/split_dataset.py) if needed.')


if __name__ == '__main__':
    main()
