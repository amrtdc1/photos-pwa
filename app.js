let db, currentIndex = 0, autoplay = false, intervalId;

document.addEventListener("DOMContentLoaded", async () => {
  await initDB();
  await displayImage(currentIndex);

  document.getElementById("capture-btn").onclick = captureImage;
  document.getElementById("prev-btn").onclick = () => changeSlide(-1);
  document.getElementById("next-btn").onclick = () => changeSlide(1);
  document.getElementById("autoplay-toggle").onchange = (e) => {
    autoplay = e.target.checked;
    autoplay ? startAutoplay() : stopAutoplay();
  };

  registerServiceWorker();
});

function initDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open("photo-db", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("photos", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };
  });
}

async function captureImage() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  const track = stream.getVideoTracks()[0];
  const imageCapture = new ImageCapture(track);
  const blob = await imageCapture.takePhoto();
  track.stop();

  const imgBitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(800, 600);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgBitmap, 0, 0, 800, 600);
  const resizedBlob = await canvas.convertToBlob();

  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result;

    const coords = await getLocation();
    const photo = {
      data: base64,
      timestamp: new Date().toISOString(),
      location: coords
    };

    const tx = db.transaction("photos", "readwrite");
    const store = tx.objectStore("photos");
    const countRequest = store.count();

    countRequest.onsuccess = async () => {
      if (countRequest.result >= 50) {
        showToast();
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const oldest = getAllRequest.result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
          store.delete(oldest.id);
          store.add(photo);
        };
      } else {
        store.add(photo);
      }
      tx.oncomplete = () => displayImage(0);
    };
  };
  reader.readAsDataURL(resizedBlob);
}

function getLocation() {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true }
    );
  });
}

function changeSlide(dir) {
  currentIndex += dir;
  displayImage(currentIndex);
}

function startAutoplay() {
  intervalId = setInterval(() => changeSlide(1), 3000);
}

function stopAutoplay() {
  clearInterval(intervalId);
}

function displayImage(index) {
  return new Promise((resolve) => {
    const tx = db.transaction("photos", "readonly");
    const store = tx.objectStore("photos");
    const req = store.getAll();

    req.onsuccess = () => {
      const photos = req.result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (photos.length === 0) return;

      if (index < 0) index = photos.length - 1;
      if (index >= photos.length) index = 0;
      currentIndex = index;

      const photo = photos[currentIndex];
      const imgHTML = `<img src="${photo.data}" alt="photo" onclick="downloadImage('${photo.data}', '${photo.timestamp}')"/>`;
      document.getElementById("image-container").innerHTML = imgHTML;
      resolve();
    };
  });
}

function downloadImage(dataUrl, timestamp) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `photo_${timestamp}.jpg`;
  a.click();
}

function showToast() {
  const toast = document.getElementById("toast");
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 4000);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
}
