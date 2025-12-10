// ===== CÓDIGO DA PÁGINA index.html =====

const URL = "https://teachablemachine.withgoogle.com/models/5aXNg7B01/";
let model, webcam, maxPredictions;
const startBtn = document.getElementById('startBtn');
const errorDiv = document.getElementById('error');
const webcamContainer = document.getElementById('webcam-container');
const orientationWarning = document.getElementById('orientation-warning');
let topDiv;
let audioPlayed = false;

// Verificar orientação
function checkOrientation() {
  const isLandscape = window.innerWidth > window.innerHeight;
  if (!isLandscape) {
    orientationWarning.classList.add('show');
  } else {
    orientationWarning.classList.remove('show');
  }
}

// Monitorar mudanças de orientação
window.addEventListener('orientationchange', () => {
  setTimeout(checkOrientation, 100);
});

window.addEventListener('resize', () => {
  checkOrientation();
});

// Reproduzir áudio de boas-vindas
function playWelcomeAudio() {
  if (audioPlayed) return;
  audioPlayed = true;

  const utterance = new SpeechSynthesisUtterance();
  utterance.text = 'Seja bem vindo! Ponha o celular na horizontal e foque em poucos objetos';
  utterance.lang = 'pt-BR';
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

function sizeCanvasCover(){
  if (!webcam || !webcam.canvas) return;
  const canvas = webcam.canvas;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let vidW = 640, vidH = 480;
  try {
    const v = webcam.webcam || webcam.video || null;
    if (v && v.videoWidth && v.videoHeight) { vidW = v.videoWidth; vidH = v.videoHeight; }
  } catch {}
  const arVideo = vidW / vidH;
  const arViewport = vw / vh;
  if (arViewport > arVideo) {
    canvas.style.width = vw + 'px';
    canvas.style.height = 'auto';
  } else {
    canvas.style.height = vh + 'px';
    canvas.style.width = 'auto';
  }
  canvas.style.position = 'absolute';
  canvas.style.top = '50%';
  canvas.style.left = '50%';
  canvas.style.transform = 'translate(-50%, -50%)';
}

async function init(){
  startBtn.classList.add('hidden');
  errorDiv.textContent = '';
  
  // Reproduzir áudio de boas-vindas
  playWelcomeAudio();
  
  // Verificar orientação
  checkOrientation();

  try {
    model = await tmImage.load(URL + 'model.json', URL + 'metadata.json');
    maxPredictions = model.getTotalClasses();
    const flip = false;
    webcam = new tmImage.Webcam(640, 480, flip);
    await webcam.setup({ facingMode: { exact: "environment" } });
    await webcam.play();
    window.requestAnimationFrame(loop);
    webcamContainer.appendChild(webcam.canvas);
    topDiv = document.createElement('div');
    topDiv.id = 'top-prediction';
    webcamContainer.appendChild(topDiv);
    sizeCanvasCover();
    window.addEventListener('resize', sizeCanvasCover);
    window.addEventListener('orientationchange', sizeCanvasCover);
    validateBackCamera();
  } catch(err){
    startBtn.classList.remove('hidden');
    if (err && err.name === 'NotAllowedError') {
      errorDiv.textContent = 'Permissão negada: autorize o uso da câmera.';
    } else if (err && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError')) {
      errorDiv.textContent = 'Câmera traseira não disponível neste dispositivo.';
    } else {
      errorDiv.textContent = 'Erro ao inicializar: ' + (err.message || err);
    }
  }
}

async function loop(){
  webcam.update();
  await predictTop();
  window.requestAnimationFrame(loop);
}

async function predictTop(){
  const prediction = await model.predict(webcam.canvas);
  let best = prediction[0];
  for (let i=1;i<prediction.length;i++){
    if (prediction[i].probability > best.probability){
      best = prediction[i];
    }
  }
  topDiv.textContent = `${best.className} (${(best.probability*100).toFixed(1)}%)`;
}

startBtn.addEventListener('click', () => {
  window.location.href = 'yolo/camera.html';
});

async function validateBackCamera(){
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    const backLike = videoInputs.find(d => /back|rear|environment|traseira/i.test(d.label));
    if (!backLike && videoInputs.length > 1){
      errorDiv.textContent = 'Aviso: usando outra câmera (traseira não identificada).';
    }
  } catch(e){ /* silencioso */ }
}

// Iniciar quando a página carrega
window.addEventListener('load', init);

// ===== CÓDIGO ANTERIOR DO script.js =====

// script.js
const startBtnOld = document.getElementById('startBtn');
const stopBtn  = document.getElementById('stopBtn');
const video    = document.getElementById('cameraVideo');
const overlay  = document.getElementById('overlayMsg');
const errorDivOld = document.getElementById('error');

let streamRef = null; // guardamos o stream pra poder parar depois

async function startCamera() {
    startBtnOld.style.display = 'none';
  errorDivOld.textContent = '';
  // Alguns navegadores exigem que a chamada seja a partir de um gesto do usuário (click) — por isso temos o botão.
  const constraints = { video: { width: 640, height: 480, facingMode: "environment" }, audio: false };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef = stream;
    video.srcObject = stream;
    // remove a mensagem overlay
    overlay.style.display = 'none';
    stopBtn.disabled = false;
    startBtnOld.disabled = false;
    startBtnOld.style.display = 'none';
    
  } catch (err) {
    // Trata erros de permissão e outros
    if (err && err.name === 'NotAllowedError') {
      errorDivOld.textContent = 'Permissão negada: permita o uso da câmera no navegador.';
    } else if (err && err.name === 'NotFoundError') {
      errorDivOld.textContent = 'Nenhuma câmera encontrada neste dispositivo.';
    } else {
      errorDivOld.textContent = 'Erro ao acessar a câmera: ' + (err && err.message ? err.message : err);
    }
    overlay.style.display = 'flex';
  }
}

function stopCamera() {
  if (!streamRef) return;
  const tracks = streamRef.getTracks();
  tracks.forEach(t => t.stop());
  streamRef = null;
  video.srcObject = null;
  overlay.style.display = 'flex';
  stopBtn.disabled = true;
  startBtnOld.disabled = false;
  errorDivOld.textContent = '';
}

// Event listeners (somente se a página possuir todos os elementos necessários)
if (startBtn && stopBtn && video) {
  startBtn.addEventListener('click', startCamera);
  stopBtn.addEventListener('click', stopCamera);
}

// Liberar a câmera se a página for fechada/recarregada
window.addEventListener('beforeunload', () => {
  if (streamRef) {
    streamRef.getTracks().forEach(t => t.stop());
  }
});
