# BetaGlass — Detecção com YOLOv8 (ONNX)

Aplicativo web que usa a câmera para detectar componentes eletrônicos, agora exclusivamente com **YOLOv8 em ONNX** (sem Teachable Machine).

## O que você precisa colocar no repositório

- `data/dataset3/model.onnx` — modelo exportado do YOLOv8 (veja o guia em `docs/TRAINING.md`).
- `data/dataset3/classes.txt` ou `notes.json` — nomes das classes (já existe um exemplo no repositório).

## Como usar localmente

```bash
# a partir da raiz do projeto
python3 -m http.server 8000
# abrir no navegador
# http://localhost:8000/index.html        # menu
# http://localhost:8000/yolo/camera.html  # detector
```

Conceda permissão para a câmera quando solicitado. O código tenta usar a câmera traseira quando disponível.

## Notas

- O modelo ONNX é carregado de `data/dataset3/model.onnx` por padrão.
- Se `classes.txt` ou `notes.json` não forem encontrados, o código usa um fallback de nomes.
- Consulte `docs/TRAINING.md` para treinar e exportar seu próprio modelo YOLOv8.
