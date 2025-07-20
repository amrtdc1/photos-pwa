let stream;
let usingFrontCamera = false;
let currentIndex = 0;
const maxImages = 50;
let db;

//const debug = msg => {
 // document.getElementById('debug-log').textContent = msg;
//};

// Example
//debug('App loaded');

const dbName = 'PhotoGalleryDB';

const initDB = () => {
  const request = indexedDB.open(dbName, 1);
  request.onupgradeneeded = event => {
    db = event.target.result;
    db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
  };
  request.onsuccess = event => {
    db = event.target.result;
    loadImages();
  };
};

const startCamera = async () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  const constraints = {
    video: {
      facingMode: usingFrontCamera ? 'user' : 'environment'
    },
    audio: false
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    const video = document.getElementById('camera');
    video.srcObject = stream;
	 video.style.display = "block";
    video.play();
  } catch (err) {
    alert('Camera access failed: ' + err.message);
  }
};

const switchCamera = () => {
  usingFrontCamera = !usingFrontCamera;
  startCamera();
};

const capturePhoto = () => {
  if (!stream) return;

  const video = document.getElementById('camera');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      savePhoto(base64);
    };
    reader.readAsDataURL(blob);
  }, 'image/jpeg', 0.8);
};

const savePhoto = base64 => {
  const tx = db.transaction('photos', 'readwrite');
  const store = tx.objectStore('photos');

  store.count().onsuccess = e => {
    if (e.target.result >= maxImages) {
      //debug(e.target.result);
		showToast();
      return;
    }

    store.add({
  data: base64,
  timestamp: Date.now()
}).onsuccess = () => {
  // Move index to newest image
  const countRequest = store.count();
  countRequest.onsuccess = () => {
    currentIndex = countRequest.result - 1;
    loadImages();
  };
};
  };
};

const loadImages = () => {
  const tx = db.transaction('photos', 'readonly');
  const store = tx.objectStore('photos');
  const request = store.getAll();

  request.onsuccess = () => {
    const images = request.result;
    if (images.length > 0) {
      displayImage(images[currentIndex] || images[images.length - 1]);
    } else {
      document.getElementById('image-container').innerHTML = '<p>No photos yet</p>';
    }
  };
};

const displayImage = imageObj => {
  if (!imageObj) return;
  document.getElementById('image-container').innerHTML = `
    <img src="${imageObj.data}" alt="Captured Photo" />
    <p>${new Date(imageObj.timestamp).toLocaleString()}</p>
  `;
};

const navigateGallery = direction => {
  const tx = db.transaction('photos', 'readonly');
  const store = tx.objectStore('photos');
  store.getAll().onsuccess = e => {
    const images = e.target.result;
    if (!images.length) return;
    currentIndex = (currentIndex + direction + images.length) % images.length;
    displayImage(images[currentIndex]);
  };
};

const clearGallery = () => {
  const tx = db.transaction('photos', 'readwrite');
  tx.objectStore('photos').clear().onsuccess = () => {
    currentIndex = 0;
    loadImages();
  };
};

const downloadAllImages = () => {
  const tx = db.transaction('photos', 'readonly');
  const store = tx.objectStore('photos');
  store.getAll().onsuccess = e => {
    const images = e.target.result;
    images.forEach((img, i) => {
      const a = document.createElement('a');
      a.href = img.data;
      a.download = `photo_${i + 1}.jpg`;
      a.click();
    });
  };
};

const showToast = () => {
  const toast = document.getElementById('toast');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
};

window.addEventListener('load', () => {
  initDB();
  startCamera();

  document.getElementById('startCameraBtn').addEventListener('click', startCamera);
  document.getElementById('switch-btn').addEventListener('click', switchCamera);
  document.getElementById('capture-btn').addEventListener('click', capturePhoto);
  document.getElementById('prev-btn').addEventListener('click', () => navigateGallery(-1));
  document.getElementById('next-btn').addEventListener('click', () => navigateGallery(1));
  document.getElementById('clear-gallery-btn').addEventListener('click', clearGallery);
  document.getElementById('download-all-btn').addEventListener('click', downloadAllImages);
  document.getElementById('dark-toggle').addEventListener('click', () => {
    document.body.classList.toggle('light');
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
});
