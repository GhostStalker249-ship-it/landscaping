const canvas = document.getElementById('plannerCanvas');
const ctx = canvas.getContext('2d');
const imageInput = document.getElementById('imageInput');
const plantLibrary = document.getElementById('plantLibrary');
const emptyHint = document.getElementById('emptyHint');
const selectionControls = document.getElementById('selectionControls');
const scaleRange = document.getElementById('scaleRange');
const rotationRange = document.getElementById('rotationRange');
const deleteBtn = document.getElementById('deleteBtn');
const bringFrontBtn = document.getElementById('bringFrontBtn');
const sendBackBtn = document.getElementById('sendBackBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');

const selectNanoBtn = document.getElementById('selectNanoBtn');
const selectGeminiBtn = document.getElementById('selectGeminiBtn');
const nanoPanel = document.getElementById('nanoPanel');
const geminiPanel = document.getElementById('geminiPanel');

const nanoApiUrlInput = document.getElementById('nanoApiUrl');
const nanoApiKeyInput = document.getElementById('nanoApiKey');
const nanoPromptInput = document.getElementById('nanoPrompt');
const nanoProcessBtn = document.getElementById('nanoProcessBtn');
const nanoStatus = document.getElementById('nanoStatus');

const geminiApiKeyInput = document.getElementById('geminiApiKey');
const geminiModelInput = document.getElementById('geminiModel');
const geminiPromptInput = document.getElementById('geminiPrompt');
const geminiProcessBtn = document.getElementById('geminiProcessBtn');
const geminiStatus = document.getElementById('geminiStatus');

const plants = [
  { id: 'tree-oak', name: 'Дуб', icon: '🌳', size: 72 },
  { id: 'tree-pine', name: 'Ель', icon: '🌲', size: 72 },
  { id: 'bush', name: 'Кустарник', icon: '🌿', size: 58 },
  { id: 'flower', name: 'Цветы', icon: '🌸', size: 54 },
  { id: 'palm', name: 'Пальма', icon: '🌴', size: 72 },
  { id: 'herb', name: 'Травы', icon: '🪴', size: 56 },
  { id: 'rock', name: 'Камень', icon: '🪨', size: 50 },
  { id: 'pond', name: 'Пруд', icon: '💧', size: 52 },
];

let backgroundImage = null;
let backgroundImageBlob = null;
let elements = [];
let selectedElementId = null;
let dragState = null;

function setStatus(element, message, type = 'default') {
  element.textContent = message;
  element.classList.remove('success', 'error');
  if (type === 'success') element.classList.add('success');
  if (type === 'error') element.classList.add('error');
}

function setProcessor(name) {
  const isNano = name === 'nano';
  selectNanoBtn.classList.toggle('active', isNano);
  selectGeminiBtn.classList.toggle('active', !isNano);
  nanoPanel.classList.toggle('hidden', !isNano);
  geminiPanel.classList.toggle('hidden', isNano);
}

function rememberConfig() {
  localStorage.setItem('nanoApiUrl', nanoApiUrlInput.value.trim());
  localStorage.setItem('nanoApiKey', nanoApiKeyInput.value);
  localStorage.setItem('geminiApiKey', geminiApiKeyInput.value);
  localStorage.setItem('geminiModel', geminiModelInput.value.trim());
}

function restoreConfig() {
  nanoApiUrlInput.value = localStorage.getItem('nanoApiUrl') ?? '';
  nanoApiKeyInput.value = localStorage.getItem('nanoApiKey') ?? '';
  geminiApiKeyInput.value = localStorage.getItem('geminiApiKey') ?? '';
  geminiModelInput.value = localStorage.getItem('geminiModel') || 'gemini-2.5-pro';
}

function createPlantButtons() {
  plants.forEach((plant) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plant-btn';
    button.innerHTML = `<span class="plant-icon">${plant.icon}</span><span class="plant-name">${plant.name}</span>`;
    button.addEventListener('click', () => addPlant(plant));
    plantLibrary.appendChild(button);
  });
}

function addPlant(plant) {
  if (!backgroundImage) {
    alert('Сначала загрузите фото участка.');
    return;
  }

  const id = crypto.randomUUID();
  elements.push({
    id,
    icon: plant.icon,
    name: plant.name,
    x: canvas.width / 2,
    y: canvas.height / 2,
    scale: 1,
    rotation: 0,
    baseSize: plant.size,
  });

  selectedElementId = id;
  syncSelectionControls();
  render();
}

function loadBackgroundFromDataUrl(dataUrl, blob = null) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      backgroundImage = image;
      backgroundImageBlob = blob;
      resolve();
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function loadBackgroundFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await loadBackgroundFromDataUrl(String(reader.result), blob);
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, mimeType = 'image/png') {
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mimeType });
}

async function getCurrentImageBlob() {
  if (backgroundImageBlob) return backgroundImageBlob;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Не удалось подготовить изображение для отправки.');
  return blob;
}

function drawBackground() {
  if (!backgroundImage) {
    ctx.fillStyle = '#eef5ee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const ratio = Math.max(canvas.width / backgroundImage.width, canvas.height / backgroundImage.height);
  const drawWidth = backgroundImage.width * ratio;
  const drawHeight = backgroundImage.height * ratio;
  const offsetX = (canvas.width - drawWidth) / 2;
  const offsetY = (canvas.height - drawHeight) / 2;
  ctx.drawImage(backgroundImage, offsetX, offsetY, drawWidth, drawHeight);
}

function drawElements() {
  elements.forEach((element) => {
    ctx.save();
    ctx.translate(element.x, element.y);
    ctx.rotate((element.rotation * Math.PI) / 180);
    const fontSize = element.baseSize * element.scale;
    ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(element.icon, 0, 0);

    if (element.id === selectedElementId) {
      const box = getElementBounds(element);
      ctx.strokeStyle = '#2f7d32';
      ctx.lineWidth = 2;
      ctx.strokeRect(-box.width / 2, -box.height / 2, box.width, box.height);
    }
    ctx.restore();
  });
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawElements();
  emptyHint.style.display = backgroundImage ? 'none' : 'grid';
}

function getSelectedElement() {
  return elements.find((item) => item.id === selectedElementId) ?? null;
}

function syncSelectionControls() {
  const selected = getSelectedElement();
  selectionControls.classList.toggle('disabled', !selected);
  scaleRange.value = selected ? String(selected.scale) : '1';
  rotationRange.value = selected ? String(selected.rotation) : '0';
}

function getElementBounds(element) {
  const size = element.baseSize * element.scale;
  return { width: size * 0.9, height: size * 1.1 };
}

function screenToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height,
  };
}

function findElementAtPosition(x, y) {
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const element = elements[i];
    const dx = x - element.x;
    const dy = y - element.y;
    const radians = (-element.rotation * Math.PI) / 180;
    const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
    const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
    const bounds = getElementBounds(element);
    if (Math.abs(localX) <= bounds.width / 2 && Math.abs(localY) <= bounds.height / 2) return element;
  }
  return null;
}

async function applyNanoBanana() {
  if (!backgroundImage) {
    setStatus(nanoStatus, 'Сначала загрузите фото участка.', 'error');
    return;
  }

  const apiUrl = nanoApiUrlInput.value.trim();
  const apiKey = nanoApiKeyInput.value.trim();
  const prompt = nanoPromptInput.value.trim();

  if (!apiUrl || !prompt) {
    setStatus(nanoStatus, 'Заполните API URL и промпт для Nano Banana.', 'error');
    return;
  }

  rememberConfig();
  nanoProcessBtn.disabled = true;
  setStatus(nanoStatus, 'Отправка фото в Nano Banana...', 'default');

  try {
    const sourceBlob = await getCurrentImageBlob();
    const formData = new FormData();
    formData.append('image', sourceBlob, 'landscape-input.png');
    formData.append('prompt', prompt);
    formData.append('output_format', 'png');

    const headers = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(apiUrl, { method: 'POST', headers, body: formData });
    if (!response.ok) {
      throw new Error(`Ошибка Nano Banana API (${response.status}): ${await response.text()}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let resultBlob;

    if (contentType.includes('application/json')) {
      const payload = await response.json();
      const imageBase64 = payload.image_base64 || payload.imageBase64;
      const imageUrl = payload.image_url || payload.imageUrl;

      if (imageBase64) {
        resultBlob = base64ToBlob(imageBase64, payload.mime_type || payload.mimeType || 'image/png');
      } else if (imageUrl) {
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) throw new Error('Nano Banana вернул image_url, но файл недоступен.');
        resultBlob = await imgRes.blob();
      } else {
        throw new Error('Ответ не содержит image_base64/image_url.');
      }
    } else {
      resultBlob = await response.blob();
    }

    await loadBackgroundFromBlob(resultBlob);
    render();
    setStatus(nanoStatus, 'Готово: изображение обработано через Nano Banana.', 'success');
  } catch (error) {
    setStatus(nanoStatus, `Ошибка Nano Banana: ${error instanceof Error ? error.message : 'неизвестно'}`, 'error');
  } finally {
    nanoProcessBtn.disabled = false;
  }
}

async function applyGeminiImage() {
  if (!backgroundImage) {
    setStatus(geminiStatus, 'Сначала загрузите фото участка.', 'error');
    return;
  }

  const apiKey = geminiApiKeyInput.value.trim();
  const model = geminiModelInput.value.trim() || 'gemini-2.5-pro';
  const prompt = geminiPromptInput.value.trim();

  if (!apiKey || !prompt) {
    setStatus(geminiStatus, 'Заполните Gemini API key и промпт.', 'error');
    return;
  }

  rememberConfig();
  geminiProcessBtn.disabled = true;
  setStatus(geminiStatus, 'Отправка фото в Gemini 3 Pro Image API...', 'default');

  try {
    const sourceBlob = await getCurrentImageBlob();
    const base64 = await blobToBase64(sourceBlob);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inline_data: { mime_type: sourceBlob.type || 'image/png', data: base64 } },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Ошибка Gemini API (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData || part.inline_data);

    if (!imagePart) {
      throw new Error('Gemini не вернул изображение. Проверьте модель и response modalities.');
    }

    const inline = imagePart.inlineData || imagePart.inline_data;
    const imageBlob = base64ToBlob(inline.data, inline.mimeType || inline.mime_type || 'image/png');

    await loadBackgroundFromBlob(imageBlob);
    render();
    setStatus(geminiStatus, 'Готово: изображение обработано через Gemini.', 'success');
  } catch (error) {
    setStatus(geminiStatus, `Ошибка Gemini: ${error instanceof Error ? error.message : 'неизвестно'}`, 'error');
  } finally {
    geminiProcessBtn.disabled = false;
  }
}

imageInput.addEventListener('change', async (event) => {
  const [file] = event.target.files ?? [];
  if (!file) return;

  try {
    await loadBackgroundFromBlob(file);
    elements = [];
    selectedElementId = null;
    syncSelectionControls();
    setStatus(nanoStatus, 'Фото загружено. Можно обработать через Nano Banana.', 'success');
    setStatus(geminiStatus, 'Фото загружено. Можно обработать через Gemini 3 Pro Image API.', 'success');
    render();
  } catch {
    setStatus(nanoStatus, 'Ошибка чтения файла.', 'error');
    setStatus(geminiStatus, 'Ошибка чтения файла.', 'error');
  }
});

canvas.addEventListener('pointerdown', (event) => {
  const point = screenToCanvas(event.clientX, event.clientY);
  const hit = findElementAtPosition(point.x, point.y);

  if (!hit) {
    selectedElementId = null;
    syncSelectionControls();
    render();
    return;
  }

  selectedElementId = hit.id;
  dragState = { id: hit.id, offsetX: point.x - hit.x, offsetY: point.y - hit.y };
  canvas.setPointerCapture(event.pointerId);
  syncSelectionControls();
  render();
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragState) return;
  const point = screenToCanvas(event.clientX, event.clientY);
  const target = elements.find((item) => item.id === dragState.id);
  if (!target) return;
  target.x = point.x - dragState.offsetX;
  target.y = point.y - dragState.offsetY;
  render();
});

canvas.addEventListener('pointerup', (event) => {
  if (dragState) canvas.releasePointerCapture(event.pointerId);
  dragState = null;
});

canvas.addEventListener('wheel', (event) => {
  const selected = getSelectedElement();
  if (!selected) return;
  event.preventDefault();
  const delta = event.deltaY > 0 ? -0.1 : 0.1;
  selected.scale = Math.min(3, Math.max(0.3, Number((selected.scale + delta).toFixed(2))));
  scaleRange.value = String(selected.scale);
  render();
});

scaleRange.addEventListener('input', () => {
  const selected = getSelectedElement();
  if (!selected) return;
  selected.scale = Number(scaleRange.value);
  render();
});

rotationRange.addEventListener('input', () => {
  const selected = getSelectedElement();
  if (!selected) return;
  selected.rotation = Number(rotationRange.value);
  render();
});

deleteBtn.addEventListener('click', () => {
  if (!selectedElementId) return;
  elements = elements.filter((item) => item.id !== selectedElementId);
  selectedElementId = null;
  syncSelectionControls();
  render();
});

bringFrontBtn.addEventListener('click', () => {
  const selected = getSelectedElement();
  if (!selected) return;
  elements = elements.filter((item) => item.id !== selected.id);
  elements.push(selected);
  render();
});

sendBackBtn.addEventListener('click', () => {
  const selected = getSelectedElement();
  if (!selected) return;
  elements = elements.filter((item) => item.id !== selected.id);
  elements.unshift(selected);
  render();
});

downloadBtn.addEventListener('click', () => {
  if (!backgroundImage) {
    alert('Нет изображения для экспорта.');
    return;
  }
  render();
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = 'landscape-plan.png';
  link.click();
});

resetBtn.addEventListener('click', () => {
  elements = [];
  selectedElementId = null;
  syncSelectionControls();
  render();
});

selectNanoBtn.addEventListener('click', () => setProcessor('nano'));
selectGeminiBtn.addEventListener('click', () => setProcessor('gemini'));
nanoProcessBtn.addEventListener('click', applyNanoBanana);
geminiProcessBtn.addEventListener('click', applyGeminiImage);

restoreConfig();
createPlantButtons();
syncSelectionControls();
setProcessor('nano');
render();
