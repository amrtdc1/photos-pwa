let db, currentIndex = 0, autoplay = false, intervalId;

document.addEventListener("DOMContentLoaded", async () => {
  await initDB();
  await displayImage(currentIndex);

  document.getElementById("capture-btn").onclick = () => {
  console.log("Capture button clicked!");
  captureImage();
};
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
      db = request.result;  // Fix: use global db
      db.createObjectStore("photos", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };
  });
}

async function captureImage() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();

    // Wait for video to be ready
    await new Promise((resolve) => video.onloadedmetadata = resolve);

    // Capture from video to canvas
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stream.getTracks().forEach(track => track.stop());

    canvas.toBlob(async (blob) => {
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

        countRequest.onsuccess = () => {
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
        };

        tx.oncomplete = () => displayImage(0);
      };
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.8);
  } catch (err) {
    alert("Unable to access camera: " + err.message);
  }
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
      const container = document.getElementById("image-container");
      container.innerHTML = `<img id="photo-img" src="${photo.data}" alt="photo" />`;
      document.getElementById("photo-img").onclick = () => downloadImage(photo.data, photo.timestamp);
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
