// Função para iniciar a captura da câmera
// preferRear: ao pedir true, tenta priorizar a câmera traseira (environment) em dispositivos móveis
async function setupCamera(preferRear = false) {
    const video = document.getElementById('video');
    // Verifica disponibilidade de getUserMedia com fallbacks legados
    const hasModern = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    let stream = null;
    if (!hasModern) {
        // tenta APIs legadas
        const getUserMediaLegacy = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        if (getUserMediaLegacy) {
            stream = await new Promise((resolve, reject) => {
                getUserMediaLegacy.call(navigator, { video: true }, resolve, reject);
            });
        } else {
            const msg = 'getUserMedia não disponível. Abra a página via http(s) em um navegador compatível e permita acesso à câmera.';
            console.error(msg);
            // Mostra mensagem na UI
            const topDiv = document.getElementById('top-prediction');
            if (topDiv) {
                topDiv.textContent = msg;
                topDiv.classList.remove('hidden');
            }
            throw new Error(msg);
        }
    } else {
        // Estratégia: se preferRear, primeiro tenta facingMode ideal 'environment', senão uso simples {video:true}
        try {
            if (preferRear) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
                } catch (e) {
                    // alguns navegadores podem rejeitar facingMode exact/ideal; tentaremos enumeração de dispositivos
                    console.warn('Tentativa facingMode failed, tentando enumerateDevices fallback:', e);
                }
            }

            // Se ainda não pegou stream, tenta a chamada genérica (pode pedir front camera)
            if (!stream) {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }

            // Verifica se queremos forçar a traseira e o stream atual parece ser a câmera frontal
            if (preferRear && stream && stream.getVideoTracks && stream.getVideoTracks().length) {
                const track = stream.getVideoTracks()[0];
                // tenta inferir se é frontal via label (após permissão labels podem ser preenchidas)
                const label = track.label || '';
                if (/front|front camera|front-facing|frontal|selfie/i.test(label)) {
                    // libera este stream e tenta escolher deviceId que pareça traseiro
                    try { stream.getTracks().forEach(t=>t.stop()); } catch(e){}
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const cams = devices.filter(d => d.kind === 'videoinput');
                    // procura por labels que indiquem traseira
                    let rear = cams.find(c => /back|rear|traseira|environment/i.test(c.label));
                    if (!rear && cams.length > 1) rear = cams[cams.length - 1]; // fallback: pega último da lista
                    if (rear) {
                        try {
                            stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: rear.deviceId } } });
                        } catch (e) {
                            console.warn('Falha ao abrir deviceId traseiro, mantendo stream atual:', e);
                            // tenta reabrir stream genérico
                            stream = await navigator.mediaDevices.getUserMedia({ video: true });
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Erro ao acessar câmera com mediaDevices:', err);
            const msg = 'Erro ao acessar câmera: ' + String(err);
            const topDiv = document.getElementById('top-prediction');
            if (topDiv) {
                topDiv.textContent = msg;
                topDiv.classList.remove('hidden');
            }
            throw err;
        }
    }

    video.srcObject = stream;
    return new Promise((resolve) => {
        video.onloadedmetadata = () => resolve(video);
    });
}

// Controle para falar apenas uma vez por detecção contínua
const SPEAK_COOLDOWN_MS = 5000; // tempo para resetar falas (ms)
const spoken = new Set();
const lastSeen = {};

// Mapa de classes carregado a partir de dataset/notes.json ou dataset/classes.txt
let CLASS_MAP = null;

function getClassName(cls) {
    if (cls === null || cls === undefined) return String(cls);
    const asNum = Number(cls);
    if (!isNaN(asNum) && CLASS_MAP && CLASS_MAP[asNum]) return CLASS_MAP[asNum];
    return String(cls);
}

function prettyNameForDisplay(cls) {
    // Retorna um nome legível para UI. Se não houver mapeamento, retorna 'Desconhecido'.
    if (cls === null || cls === undefined) return 'Desconhecido';
    const asNum = Number(cls);
    if (!isNaN(asNum) && CLASS_MAP && CLASS_MAP[asNum]) return CLASS_MAP[asNum];
    return 'Desconhecido';
}

async function loadClassMap() {
    // Tenta notes.json
    try {
        const resp = await fetch('/dataset/notes.json');
        if (resp.ok) {
            const json = await resp.json();
            if (json && Array.isArray(json.categories)) {
                const map = {};
                json.categories.forEach(cat => { map[cat.id] = cat.name; });
                console.log('CLASS_MAP carregado de /dataset/notes.json:', map);
                CLASS_MAP = map;
                return CLASS_MAP;
            }
        }
    } catch (e) {
        // ignore
    }

    // Tenta classes.txt (uma classe por linha)
    try {
        const resp2 = await fetch('/dataset/classes.txt');
        if (resp2.ok) {
            const text = await resp2.text();
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const map = {};
            lines.forEach((name, idx) => { map[idx] = name; });
            console.log('CLASS_MAP carregado de /dataset/classes.txt:', map);
            CLASS_MAP = map;
            return CLASS_MAP;
        }
    } catch (e) {
        // ignore
    }

    console.warn('Nenhum mapa de classes encontrado (notes.json ou classes.txt). Classe reais podem aparecer como índices.');
    return null;
}

// Função para carregar o modelo (ONNX primeiro, depois TFJS, depois fallback)
async function loadModel() {
    // 1) Tenta ONNX em /dataset2/model.onnx primeiro, depois em /dataset/model.onnx
    let onnxUrl = '/dataset2/model.onnx';
    try {
        let respOnnx = await fetch(onnxUrl, { method: 'HEAD' });
        if (!(respOnnx && respOnnx.ok)) {
            // tenta fallback para dataset
            onnxUrl = '/dataset/model.onnx';
            respOnnx = await fetch(onnxUrl, { method: 'HEAD' });
        }
        if (respOnnx && respOnnx.ok) {
            if (!window.ort) {
                console.warn('ONNX Runtime não encontrado no contexto global (ort). Verifique camera.html.');
            } else {
                try {
                    console.log('Tentando criar sessão ONNX de', onnxUrl);
                    const session = await ort.InferenceSession.create(onnxUrl);
                    console.log('Sessão ONNX criada');
                    // Log metadata de inputs para diagnosticar erros de dimensão (ex.: 320 vs 640)
                    try {
                        console.log('ONNX session.inputNames:', session.inputNames);
                        console.log('ONNX session.inputMetadata:', session.inputMetadata);
                    } catch (metaErr) {
                        console.warn('Falha ao ler inputMetadata da sessão ONNX:', metaErr);
                    }
                    return {type: 'onnx', session: session};
                } catch (e) {
                    console.warn('Erro ao criar sessão ONNX de', onnxUrl, e);
                }
            }
        }
    } catch (e) {
        // ignora
    }

    // 2) Tenta TFJS model.json em /dataset/model/model.json
    const modelUrl = '/dataset/model/model.json';
    try {
        const resp = await fetch(modelUrl, { method: 'GET' });
        if (resp.ok) {
            console.log('Tentando carregar modelo TFJS de', modelUrl);
            try {
                const graphModel = await tf.loadGraphModel(modelUrl);
                console.log('Modelo TFJS carregado de:', modelUrl);
                return {type: 'tfjs', model: graphModel};
            } catch (loadErr) {
                console.warn('Arquivo encontrado em', modelUrl, 'mas erro ao carregar como TFJS:', loadErr);
            }
        } else {
            console.log('Nenhum model.json em', modelUrl, '(resposta HTTP', resp.status + ')');
        }
    } catch (err) {
        console.log('Erro ao verificar', modelUrl, err);
    }

    console.warn('Nenhum modelo ONNX/TFJS encontrado. Usando fallback coco-ssd.');

    // 3) Fallback para coco-ssd
    const coco = await cocoSsd.load();
    console.log('Usando fallback coco-ssd');
    return {type: 'coco', model: coco};
}

// Pré-processamento para entrada ONNX: redimensiona o frame e retorna tensor ort.Tensor
function preprocessForOnnx(video, inputMeta) {
    // Determina dims/shape do modelo
    // Muitos modelos (Ultralytics YOLO) usam 640x640 por padrão — usar 640 como fallback
    let targetH = 640, targetW = 640;
    let layout = 'NCHW';
    if (inputMeta && inputMeta.dimensions) {
        const dims = inputMeta.dimensions;
        if (dims.length === 4) {
            if (dims[1] === 3) {
                // [1,3,H,W]
                targetH = dims[2] || targetH;
                targetW = dims[3] || targetW;
                layout = 'NCHW';
            } else if (dims[3] === 3) {
                // [1,H,W,3]
                targetH = dims[1] || targetH;
                targetW = dims[2] || targetW;
                layout = 'NHWC';
            }
        }
    }

    const off = document.createElement('canvas');
    off.width = targetW;
    off.height = targetH;
    const ctx = off.getContext('2d');
    ctx.drawImage(video, 0, 0, targetW, targetH);
    const imageData = ctx.getImageData(0, 0, targetW, targetH).data; // RGBA

    if (layout === 'NCHW') {
        const floatData = new Float32Array(1 * 3 * targetH * targetW);
        // fill in CHW order
        let ptrR = 0;
        let ptrG = targetH * targetW;
        let ptrB = 2 * targetH * targetW;
        for (let y = 0; y < targetH; y++) {
            for (let x = 0; x < targetW; x++) {
                const idx = (y * targetW + x) * 4;
                floatData[ptrR++] = imageData[idx] / 255.0;
                floatData[ptrG++] = imageData[idx + 1] / 255.0;
                floatData[ptrB++] = imageData[idx + 2] / 255.0;
            }
        }
        return {tensor: new ort.Tensor('float32', floatData, [1, 3, targetH, targetW]), width: targetW, height: targetH};
    } else {
        const floatData = new Float32Array(1 * targetH * targetW * 3);
        let ptr = 0;
        for (let y = 0; y < targetH; y++) {
            for (let x = 0; x < targetW; x++) {
                const idx = (y * targetW + x) * 4;
                floatData[ptr++] = imageData[idx] / 255.0;
                floatData[ptr++] = imageData[idx + 1] / 255.0;
                floatData[ptr++] = imageData[idx + 2] / 255.0;
            }
        }
        return {tensor: new ort.Tensor('float32', floatData, [1, targetH, targetW, 3]), width: targetW, height: targetH};
    }
}

// Função para detectar objetos
async function detectObjects(wrapper, video, options = {}) {
    const forceSpeak = options && options.forceSpeak === true;
    if (wrapper.type === 'coco') {
        const predictions = await wrapper.model.detect(video);

        // Log de acurácia no console (em %)
        if (predictions && predictions.length > 0) {
            console.log('Predictions:', predictions.map(p => `${getClassName(p.class)} (${(p.score*100).toFixed(1)}%)`).join(', '));
        } else {
            console.log('Predictions: nenhum objeto detectado');
        }


        displayPredictions(predictions.map(p => ({class: p.class, score: p.score})));

        // Atualiza timestamps e fala apenas uma vez por componente enquanto presente
        const now = Date.now();
        const seenThisFrame = new Set();
        predictions.forEach(p => {
            const name = getClassName(p.class);
            lastSeen[name] = now;
            seenThisFrame.add(name);
            if (forceSpeak || !spoken.has(name)) {
                // fala o nome da classe; se for acionado manualmente fala só o nome
                if (forceSpeak) speakName(name); else speakOutLoud(name, p.score);
                spoken.add(name);
            }
        });

        // Limpa componentes que não aparecem mais por tempo maior que cooldown
        for (const cls of Array.from(spoken)) {
            if (!seenThisFrame.has(cls) && (now - (lastSeen[cls] || 0) > SPEAK_COOLDOWN_MS)) {
                spoken.delete(cls);
                delete lastSeen[cls];
            }
        }

        return;
    }

    // Tratamento para modelo ONNX
    if (wrapper.type === 'onnx') {
        try {
            const session = wrapper.session;
            // obtém input metadata
            const inputNames = session.inputNames || Object.keys(session.inputMetadata || {});
            const inputName = inputNames[0];
            const inputMeta = session.inputMetadata ? session.inputMetadata[inputName] : (session.inputMetadata || null);

            // pré-processa frame
            const prep = preprocessForOnnx(video, inputMeta);
            const feeds = {};
            feeds[inputName] = prep.tensor;

            // Executa a sessão
            const outputMap = await session.run(feeds);

            // Log breve dos outputs (nomes e shapes)
            const outKeys = Object.keys(outputMap);
            console.log('ONNX outputs:', outKeys.map(k => `${k}: ${outputMap[k].dims ? outputMap[k].dims.join('x') : ''}`).join(', '));

            // Heurística para parsear saídas comuns de modelos YOLO ONNX
            const outEntries = Object.entries(outputMap).map(([k, v]) => ({name: k, data: v.data, dims: v.dims}));
            let detections = [];
            const videoW = video.videoWidth;
            const videoH = video.videoHeight;

            // DEBUG: se a saída for do tipo 1x8x8400 (formato observado), logar amostras e estatísticas
            try {
                const single = outEntries.length === 1 ? outEntries[0] : null;
                if (single && single.dims && single.dims.length === 3) {
                    const C = single.dims[1];
                    const N = single.dims[2];
                    if (C === 8 && N >= 1000) {
                        const data = single.data;
                        // calc min/max/mean
                        let min = Infinity, max = -Infinity, sum = 0;
                        for (let i = 0; i < Math.min(10000, data.length); i++) {
                            const v = data[i];
                            if (v < min) min = v;
                            if (v > max) max = v;
                            sum += v;
                        }
                        const mean = sum / Math.min(10000, data.length);
                        console.log('ONNX raw stats (sampled 10k):', {C, N, min, max, mean});
                        // mostrar primeiras 6 posições (rows)
                        const rows = [];
                        for (let n = 0; n < Math.min(6, N); n++) {
                            const row = new Array(C);
                            for (let c = 0; c < C; c++) row[c] = data[c * N + n];
                            rows.push(row);
                        }
                        console.log('ONNX raw sample rows (first 6):', rows);
                        console.log('NOTE: rows prováveis = [x, y, w, h, obj, cls0, cls1, cls2...] ou similar.');
                        // para investigação, reduza threshold para permitir ver algumas detecções
                        console.warn('DEBUG: usando threshold reduzido (0.05) temporariamente para investigação.');
                        var __DEBUG_ONNX_THRESHOLD = 0.05;
                    }
                }
            } catch (dbgErr) {
                console.warn('Erro ao coletar estatísticas ONNX para debug:', dbgErr);
            }

            if (outEntries.length === 1) {
                // Decoder genérico para saída única: suporta formatos [1,C,N] ou [1,N,C]
                const o = outEntries[0];
                const dims = o.dims;
                if (dims && dims.length === 3) {
                    // determine layout: [1,C,N] quando C<<N (ex.: 8 x 8400),
                    // ou [1,N,C] quando N<<C
                    let C, N;
                    const data = o.data;
                    function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

                    if (dims[1] < dims[2]) {
                        // [1, C, N]
                        C = dims[1];
                        N = dims[2];
                        // iterate over N (positions)
                        for (let n = 0; n < N; n++) {
                            const row = new Array(C);
                            for (let c = 0; c < C; c++) row[c] = data[c * N + n];
                            // parse common YOLO-like layout: [x,y,w,h,obj, ...class_scores]
                            // Aplicar heurísticas: sigmoid para x,y,obj e classes; w/h podem precisar de exp
                            let rx = row[0], ry = row[1], rw = row[2], rh = row[3];
                            let robj = (C > 4) ? row[4] : 1.0;
                            // transformações
                            const tx = sigmoid(rx);
                            const ty = sigmoid(ry);
                            // w/h: se estiverem fora de 0..1, tentar exp() para recuperar escala relativa
                            let tw = rw;
                            let th = rh;
                            if (tw > 1.5 || tw < -1.5) tw = Math.exp(tw); else tw = sigmoid(tw);
                            if (th > 1.5 || th < -1.5) th = Math.exp(th); else th = sigmoid(th);
                            const tobj = sigmoid(robj);
                            let classIdx = 0;
                            let classProb = 1.0;
                            if (C > 5) {
                                const classScores = row.slice(5);
                                // aplicar sigmoid aos scores de classe (heurística para multi-label/logits)
                                const classSig = classScores.map(v => sigmoid(v));
                                // também calcular softmax como fallback e tomar o método com maior contraste
                                const exps = classScores.map(v => Math.exp(v - Math.max(...classScores)));
                                const sum = exps.reduce((a,b)=>a+b,0) || 1e-6;
                                const probs = exps.map(e => e / sum);
                                // escolher entre sigmoid ou softmax - aqui usamos softmax por padrão
                                let best = 0; for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
                                classIdx = best;
                                classProb = probs[best];
                            }
                            const score = tobj * classProb;
                            // usa threshold de debug se definido
                            const thr = (typeof __DEBUG_ONNX_THRESHOLD !== 'undefined') ? __DEBUG_ONNX_THRESHOLD : 0.25;
                            if (!score || score < thr) continue;
                            // assume coordenadas normalizadas x_center,y_center,w,h (após transformação)
                            const x1 = (tx - tw/2) * videoW;
                            const y1 = (ty - th/2) * videoH;
                            const bw = tw * videoW;
                            const bh = th * videoH;
                            detections.push({class: classIdx, score: score, box: [x1, y1, bw, bh]});
                        }
                    } else {
                        // [1, N, C]
                        N = dims[1];
                        C = dims[2];
                        for (let n = 0; n < N; n++) {
                            const base = n * C;
                                // leitura bruta
                                const rx = data[base + 0];
                                const ry = data[base + 1];
                                const rw = data[base + 2];
                                const rh = data[base + 3];
                                const robj = (C > 4) ? data[base + 4] : 1.0;
                                // transformações heurísticas
                                const sigmoid = x => 1 / (1 + Math.exp(-x));
                                const tx = sigmoid(rx);
                                const ty = sigmoid(ry);
                                let tw = rw;
                                let th = rh;
                                if (tw > 1.5 || tw < -1.5) tw = Math.exp(tw); else tw = sigmoid(tw);
                                if (th > 1.5 || th < -1.5) th = Math.exp(th); else th = sigmoid(th);
                                const tobj = sigmoid(robj);
                                let classIdx = 0;
                                let classProb = 1.0;
                                if (C > 5) {
                                    const classScores = [];
                                    for (let c = 5; c < C; c++) classScores.push(data[base + c]);
                                    const exps = classScores.map(v => Math.exp(v - Math.max(...classScores)));
                                    const sum = exps.reduce((a,b)=>a+b,0) || 1e-6;
                                    const probs = exps.map(e => e / sum);
                                    let best = 0; for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
                                    classIdx = best;
                                    classProb = probs[best];
                                }
                                const score = tobj * classProb;
                                const thr = (typeof __DEBUG_ONNX_THRESHOLD !== 'undefined') ? __DEBUG_ONNX_THRESHOLD : 0.25;
                                if (!score || score < thr) continue;
                                const x1 = (tx - tw/2) * videoW;
                                const y1 = (ty - th/2) * videoH;
                                const bw = tw * videoW;
                                const bh = th * videoH;
                                detections.push({class: classIdx, score: score, box: [x1, y1, bw, bh]});
                        }
                    }
                    // Aplicar NMS simples para filtrar múltiplas detecções sobrepostas
                    function iou(a, b) {
                        const [x1,y1,w1,h1] = a.box; const [x2,y2,w2,h2] = b.box;
                        const ax1 = x1, ay1 = y1, ax2 = x1 + w1, ay2 = y1 + h1;
                        const bx1 = x2, by1 = y2, bx2 = x2 + w2, by2 = y2 + h2;
                        const ix1 = Math.max(ax1,bx1), iy1 = Math.max(ay1,by1);
                        const ix2 = Math.min(ax2,bx2), iy2 = Math.min(ay2,by2);
                        const iw = Math.max(0, ix2 - ix1);
                        const ih = Math.max(0, iy2 - iy1);
                        const inter = iw * ih;
                        const union = w1*h1 + w2*h2 - inter;
                        return union <= 0 ? 0 : (inter / union);
                    }
                    detections.sort((a,b)=>b.score - a.score);
                    const nmsDet = [];
                    const iouThreshold = 0.45;
                    for (const d of detections) {
                        let keep = true;
                        for (const k of nmsDet) {
                            if (d.class === k.class && iou(d,k) > iouThreshold) { keep = false; break; }
                        }
                        if (keep) nmsDet.push(d);
                        if (nmsDet.length >= 50) break;
                    }
                    detections = nmsDet;
                } else {
                    console.warn('Formato de saída ONNX não reconhecido (dims):', o.dims);
                }
            } else {
                // tenta identificar por nomes
                let boxesEntry = outEntries.find(e => /box|bbox/i.test(e.name));
                let scoresEntry = outEntries.find(e => /score/i.test(e.name));
                let classesEntry = outEntries.find(e => /class|label|id/i.test(e.name));
                if (boxesEntry && scoresEntry) {
                    const boxes = boxesEntry.data;
                    const scores = scoresEntry.data;
                    const classes = classesEntry ? classesEntry.data : null;
                    // assumir boxes layout [1, N, 4]
                    const dims = boxesEntry.dims;
                    const N = (dims && dims.length === 3) ? dims[1] : (boxes.length / 4);
                    for (let i = 0; i < N; i++) {
                        const bbase = i * 4;
                        const s = scores[i];
                        if (!s || s < 0.25) continue;
                        const x1 = boxes[bbase] * videoW;
                        const y1 = boxes[bbase + 1] * videoH;
                        const bw = boxes[bbase + 2] * videoW;
                        const bh = boxes[bbase + 3] * videoH;
                        let clsName = 'obj';
                        if (classes) {
                            const cid = classes[i];
                            clsName = (CLASS_MAP && CLASS_MAP[cid]) ? CLASS_MAP[cid] : String(cid);
                        }
                        detections.push({class: clsName, score: s, box: [x1, y1, bw, bh]});
                    }
                } else {
                    console.warn('Não consegui mapear automaticamente as saídas ONNX. Saídas:', outEntries.map(e=>e.name));
                }
            }

            // Log e exibição
            if (detections && detections.length > 0) {
                console.log('ONNX Detections:', detections.map(d => `${getClassName(d.class)} (${(d.score*100).toFixed(1)}%)`).join(', '));
            } else {
                console.log('ONNX: nenhum objeto detectado');
            }

            displayPredictions(detections.map(d => ({class: d.class, score: d.score})));

            // fala única
            const now = Date.now();
            const seenThisFrame = new Set();
            detections.forEach(d => {
                const name = getClassName(d.class);
                lastSeen[name] = now;
                seenThisFrame.add(name);
                if (forceSpeak || !spoken.has(name)) {
                    if (forceSpeak) speakName(name); else speakOutLoud(name, d.score);
                    spoken.add(name);
                }
            });
            for (const cls of Array.from(spoken)) {
                if (!seenThisFrame.has(cls) && (now - (lastSeen[cls] || 0) > SPEAK_COOLDOWN_MS)) {
                    spoken.delete(cls);
                    delete lastSeen[cls];
                }
            }

            return;
        } catch (err) {
            console.error('Erro ao executar sessão ONNX:', err);
            // Mensagem mais amigável quando há mismatch de dimensão
            try {
                const msg = err && err.message ? err.message : String(err);
                const mGot = msg.match(/Got: (\d+)/g);
                const mExp = msg.match(/Expected: (\d+)/g);
                if (mGot || mExp) {
                    console.warn('Parece haver incompatibilidade entre o tamanho enviado e o tamanho esperado pelo modelo.');
                    console.warn('Erro original:', msg);
                    console.warn('Sugestão: verifique `session.inputMetadata` (veja console) e ajuste o pre-processamento para usar a altura/largura esperadas (ex.: 640x640).');
                }
            } catch (parseErr) {
                // ignore
            }
        }
    }

    // Tratamento para modelo TFJS (graph model)
    try {
        const graphModel = wrapper.model;
        // Captura frame do vídeo para tensor
        const inputTensor = tf.tidy(() => {
            const img = tf.browser.fromPixels(video);
            // tenta inferir tamanho de entrada do modelo
            let targetH = 320, targetW = 320;
            if (graphModel && graphModel.inputs && graphModel.inputs.length > 0) {
                const shape = graphModel.inputs[0].shape; // [1, h, w, 3]
                if (shape && shape.length === 4) {
                    targetH = shape[1] || targetH;
                    targetW = shape[2] || targetW;
                }
            }
            const resized = tf.image.resizeBilinear(img, [targetH, targetW]);
            const casted = resized.cast('float32').div(255.0);
            const expanded = casted.expandDims(0);
            return expanded;
        });

        // Executa o modelo
        const outputs = await graphModel.executeAsync(inputTensor);
        // outputs pode ser tensor único ou array. Normalmente: [boxes, scores, classes]
        let boxesTensor, scoresTensor, classesTensor;
        if (Array.isArray(outputs)) {
            if (outputs.length === 3) {
                boxesTensor = outputs[0];
                scoresTensor = outputs[1];
                classesTensor = outputs[2];
            } else if (outputs.length === 1) {
                // saída única — formato indefinido, o usuário provavelmente precisará converter o modelo
                console.warn('Saída do modelo TFJS possui 1 tensor — formato personalizado. Adapte o código conforme seu modelo.');
                tf.dispose(outputs);
                tf.dispose(inputTensor);
                return;
            } else {
                console.warn('Saída do modelo TFJS possui formato não esperado:', outputs);
                tf.dispose(outputs);
                tf.dispose(inputTensor);
                return;
            }
        } else {
            console.warn('Saída do modelo TFJS não é array — formato personalizado.');
            tf.dispose(outputs);
            tf.dispose(inputTensor);
            return;
        }

        // Converte para arrays e faz NMS
        const boxes = await boxesTensor.array();
        const scores = await scoresTensor.array();
        const classes = classesTensor ? await classesTensor.array() : null;

        // boxes esperado: [1, num, 4] com coordenadas relativas ou absolutas — depende do modelo
        // Aqui vamos tentar tratar como [1, num, 4] com x1,y1,x2,y2 normalizados (0..1)
        const boxesArr = boxes[0] || boxes;
        const scoresArr = scores[0] || scores;
        const classesArr = classes ? (classes[0] || classes) : null;

        const detections = [];
        const videoW = video.videoWidth;
        const videoH = video.videoHeight;

        for (let i = 0; i < boxesArr.length; i++) {
            const b = boxesArr[i];
            const s = Array.isArray(scoresArr) ? scoresArr[i] : scoresArr;
            if (!s || s < 0.25) continue;
            let clsRaw = classesArr ? classesArr[i] : 'obj';
            let cls = 'obj';
            if (clsRaw !== null && clsRaw !== undefined) {
                // se for número (ou string de número) tenta mapear via CLASS_MAP
                const asNum = Number(clsRaw);
                if (!isNaN(asNum) && CLASS_MAP && CLASS_MAP[asNum]) {
                    cls = CLASS_MAP[asNum];
                } else if (!isNaN(asNum)) {
                    cls = String(asNum);
                } else {
                    cls = String(clsRaw);
                }
            }
            // se as coordenadas estiverem normalizadas (0..1)
            let x1 = b[0], y1 = b[1], x2 = b[2], y2 = b[3];
            if (x2 <= 1 && y2 <= 1) {
                x1 = x1 * videoW; y1 = y1 * videoH; x2 = x2 * videoW; y2 = y2 * videoH;
            }
            detections.push({class: String(cls), score: s, box: [x1, y1, x2 - x1, y2 - y1]});
        }


        // Log de acurácia no console
        if (detections && detections.length > 0) {
            console.log('Detections:', detections.map(d => `${getClassName(d.class)} (${(d.score*100).toFixed(1)}%)`).join(', '));
        } else {
            console.log('Detections: nenhum objeto detectado');
        }

        displayPredictions(detections.map(d => ({class: d.class, score: d.score})));

        // Fala cada componente apenas uma vez enquanto for detectado
        const now = Date.now();
        const seenThisFrame = new Set();
        detections.forEach(d => {
            const name = getClassName(d.class);
            lastSeen[name] = now;
            seenThisFrame.add(name);
            if (forceSpeak || !spoken.has(name)) {
                if (forceSpeak) speakName(name); else speakOutLoud(name, d.score);
                spoken.add(name);
            }
        });
        for (const cls of Array.from(spoken)) {
            if (!seenThisFrame.has(cls) && (now - (lastSeen[cls] || 0) > SPEAK_COOLDOWN_MS)) {
                spoken.delete(cls);
                delete lastSeen[cls];
            }
        }

        tf.dispose([boxesTensor, scoresTensor, classesTensor, inputTensor]);

    } catch (err) {
        console.error('Erro ao executar modelo TFJS:', err);
    }
}

// Função para exibir as predições no HTML
function displayPredictions(predictions) {
    const detectionsDiv = document.getElementById('detections');
    detectionsDiv.innerHTML = '';

    // Atualiza lista de detecções (visível se necessário)
    predictions.forEach(prediction => {
        const detection = document.createElement('p');
        const name = prettyNameForDisplay(prediction.class);
        detection.textContent = `${name} com confiança de ${prediction.score.toFixed(2)}`;
        detectionsDiv.appendChild(detection);
    });

    // Atualiza o topo com a melhor predição e loga a acurácia no console
    const topDiv = document.getElementById('top-prediction');
    if (predictions && predictions.length > 0) {
        const top = predictions.slice().sort((a, b) => b.score - a.score)[0];
        const topName = prettyNameForDisplay(top.class);
        // Mostrar apenas o nome na div; colocar confiança no title para hover
        topDiv.textContent = topName;
        try { topDiv.title = `${getClassName(top.class)} — ${(top.score * 100).toFixed(1)}%`; } catch (e) {}
        topDiv.classList.remove('hidden');
        console.log('Top prediction:', `${topName} (${(top.score*100).toFixed(1)}%)`);
    } else {
        topDiv.textContent = '';
        topDiv.title = '';
        topDiv.classList.add('hidden');
        console.log('Top prediction: nenhum objeto detectado');
    }
}

// Função para síntese de voz
function speakOutLoud(text, confidence = null) {
    let phrase = String(text);
    if (confidence !== null && !isNaN(confidence)) {
        // fala o nome e a confiança arredondada
        phrase = `${phrase}, ${(confidence * 100).toFixed(0)} por cento`;
    }

    const utter = new SpeechSynthesisUtterance(phrase);
    utter.lang = 'pt-BR';

    // Escolhe voz preferida: busca vozes com 'Google' e pt-BR, senão qualquer voz pt, senão fallback
    function chooseVoice() {
        const voices = window.speechSynthesis.getVoices() || [];
        if (!voices || voices.length === 0) return null;
        // Prefer voices containing 'Google' and Portuguese
        let v = voices.find(vv => /google/i.test(vv.name) && /pt/i.test(vv.lang));
        if (!v) v = voices.find(vv => /google/i.test(vv.name));
        if (!v) v = voices.find(vv => /^pt/.test(vv.lang));
        if (!v) v = voices[0];
        return v;
    }

    const voice = chooseVoice();
    if (voice) {
        utter.voice = voice;
        window.speechSynthesis.speak(utter);
    } else {
        // se ainda não há vozes carregadas, aguarda o evento onvoiceschanged
        const onvoices = () => {
            try {
                const v2 = chooseVoice();
                if (v2) utter.voice = v2;
                window.speechSynthesis.speak(utter);
            } finally {
                window.speechSynthesis.removeEventListener('voiceschanged', onvoices);
            }
        };
        window.speechSynthesis.addEventListener('voiceschanged', onvoices);
        // timeout fallback: se não chegar vozes em 1s, fala sem voice específica
        setTimeout(() => {
            if (!utter.voice) {
                try { window.speechSynthesis.speak(utter); } catch(e){}
                window.speechSynthesis.removeEventListener('voiceschanged', onvoices);
            }
        }, 1000);
    }
}

// Fala apenas o nome (sem confiança) — útil para o botão 'Identificar'
function speakName(text) {
    const utter = new SpeechSynthesisUtterance(String(text));
    utter.lang = 'pt-BR';

    function chooseVoice() {
        const voices = window.speechSynthesis.getVoices() || [];
        if (!voices || voices.length === 0) return null;
        let v = voices.find(vv => /google/i.test(vv.name) && /pt/i.test(vv.lang));
        if (!v) v = voices.find(vv => /google/i.test(vv.name));
        if (!v) v = voices.find(vv => /^pt/.test(vv.lang));
        if (!v) v = voices[0];
        return v;
    }

    const voice = chooseVoice();
    if (voice) {
        utter.voice = voice;
        window.speechSynthesis.speak(utter);
    } else {
        const onvoices = () => {
            try {
                const v2 = chooseVoice();
                if (v2) utter.voice = v2;
                window.speechSynthesis.speak(utter);
            } finally {
                window.speechSynthesis.removeEventListener('voiceschanged', onvoices);
            }
        };
        window.speechSynthesis.addEventListener('voiceschanged', onvoices);
        setTimeout(() => {
            if (!utter.voice) {
                try { window.speechSynthesis.speak(utter); } catch(e){}
                window.speechSynthesis.removeEventListener('voiceschanged', onvoices);
            }
        }, 1000);
    }
}

// Função para inicializar o sistema
async function init() {
    let video;
    try {
        // preferRear=true tenta usar a câmera traseira em celulares
        video = await setupCamera(true);  // Inicia a câmera
    } catch (err) {
        console.error('Falha ao iniciar a câmera:', err);
        // Mensagem já foi escrita em setupCamera; apenas saímos sem lançar erro não tratado
        return;
    }
    // Carrega mapa de classes (notes.json / classes.txt) antes de tentar carregar modelo
    await loadClassMap();

    // Observação: se não houver `model.json` na pasta esperada, o navegador fará requisições 404.
    // Isso é normal — coloque seu TFJS `model.json` em `dataset/model/model.json` para evitar 404.
    const model = await loadModel();    // Carrega o modelo de detecção (TFJS ou fallback coco-ssd)

    // Botão "Identificar": captura o frame atual e executa detecção uma vez
    const identifyBtn = document.getElementById('identify-btn');
    if (identifyBtn) {
        identifyBtn.addEventListener('click', async () => {
            // opcional: feedback visual rápido
            identifyBtn.disabled = true;
            identifyBtn.textContent = 'Detectando...';
            try {
                await detectObjects(model, video, {forceSpeak: true});
            } catch (err) {
                console.error('Erro ao executar detecção ao clicar:', err);
            }
            identifyBtn.textContent = 'Identificar';
            identifyBtn.disabled = false;
        });
    } else {
        // Fallback: se botão não existir, executar detecção periódica (compatibilidade)
        setInterval(() => {
            detectObjects(model, video);
        }, 1000);
    }
}

// Inicializa o sistema
init();
