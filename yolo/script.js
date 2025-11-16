// Função para iniciar a captura da câmera
async function setupCamera() {
    const video = document.getElementById('video');
    const stream = await navigator.mediaDevices.getUserMedia({
        video: true
    });
    video.srcObject = stream;
    return new Promise((resolve) => {
        video.onloadedmetadata = () => resolve(video);
    });
}

// Função para carregar o modelo Coco-SSD
async function loadModel() {
    const model = await cocoSsd.load();
    console.log("Modelo carregado!");
    return model;
}

// Função para detectar objetos
async function detectObjects(model, video) {
    const predictions = await model.detect(video);

    // Mostrar as predições no HTML
    displayPredictions(predictions);

    // Falar o que foi detectado
    if (predictions.length > 0) {
        const detectedItems = predictions.map(pred => pred.class).join(", ");
        speakOutLoud(`Eu detectei: ${detectedItems}`);
    }
}

// Função para exibir as predições no HTML
function displayPredictions(predictions) {
    const detectionsDiv = document.getElementById('detections');
    detectionsDiv.innerHTML = '';

    predictions.forEach(prediction => {
        const detection = document.createElement('p');
        detection.textContent = `${prediction.class} com confiança de ${prediction.score.toFixed(2)}`;
        detectionsDiv.appendChild(detection);
    });
}

// Função para síntese de voz
function speakOutLoud(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    window.speechSynthesis.speak(utterance);
}

// Função para inicializar o sistema
async function init() {
    const video = await setupCamera();  // Inicia a câmera
    const model = await loadModel();    // Carrega o modelo de detecção Coco-SSD
    
    // A cada 1000ms (1 segundo), detecta objetos na imagem da câmera
    setInterval(() => {
        detectObjects(model, video);
    }, 1000);
}

// Inicializa o sistema
init();
