Treinamento do modelo (YOLOv8) — Guia rápido

Resumo
- Este repositório tem imagens em `dataset/images/` e labels YOLO em `dataset/labels/`.
- Use o script `scripts/split_dataset.py` para criar `dataset/train` e `dataset/val`.
- `dataset/data.yaml` já está preparado com `nc: 4` e nomes das classes.

Pré-requisitos
- Python 3.8+
- pip

Recomendações de ambiente
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install ultralytics
```

1) Dividir o dataset
```bash
# copia por padrão (use --move para mover)
python3 scripts/split_dataset.py --dataset dataset --train-ratio 0.8 --seed 42
```

2) Treinar com Ultralytics YOLO (YOLOv8)
```bash
# treina usando o data.yaml já criado
yolo task=detect mode=train model=yolov8n.pt data=dataset/data.yaml epochs=50 imgsz=640
```

Ao final do treino, os pesos ficam em `runs/detect/train/weights/best.pt`.

3) Exportar para ONNX (para uso no navegador)
```bash
# exporta para ONNX
yolo export model=runs/detect/train/weights/best.pt format=onnx
# mova o arquivo gerado para o diretório servido pela página
mv runs/detect/train/weights/best.onnx dataset/model.onnx
```

4) Testar no navegador
```bash
# servir o projeto localmente (a partir da raiz do repo)
python3 -m http.server 8000
# abrir no navegador
# http://localhost:8000/yolo/camera.html
```
- A página tenta carregar `dataset/model.onnx` primeiro. Se não encontrar, tenta TFJS (`dataset/model/model.json`) e por fim usa o fallback `coco-ssd`.
- Conceda permissão para a câmera.
- A página fala o nome do objeto detectado e a confiança (ex.: “Arduino, 92 por cento”) e loga a melhor predição no console.

Notas e alternativas
- Se preferir exportar para TFJS, use `yolo export ... format=tfjs` e coloque o resultado em `dataset/model/model.json`.
- Métricas como mAP são exibidas durante o treino no terminal e nos logs de `runs/detect/train/results*.txt`.

Problemas comuns
- Erros 404 no navegador para `dataset/model/...` são normais até o arquivo existir.
- Se o modelo ONNX não funcionar no navegador, verifique o formato das saídas (o `yolo/camera.js` tenta heurísticas, mas modelos custom podem precisar de adaptação).

Se quiser, eu posso:
- Gerar um script adicional para converter pesos para TFJS.
- Ajustar `yolo/camera.html` para desenhar bounding boxes sobre o vídeo.
