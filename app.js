// ========== База актёров ==========
// В реальном проекте фото берутся из вашего API/БД.
// Здесь для примера — публичные URL актёров (замените на свои).
const ACTORS = [
  { name: "Райан Гослинг",   photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Ryan_Gosling_by_Gage_Skidmore_%28cropped%29.jpg/400px-Ryan_Gosling_by_Gage_Skidmore_%28cropped%29.jpg" },
  { name: "Скарлетт Йоханссон", photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Scarlett_Johansson_by_Gage_Skidmore_2019_%28cropped%29.jpg/400px-Scarlett_Johansson_by_Gage_Skidmore_2019_%28cropped%29.jpg" },
  { name: "Роберт Дауни мл.", photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Robert_Downey_Jr_2014_Comic_Con_%28cropped%29.jpg/400px-Robert_Downey_Jr_2014_Comic_Con_%28cropped%29.jpg" },
  { name: "Эмма Уотсон",     photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Emma_Watson_2013.jpg/400px-Emma_Watson_2013.jpg" },
  { name: "Киану Ривз",      photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Keanu_Reeves_2019_%28cropped%29.jpg/400px-Keanu_Reeves_2019_%28cropped%29.jpg" },
  { name: "Дженнифер Лоуренс", photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Jennifer_Lawrence_SDCC_2015_XL.jpg/400px-Jennifer_Lawrence_SDCC_2015_XL.jpg" }
];

// ========== DOM ==========
const fileInput  = document.getElementById('fileInput');
const selectBtn  = document.getElementById('selectBtn');
const dropZone   = document.getElementById('dropZone');
const preview    = document.getElementById('preview');
const previewImg = document.getElementById('previewImg');
const resetBtn   = document.getElementById('resetBtn');
const statusEl   = document.getElementById('status');
const resultsEl  = document.getElementById('results');

let actorDescriptors = [];   // эмбеддинги лиц актёров
let modelsLoaded = false;

// ========== Загрузка моделей face-api ==========
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

async function loadModels() {
  statusEl.textContent = 'Загрузка моделей распознавания...';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  modelsLoaded = true;
  statusEl.textContent = '';
}

// ========== Загрузка фото актёров и получение их эмбеддингов ==========
async function loadActorDescriptors() {
  statusEl.textContent = 'Индексация базы актёров...';
  actorDescriptors = [];

  for (const actor of ACTORS) {
    try {
      const img = await faceapi.fetchImage(actor.photo);
      const det = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (det) {
        actorDescriptors.push({
          name: actor.name,
          photo: actor.photo,
          descriptor: det.descriptor
        });
      } else {
        console.warn('Лицо не найдено на фото:', actor.name);
      }
    } catch (e) {
      console.warn('Ошибка загрузки:', actor.name, e);
    }
  }
  statusEl.textContent = '';
}

// ========== Инициализация ==========
(async function init() {
  await loadModels();
  await loadActorDescriptors();
  statusEl.textContent = 'Готово! Загрузите фото.';
})();

// ========== Обработка загрузки фото ==========
selectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

['dragenter','dragover'].forEach(ev =>
  dropZone.addEventListener(ev, e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  })
);
['dragleave','drop'].forEach(ev =>
  dropZone.addEventListener(ev, e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  })
);
dropZone.addEventListener('drop', e => {
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) handleFile(f);
});

resetBtn.addEventListener('click', () => {
  preview.classList.add('hidden');
  dropZone.classList.remove('hidden');
  resultsEl.innerHTML = '';
  statusEl.textContent = '';
  fileInput.value = '';
});

// ========== Основная логика ==========
async function handleFile(file) {
  if (!modelsLoaded) {
    alert('Модели ещё загружаются, подождите...');
    return;
  }

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  dropZone.classList.add('hidden');
  preview.classList.remove('hidden');
  resultsEl.innerHTML = '';
  statusEl.textContent = 'Анализ фото...';

  try {
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      statusEl.textContent = '❌ Лицо не найдено на фото. Попробуйте другое.';
      return;
    }

    // Сравниваем с базой
    const matches = actorDescriptors.map(a => ({
      name: a.name,
      photo: a.photo,
      distance: faceapi.euclideanDistance(detection.descriptor, a.descriptor)
    }));

    matches.sort((a, b) => a.distance - b.distance);

    statusEl.textContent = 'Похожие актёры:';
    renderResults(matches.slice(0, 6));
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Ошибка обработки фото.';
  }
}

function renderResults(matches) {
  resultsEl.innerHTML = '';
  matches.forEach(m => {
    // distance: 0 = идентичны, 0.6+ = разные люди
    const similarity = Math.max(0, Math.round((1 - m.distance / 0.6) * 100));
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${m.photo}" alt="${m.name}" loading="lazy" />
      <div class="name">${m.name}</div>
      <div class="similarity">Сходство: ${similarity}%</div>
    `;
    resultsEl.appendChild(card);
  });
}