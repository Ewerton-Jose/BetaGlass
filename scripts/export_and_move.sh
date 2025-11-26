#!/usr/bin/env bash
# Busca o checkpoint mais recente (best.pt / last.pt) e tenta exportar para ONNX
# Uso: ./scripts/export_and_move.sh [--opset N] [--dest dataset/model.onnx] [--ckpt /path/to/best.pt]
set -euo pipefail

# defaults
OPSET=12
DEST_REL="dataset2/model.onnx"
CKPT_ARG=""

# parse args
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --opset)
      OPSET="$2"; shift 2;;
    --dest)
      DEST_REL="$2"; shift 2;;
    --ckpt)
      CKPT_ARG="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 [--opset <num>] [--dest <path>] [--ckpt <path>]"; exit 0;;
    *)
      echo "Unknown argument: $1" >&2; exit 2;;
  esac
done

echo "Procurando checkpoints (best.pt / last.pt) em locais comuns..."
# procura em alguns locais comuns: cwd/runs, $HOME/.pyenv/runs, $HOME/runs
CANDIDATES=()
while IFS= read -r -d $'\0' f; do
  CANDIDATES+=("$f")
done < <(find "$PWD" "$HOME" -type f \( -path "*/runs/*/weights/best.pt" -o -path "*/runs/*/weights/last.pt" -o -name "best.pt" -o -name "last.pt" \) -print0 2>/dev/null || true)

BEST=""
if [ -n "$CKPT_ARG" ]; then
  if [ -f "$CKPT_ARG" ]; then
    BEST="$CKPT_ARG"
  else
    echo "Checkpoint informado em --ckpt não encontrado: $CKPT_ARG" >&2
    exit 1
  fi
else
  if [ ${#CANDIDATES[@]} -eq 0 ]; then
    echo "Nenhum checkpoint encontrado automaticamente. Por favor informe o caminho do .pt com --ckpt." >&2
    echo "Exemplo: $0 --ckpt /caminho/para/best.pt --dest dataset2/model.onnx" >&2
    exit 1
  fi
  # seleciona o mais recente (por modtime)
  for c in "${CANDIDATES[@]}"; do
    if [ -z "$BEST" ]; then BEST="$c"; else
      if [ "$c" -nt "$BEST" ]; then BEST="$c"; fi
    fi
  done
fi

echo "Checkpoint selecionado: $BEST"

# executa export
echo "Exportando para ONNX (opset=$OPSET) com o comando 'yolo export'..."
# usa caminho absoluto
CHKPT_ABS="$(readlink -f "$BEST")"

if ! command -v yolo >/dev/null 2>&1; then
  echo "Comando 'yolo' não encontrado no PATH. Ative seu ambiente virtual onde o ultralytics está instalado." >&2
  exit 2
fi

# Tenta exportar
set +e
yolo export model="$CHKPT_ABS" format=onnx opset="$OPSET"
EXPORT_RET=$?
set -e

if [ $EXPORT_RET -ne 0 ]; then
  echo "Erro: comando 'yolo export' retornou código $EXPORT_RET" >&2
  echo "Verifique mensagens acima — problemas comuns: incompatibilidade de versão do PyTorch, falta de dependências, ou checkpoint corrompido." >&2
  exit $EXPORT_RET
fi

# tenta localizar o ONNX gerado (mesmo diretório ou runs/...)
ONNX_PATH=""
# procura por arquivos .onnx recentes no cwd e em runs
while IFS= read -r -d $'\0' f; do
  ONNX_PATH="$f"
done < <(find "$PWD" "$HOME" -type f -name "*.onnx" -print0 2>/dev/null || true)

if [ -z "$ONNX_PATH" ]; then
  echo "Export aparentemente bem-sucedido, mas não encontrei o arquivo .onnx gerado automaticamente." >&2
  echo "Procure manualmente o arquivo .onnx (p.ex. em runs/detect/.../weights/)." >&2
  exit 1
fi

# move o ONNX para destino (relativo à raiz onde o script foi chamado)
DEST="$PWD/$DEST_REL"
mkdir -p "$(dirname "$DEST")"
mv -f "$ONNX_PATH" "$DEST"

echo "ONNX movido para $DEST_REL (caminho absoluto: $DEST)"
exit 0
