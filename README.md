# BetaGlass — MediaPipe Object Detection

Este repositório contém uma página web que usa a câmera para detectar componentes eletrônicos.

Atualização: substituímos o uso do Teachable Machine pela integração com MediaPipe Tasks (ObjectDetector).

O que você precisa colocar neste repositório:

- `model.tflite` — arquivo do modelo TensorFlow Lite treinado para detectar os componentes eletrônicos que você deseja.

Como obter/gerar `model.tflite` a partir do Teachable Machine

1) Se você treinou no Teachable Machine, ao exportar escolha a opção "TensorFlow Lite (tflite)" quando disponível.
   - Isso deve gerar um arquivo `.tflite` que você pode baixar.

2) Se você tiver apenas a versão TensorFlow.js (model.json + pesos), pode converter para TFLite usando Python/TensorFlow. Exemplo resumido:

```python
# Exemplo ilustrativo — ajuste conforme seu modelo e ambiente
import tensorflow as tf
# Carregue seu modelo TF SavedModel (ou converta do TFJS para SavedModel antes)
model = tf.keras.models.load_model('meu_saved_model')
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
# converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS, tf.lite.OpsSet.SELECT_TF_OPS]
# converter.experimental_new_converter = True
tflite_model = converter.convert()
with open('model.tflite', 'wb') as f:
    f.write(tflite_model)
```

Se você precisa de instruções específicas para converter de Teachable Machine -> TFJS -> SavedModel -> TFLite, posso detalhar o passo a passo com comandos.

Como usar este projeto localmente

1. Coloque `model.tflite` na raiz do projeto (o mesmo diretório de `index.html`).
2. Abra `index.html` em um servidor local (alguns navegadores bloqueiam getUserMedia em arquivos locais). Exemplo rápido com Python 3:

```bash
# a partir da pasta do projeto
python3 -m http.server 8000
# abrir http://localhost:8000/index.html
```

3. Clique em "Começar" e autorize o uso da câmera. O código tenta usar a câmera traseira (facingMode: environment). Se não houver câmera traseira, o navegador pode exibir um aviso.

Notas e limitações
tensorflowjs_converter --input_format=tfjs_layers_model --output_format=tf_saved_model model.json saved_model
- O MediaPipe Tasks espera um modelo TFLite compatível com detecção de objetos (com saída de caixas e rótulos). Nem todo `.tflite` funcionará sem ajustes; o modelo deve estar formatado para object detection (por exemplo, um modelo SSD ou similar com categorias).
- Se você estiver usando um classificador de imagem (não um detector com caixas), podemos integrar o `ImageClassifier` do MediaPipe em vez do `ObjectDetector`. Diga qual formato de saída o seu modelo tem (rótulos por imagem ou boxes+labels) e eu adapto o código.
- Posso ajudar a converter automaticamente seu modelo TM para TFLite se você compartilhar como o exportou (TFJS, SavedModel, etc.).
