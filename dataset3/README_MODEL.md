Dataset3 model placeholder and export instructions

Este diretório contém os dados do `dataset3` (imagens, labels e classes).

O arquivo `model.onnx` não é distribuído aqui por padrão. Para gerar um ONNX válido e colocá-lo em `dataset3/model.onnx`, siga as instruções abaixo (Ultralytics / YOLO):

1. Treine/exporte com o comando do Ultralytics (exemplo):

```bash
# dentro do ambiente onde o yolo (ultralytics) está disponível
yolo export model=path/to/best.pt format=onnx opset=12
```

2. Mova o ONNX gerado para o caminho do projeto:

```bash
mv path/to/exported.onnx /caminho/para/BetaGlass/dataset3/model.onnx
```

Ou use o script `scripts/export_to_dataset3.sh` que automatiza export+move.

ATENÇÃO: não coloque um arquivo .onnx corrompido — o carregamento no navegador pode falhar. Use o script abaixo para exportar corretamente.
