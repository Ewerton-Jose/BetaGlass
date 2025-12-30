# 🔬 BetaGlass — Detecção de Componentes Eletrônicos

Aplicativo educativo para ensino de robótica utilizando detecção de objetos via câmera.

## 🚀 Acesso Rápido

Abra o `index.html` para escolher entre as versões disponíveis:

- **YOLO v8**: Detecção com YOLOv8 (ONNX) - mais precisa e rápida
- **Landing Page**: Apresentação do projeto

## 📁 Estrutura do Projeto

```
BetaGlass/
├── src/
│   ├── yolo/           # Versão YOLOv8 (antiga pasta na raiz)
│   └── landing/        # Landing page
├── assets/
│   ├── styles/         # CSS (index.css)
├── data/
│   └── dataset3/       # Dataset para treinamento
├── scripts/            # Scripts de automação
├── docs/               # Documentação completa
│   ├── README.md       # Documentação detalhada
│   ├── TRAINING.md     # Guia de treinamento
│   └── LICENSE         # Licença do projeto
└── index.html          # Página principal (menu)
```

## 🎯 Como Usar

### Localmente

1. Sirva o projeto com um servidor HTTP:

```bash
python3 -m http.server 8000
```

2. Acesse no navegador:
   - http://localhost:8000/index.html

### GitHub Pages

O projeto está configurado para funcionar no GitHub Pages automaticamente.

## 📚 Documentação Completa

- [docs/README.md](docs/README.md) - Detalhes técnicos e integração com MediaPipe
- [docs/TRAINING.md](docs/TRAINING.md) - Como treinar seu próprio modelo YOLOv8
- [docs/LICENSE](docs/LICENSE) - Licença do projeto

## 🛠️ Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript (vanilla)
- **ML**: YOLOv8 (ONNX)
- **Computer Vision**: ONNX Runtime

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

## 📄 Licença

Consulte [docs/LICENSE](docs/LICENSE) para mais informações.
