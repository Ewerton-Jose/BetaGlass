// script.js
const startBtn = document.getElementById('startBtn');
const stopBtn  = document.getElementById('stopBtn');
const video    = document.getElementById('cameraVideo');
const overlay  = document.getElementById('overlayMsg');
const errorDiv = document.getElementById('error');

let streamRef = null; // guardamos o stream pra poder parar depois

async function startCamera() {
    startBtn.style.display = 'none';
  errorDiv.textContent = '';
  // Alguns navegadores exigem que a chamada seja a partir de um gesto do usuário (click) — por isso temos o botão.
  const constraints = { video: { width: 640, height: 480, facingMode: "environment" }, audio: false };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef = stream;
    video.srcObject = stream;
    // remove a mensagem overlay
    overlay.style.display = 'none';
    stopBtn.disabled = false;
    startBtn.disabled = false;
    startBtn.style.display = 'none';
    
  } catch (err) {
    // Trata erros de permissão e outros
    if (err && err.name === 'NotAllowedError') {
      errorDiv.textContent = 'Permissão negada: permita o uso da câmera no navegador.';
    } else if (err && err.name === 'NotFoundError') {
      errorDiv.textContent = 'Nenhuma câmera encontrada neste dispositivo.';
    } else {
      errorDiv.textContent = 'Erro ao acessar a câmera: ' + (err && err.message ? err.message : err);
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
  startBtn.disabled = false;
  errorDiv.textContent = '';
}

// Event listeners
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);

// Liberar a câmera se a página for fechada/recarregada
window.addEventListener('beforeunload', () => {
  if (streamRef) {
    streamRef.getTracks().forEach(t => t.stop());
  }
});
