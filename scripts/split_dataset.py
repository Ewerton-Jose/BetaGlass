#!/usr/bin/env python3
"""
Split YOLO-style dataset into train/val folders.
Usage:
    python3 scripts/split_dataset.py --dataset ./dataset --train-ratio 0.8 --seed 42

This script copies images and labels from dataset/images and dataset/labels into
dataset/train/images, dataset/train/labels, dataset/val/images, dataset/val/labels
keeping matching base filenames. It ignores images without labels but warns.
"""

import argparse
import os
import random
import shutil
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser(description='Split YOLO dataset into train/val')
    p.add_argument('--dataset', type=str, default='dataset', help='Path to dataset folder')
    p.add_argument('--train-ratio', type=float, default=0.8, help='Fraction of samples for training')
    p.add_argument('--seed', type=int, default=42, help='Random seed')
    p.add_argument('--move', action='store_true', help='Move files instead of copy')
    return p.parse_args()


def main():
    args = parse_args()
    ds = Path(args.dataset)
    images_dir = ds / 'images'
    labels_dir = ds / 'labels'

    if not images_dir.exists() or not labels_dir.exists():
        print('Erro: espere encontrar `images/` e `labels/` dentro de', ds)
        return

    # gather all images with common extensions
    exts = ['.jpg', '.jpeg', '.png', '.bmp']
    images = [p for p in images_dir.iterdir() if p.suffix.lower() in exts]
    images.sort()

    pairs = []
    for img in images:
        base = img.stem
        # possible label file
        label_candidates = [labels_dir / (base + ext) for ext in ['.txt']]
        label = None
        for c in label_candidates:
            if c.exists():
                label = c
                break
        if label is None:
            print(f'Aviso: imagem sem label encontrada, ignorando: {img.name}')
            continue
        pairs.append((img, label))

    if not pairs:
        print('Nenhuma imagem com label encontrada. Verifique o dataset/images e dataset/labels')
        return

    random.seed(args.seed)
    random.shuffle(pairs)

    n_train = int(len(pairs) * args.train_ratio)
    train_pairs = pairs[:n_train]
    val_pairs = pairs[n_train:]

    out_train_images = ds / 'train' / 'images'
    out_train_labels = ds / 'train' / 'labels'
    out_val_images = ds / 'val' / 'images'
    out_val_labels = ds / 'val' / 'labels'

    for p in [out_train_images, out_train_labels, out_val_images, out_val_labels]:
        p.mkdir(parents=True, exist_ok=True)

    def copy_or_move(src: Path, dst: Path):
        if args.move:
            shutil.move(str(src), str(dst))
        else:
            shutil.copy2(str(src), str(dst))

    for img, lbl in train_pairs:
        copy_or_move(img, out_train_images / img.name)
        copy_or_move(lbl, out_train_labels / lbl.name)

    for img, lbl in val_pairs:
        copy_or_move(img, out_val_images / img.name)
        copy_or_move(lbl, out_val_labels / lbl.name)

    print(f'Split completo: {len(train_pairs)} treino, {len(val_pairs)} validação')
    print('Directories created under', ds)


if __name__ == '__main__':
    main()
