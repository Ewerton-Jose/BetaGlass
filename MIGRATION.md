# 🔄 Guia de Migração para Nova Estrutura

## O que mudou?

### ✅ Melhorias Implementadas

1. **Estrutura organizada**:
   - `src/` agora contém todo código-fonte
   - `assets/` centraliza CSS
   - `data/` isolado para datasets (não versionados)
   - `docs/` para documentação

2. **Teachable Machine removido**:
   - Diretório `src/teachable/` e páginas antigas foram apagados
   - Menu aponta apenas para YOLO e Landing Page

3. **Paths atualizados**:
   - Todos os caminhos foram ajustados automaticamente
   - `dataset3/` → `data/dataset3/`

4. **.gitignore criado**:
   - Modelos grandes (*.pt, *.onnx) não serão versionados
   - Datasets de treino/validação ignorados

### 📋 Arquivos Mantidos (Compatibilidade)
Compatibilidade mantida apenas para as rotas principais (`index.html`, `yolo/`, `src/landing/`).

### 🆕 Novo Ponto de Entrada

Use **`index.html`** como página principal:
- Menu com acesso ao YOLO e à Landing Page

## 🚀 Como Testar

```bash
# Servir o projeto
python3 -m http.server 8000

# Testar cada versão:
# http://localhost:8000/index.html         # Menu principal
# http://localhost:8000/yolo/camera.html  # YOLO (atualizado)
# http://localhost:8000/src/landing/index.html   # Landing page
```

## 🗑️ Limpeza Opcional

Os arquivos legados do Teachable já foram removidos.

## 📝 Notas Importantes

1. **yolov8n.pt**: Adicionado ao `.gitignore` (6MB)
2. **Dataset**: Movido para `data/` e configurado no `.gitignore`
3. **GitHub Pages**: Funciona com ambas estruturas (antiga e nova)
4. **Scripts**: Atualizados para usar `data/dataset3/`

## 🔗 Links Úteis

- [README.md](README.md) - Visão geral
- [docs/README.md](docs/README.md) - Documentação técnica
- [docs/TRAINING.md](docs/TRAINING.md) - Treinamento de modelos
