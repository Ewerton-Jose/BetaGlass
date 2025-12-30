#!/usr/bin/env bash
# Helper script to export an Ultralytics YOLO checkpoint to ONNX and move it to dataset3
set -euo pipefail

USAGE="Usage: $0 --ckpt PATH_TO_CHECKPOINT [--opset N]"

CKPT=""
OPSET=12

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ckpt)
      CKPT="$2"; shift 2;;
    --opset)
      OPSET="$2"; shift 2;;
    --help|-h)
      echo "$USAGE"; exit 0;;
    *) echo "Unknown arg: $1"; echo "$USAGE"; exit 1;;
  esac
done

if [[ -z "$CKPT" ]]; then
  echo "Erro: --ckpt é obrigatório"
  echo "$USAGE"
  exit 2
fi

echo "Exportando $CKPT -> ONNX (opset=$OPSET)"
# Este comando assume que você tem o utilitário 'yolo' (Ultralytics) disponível no PATH
yolo export model="$CKPT" format=onnx opset=$OPSET

# O export normalmente gera um arquivo no diretório atual ou em 'runs/detect/exp/export'
EXPORTED=$(ls -t *.onnx 2>/dev/null || true)
if [[ -z "$EXPORTED" ]]; then
  EXPORTED=$(ls -t runs/*/export/*.onnx 2>/dev/null || true)
fi

if [[ -z "$EXPORTED" ]]; then
  echo "Não consegui encontrar o ONNX exportado. Verifique onde o comando 'yolo export' gravou o arquivo.";
  exit 3
fi

DEST="$PWD/../data/dataset3/model.onnx"
echo "Movendo $EXPORTED -> $DEST"
mkdir -p "$(dirname "$DEST")"
mv $EXPORTED "$DEST"
echo "Feito: $DEST"
