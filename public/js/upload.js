/**
 * Getstock — upload page logic.
 * Shows a sign-in prompt for guests; for logged-in users, handles the
 * dropzone, title/description fields, and an XHR upload with a live
 * progress bar, redirecting to the new item's watch page on success.
 */
(async function () {
  const user = await Getstock.initHeader();

  const signedOutNotice = document.getElementById("signedOutNotice");
  const uploadForm = document.getElementById("uploadForm");

  if (!user) {
    signedOutNotice.hidden = false;
    uploadForm.hidden = true;
    return;
  }
  signedOutNotice.hidden = true;
  uploadForm.hidden = false;

  const dropzone = document.getElementById("dropzone");
  const dropzoneLabel = document.getElementById("dropzoneLabel");
  const fileInput = document.getElementById("fileInput");
  const titleInput = document.getElementById("titleInput");
  const descriptionInput = document.getElementById("descriptionInput");
  const progressWrap = document.getElementById("uploadProgressWrap");
  const progressFill = document.getElementById("uploadProgressFill");
  const progressLabel = document.getElementById("uploadProgressLabel");
  const errorEl = document.getElementById("uploadError");
  const submitBtn = document.getElementById("uploadSubmitBtn");

  let selectedFile = null;

  function selectFile(file) {
    selectedFile = file;
    dropzoneLabel.textContent = `${file.name} selected — click to change`;
    if (!titleInput.value.trim()) {
      titleInput.value = file.name.replace(/\.[^/.]+$/, "");
    }
  }

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) selectFile(fileInput.files[0]);
  });

  ["dragover", "dragenter"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
  });

  uploadForm.addEventListener("submit", (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    if (!selectedFile) {
      errorEl.textContent = "Choose an image or video file first.";
      errorEl.hidden = false;
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", titleInput.value.trim() || selectedFile.name);
    formData.append("description", descriptionInput.value.trim());

    submitBtn.disabled = true;
    progressWrap.hidden = false;
    progressFill.style.width = "0%";
    progressLabel.textContent = "0%";

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.addEventListener("progress", (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        progressFill.style.width = `${pct}%`;
        progressLabel.textContent = `${pct}%`;
      }
    });
    xhr.onload = () => {
      submitBtn.disabled = false;
      if (xhr.status >= 200 && xhr.status < 300) {
        const { item } = JSON.parse(xhr.responseText);
        window.location.href = `/watch.html?id=${item.id}`;
      } else {
        let msg = "Upload failed.";
        try {
          msg = JSON.parse(xhr.responseText).error || msg;
        } catch (_) {}
        errorEl.textContent = msg;
        errorEl.hidden = false;
        progressWrap.hidden = true;
      }
    };
    xhr.onerror = () => {
      submitBtn.disabled = false;
      errorEl.textContent = "Network error — is the server running?";
      errorEl.hidden = false;
      progressWrap.hidden = true;
    };
    xhr.send(formData);
  });
})();