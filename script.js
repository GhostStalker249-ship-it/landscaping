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
const nanoApiUrlInput = document.getElementById('nanoApiUrl');
const nanoApiKeyInput = document.getElementById('nanoApiKey');
const nanoPromptInput = document.getElementById('nanoPrompt');
const nanoProcessBtn = document.getElementById('nanoProcessBtn');
const nanoStatus = document.getElementById('nanoStatus');

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

function setNanoStatus(message, type = 'default') {
  nanoStatus.textContent = message;
  nanoStatus.classList.remove('success', 'error');
  if (type === 'success') {
    nanoStatus.classList.add('success');
  }
  if (type === 'error') {
    nanoStatus.classList.add('error');
  }
}

function rememberNanoConfig() {
  localStorage.setItem('nanoApiUrl', nanoApiUrlInput.value.trim());
  localStorage.setItem('nanoApiKey', nanoApiKeyInput.value);
}

function restoreNanoConfig() {
  nanoApiUrlInput.value = localStorage.getItem('nanoApiUrl') ?? '';
  nanoApiKeyInput.value = localStorage.getItem('nanoApiKey') ?? '';
}

function createPlantButtons() {
  plants.forEach((plant) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plant-btn';
    button.innerHTML = `
      <span class="plant-icon">${plant.icon}</span>
      <span class="plant-name">${plant.name}</span>
    `;
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
  const newElement = {
    id,
    icon: plant.icon,
    name: plant.name,
    x: canvas.width / 2,
    y: canvas.height / 2,
    scale: 1,
    rotation: 0,
    baseSize: plant.size,
  };

  elements.push(newElement);
  selectedElementId = id;
  syncSelectionControls();
  render();
}

function loadBackgroundFromDataUrl(dataUrl, fileBlob = null) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      backgroundImage = image;
      backgroundImageBlob = fileBlob;
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
  const disabled = !selected;
  selectionControls.classList.toggle('disabled', disabled);

  if (!selected) {
    scaleRange.value = '1';
    rotationRange.value = '0';
    return;
  }

  scaleRange.value = String(selected.scale);
  rotationRange.value = String(selected.rotation);
}

function getElementBounds(element) {
  const size = element.baseSize * element.scale;
  return {
    width: size * 0.9,
    height: size * 1.1,
  };
}

function screenToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  return { x, y };
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
    const withinX = Math.abs(localX) <= bounds.width / 2;
    const withinY = Math.abs(localY) <= bounds.height / 2;
    if (withinX && withinY) {
      return element;
    }
  }
  return null;
}

function base64ToBlob(base64, mimeType = 'image/png') {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

async function applyNanoBanana() {
  if (!backgroundImage) {
    setNanoStatus('Сначала загрузите фото участка.', 'error');
    return;
  }

  const apiUrl = nanoApiUrlInput.value.trim();
  const apiKey = nanoApiKeyInput.value.trim();
  const prompt = nanoPromptInput.value.trim();

  if (!apiUrl) {
    setNanoStatus('Укажите API URL NanoBanana.', 'error');
    return;
  }

  if (!prompt) {
    setNanoStatus('Добавьте инструкцию обработки (промпт).', 'error');
    return;
  }

  rememberNanoConfig();

  nanoProcessBtn.disabled = true;
  setNanoStatus('Обработка изображения через NanoBanana...', 'default');

  try {
    const sourceBlob = backgroundImageBlob ?? await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!sourceBlob) {
      throw new Error('Не удалось подготовить изображение для отправки.');
    }

    const formData = new FormData();
    formData.append('image', sourceBlob, 'landscape-input.png');
    formData.append('prompt', prompt);
    formData.append('output_format', 'png');

    const headers = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка API (${response.status}): ${errorText || 'без деталей'}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    let resultBlob;

    if (contentType.includes('application/json')) {
      const payload = await response.json();

      if (payload.image_base64) {
        resultBlob = base64ToBlob(payload.image_base64, payload.mime_type ?? 'image/png');
      } else if (payload.image_url) {
        const imageResponse = await fetch(payload.image_url);
        if (!imageResponse.ok) {
          throw new Error('NanoBanana вернул image_url, но изображение недоступно.');
        }
        resultBlob = await imageResponse.blob();
      } else {
        throw new Error('JSON-ответ NanoBanana не содержит image_base64 или image_url.');
      }
    } else {
      resultBlob = await response.blob();
    }

    await loadBackgroundFromBlob(resultBlob);
    render();
    setNanoStatus('Готово: фото успешно обработано через NanoBanana.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    setNanoStatus(
      `Не удалось обработать фото. ${message}. Проверьте CORS, URL и формат API NanoBanana.`,
      'error',
    );
  } finally {
    nanoProcessBtn.disabled = false;
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
    setNanoStatus('Фото загружено. Теперь можно применить NanoBanana или расставлять элементы.', 'success');
    render();
  } catch {
    setNanoStatus('Ошибка чтения файла. Попробуйте другое изображение.', 'error');
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
  dragState = {
    id: hit.id,
    offsetX: point.x - hit.x,
    offsetY: point.y - hit.y,
  };

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
  if (dragState) {
    canvas.releasePointerCapture(event.pointerId);
  }
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

nanoProcessBtn.addEventListener('click', applyNanoBanana);

restoreNanoConfig();
createPlantButtons();
syncSelectionControls();
render();
