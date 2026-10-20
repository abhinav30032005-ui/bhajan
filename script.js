const DB_NAME = 'MomOfflineYT_DB';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

let db;
let playlist = [];
let currentIndex = 0;
let controlsTimer = null;
let isDraggingScrubber = false;

let tapCount = 0;
let singleTapTimeout = null;

const video = document.getElementById('mainVideo');
const touchSurface = document.getElementById('touchSurface');
const overlay = document.getElementById('controlsOverlay');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const prevTrackBtn = document.getElementById('prevTrackBtn');
const nextTrackBtn = document.getElementById('nextTrackBtn');
const scrubContainer = document.getElementById('scrubContainer');
const scrubProgress = document.getElementById('scrubProgress');
const currentTimeText = document.getElementById('currentTime');
const durationTimeText = document.getElementById('durationTime');
const displayTitle = document.getElementById('displayTitle');
const overlayTitle = document.getElementById('overlayTitle');
const playlistContainer = document.getElementById('playlistContainer');
const fileInput = document.getElementById('fileInput');
const openPickerBtn = document.getElementById('openPickerBtn');
const rippleLeft = document.getElementById('rippleLeft');
const rippleRight = document.getElementById('rippleRight');

function initDB() {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = (e) => {
    const database = e.target.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    }
  };
  request.onsuccess = (e) => {
    db = e.target.result;
    loadVideosFromDB();
  };
}

function loadVideosFromDB() {
  const tx = db.transaction([STORE_NAME], 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();

  req.onsuccess = () => {
    playlist = req.result || [];
    renderPlaylist();
    if (playlist.length > 0) {
      playVideoIndex(0, false);
    }
  };
}

openPickerBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const tx = db.transaction([STORE_NAME], 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  files.forEach(file => {
    store.add({
      name: file.name.replace(/\.[^/.]+$/, ""),
      blob: file,
      date: Date.now()
    });
  });

  tx.oncomplete = () => {
    loadVideosFromDB();
  };
});

function playVideoIndex(index, autoPlay = true) {
  if (!playlist[index]) return;
  currentIndex = index;

  const item = playlist[index];
  const url = URL.createObjectURL(item.blob);
  video.src = url;

  displayTitle.textContent = item.name;
  overlayTitle.textContent = item.name;

  renderPlaylist();

  if (autoPlay) {
    video.play().catch(() => {});
    showControls(5000);
  } else {
    showControlsPermanently();
  }
}

function renderPlaylist() {
  playlistContainer.innerHTML = '';
  if (!playlist.length) {
    playlistContainer.innerHTML = '<div style="color:#777;font-size:13px;padding:10px 0;">No videos loaded yet. Tap "+ Add Videos" above.</div>';
    return;
  }

  playlist.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = `video-card ${idx === currentIndex ? 'active' : ''}`;
    card.innerHTML = `
      <div class="card-thumb">▶</div>
      <div class="card-meta">
        <div class="card-title">${item.name}</div>
        <div class="card-subtitle">Permanent Offline • Video ${idx + 1}</div>
      </div>
    `;
    card.addEventListener('click', () => playVideoIndex(idx, true));
    playlistContainer.appendChild(card);
  });
}

function showControls(timeoutMs = 5000) {
  overlay.classList.remove('hidden');
  clearTimeout(controlsTimer);
  if (!video.paused && !isDraggingScrubber) {
    controlsTimer = setTimeout(() => {
      overlay.classList.add('hidden');
    }, timeoutMs);
  }
}

function showControlsPermanently() {
  overlay.classList.remove('hidden');
  clearTimeout(controlsTimer);
}

function hideControls() {
  if (!video.paused && !isDraggingScrubber) {
    overlay.classList.add('hidden');
    clearTimeout(controlsTimer);
  }
}

function triggerDoubleTapSkip(clientX) {
  const rect = touchSurface.getBoundingClientRect();
  const x = clientX - rect.left;
  const isRight = x > (rect.width / 2);

  if (isRight) {
    video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
    showRipple(rippleRight);
  } else {
    video.currentTime = Math.max(0, video.currentTime - 10);
    showRipple(rippleLeft);
  }
}

function handleTap(clientX) {
  tapCount++;
  if (tapCount === 1) {
    singleTapTimeout = setTimeout(() => {
      tapCount = 0;
      if (overlay.classList.contains('hidden')) {
        showControls(5000);
      } else {
        hideControls();
      }
    }, 260);
  } else if (tapCount === 2) {
    clearTimeout(singleTapTimeout);
    tapCount = 0;
    triggerDoubleTapSkip(clientX);
  }
}

touchSurface.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  handleTap(touch.clientX);
}, { passive: true });

touchSurface.addEventListener('click', (e) => {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  handleTap(e.clientX);
});

overlay.addEventListener('click', (e) => {
  if (e.target.closest('button') || e.target.closest('.scrub-container')) {
    return;
  }
  hideControls();
});

function showRipple(el) {
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 450);
}

playPauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (video.paused) {
    video.play();
    showControls(5000);
  } else {
    video.pause();
    showControlsPermanently();
  }
});

video.addEventListener('play', () => {
  playIcon.style.display = 'none';
  pauseIcon.style.display = 'block';
});

video.addEventListener('pause', () => {
  playIcon.style.display = 'block';
  pauseIcon.style.display = 'none';
  showControlsPermanently();
});

prevTrackBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (currentIndex > 0) playVideoIndex(currentIndex - 1, true);
});

nextTrackBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (currentIndex < playlist.length - 1) playVideoIndex(currentIndex + 1, true);
});

video.addEventListener('ended', () => {
  if (currentIndex < playlist.length - 1) {
    playVideoIndex(currentIndex + 1, true);
  }
});

video.addEventListener('timeupdate', () => {
  if (!video.duration || isDraggingScrubber) return;
  const progress = (video.currentTime / video.duration) * 100;
  scrubProgress.style.width = progress + '%';
  currentTimeText.textContent = formatTime(video.currentTime);
});

video.addEventListener('loadedmetadata', () => {
  durationTimeText.textContent = formatTime(video.duration);
});

function formatTime(sec) {
  if (isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function updateScrubPosition(clientX) {
  if (!video.duration) return;
  const rect = scrubContainer.getBoundingClientRect();
  const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
  const percentage = (offsetX / rect.width) * 100;
  
  scrubProgress.style.width = percentage + '%';
  const targetTime = (offsetX / rect.width) * video.duration;
  currentTimeText.textContent = formatTime(targetTime);
  return targetTime;
}

scrubContainer.addEventListener('touchstart', (e) => {
  e.stopPropagation();
  isDraggingScrubber = true;
  showControlsPermanently();
  const touch = e.touches[0];
  updateScrubPosition(touch.clientX);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (!isDraggingScrubber) return;
  const touch = e.touches[0];
  updateScrubPosition(touch.clientX);
}, { passive: false });

window.addEventListener('touchend', (e) => {
  if (!isDraggingScrubber) return;
  isDraggingScrubber = false;
  const touch = e.changedTouches[0];
  const targetTime = updateScrubPosition(touch.clientX);
  if (targetTime !== undefined) {
    video.currentTime = targetTime;
  }
  showControls(5000);
});

scrubContainer.addEventListener('mousedown', (e) => {
  e.stopPropagation();
  isDraggingScrubber = true;
  showControlsPermanently();
  updateScrubPosition(e.clientX);
});

window.addEventListener('mousemove', (e) => {
  if (!isDraggingScrubber) return;
  updateScrubPosition(e.clientX);
});

window.addEventListener('mouseup', (e) => {
  if (!isDraggingScrubber) return;
  isDraggingScrubber = false;
  const targetTime = updateScrubPosition(e.clientX);
  if (targetTime !== undefined) {
    video.currentTime = targetTime;
  }
  showControls(5000);
});

initDB();
