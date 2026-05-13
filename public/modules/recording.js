# `public/modules/recording.js`

```js
// ============================================ //
// RECORDING FUNCTIONS
// ============================================ //

import { UI } from './state.js';
import {
  showWarning,
  showToast,
  setProgress,
  hideProgress,
  setButtonLoading,
  updateTokenListUI
} from './ui.js';

import {
  drawFrame,
  animate
} from './visualizer.js';

// ============================================ //
// MIME TYPE DETECTION
// ============================================ //

export function pickSupportedMimeType() {

  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp8',
    'video/webm'
  ];

  for (const candidate of candidates) {

    try {

      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }

    } catch (error) {
      console.warn('Mime type check failed:', error);
    }
  }

  throw new Error(
    'No supported recording format found'
  );
}

// ============================================ //
// CLEANUP
// ============================================ //

export function cleanupRecording(
  app,
  previousShowInfo,
  originalParticles = null
) {

  if (originalParticles) {
    app.particles = originalParticles;
  }

  app.showInfo = previousShowInfo;

  if (
    app.showInfo &&
    UI.tokenListContainer
  ) {
    UI.tokenListContainer.style.display = 'block';
  }

  updateTokenListUI(app.tokens);

  setButtonLoading(UI.recordBtn, false);

  UI.renderBtn.disabled = false;
  UI.connectBtn.disabled = false;
  UI.generateNFTBtn.disabled = false;

  hideProgress();

  UI.recordTimer.textContent =
    'Recording: 0 / 15 s';

  app.isRecording = false;

  showWarning('', false);
}

// ============================================ //
// MAIN RECORDING FUNCTION
// ============================================ //

export async function startRecording(
  app,
  duration = 15000
) {

  if (app.isRecording) {
    throw new Error('Recording already in progress');
  }

  app.isRecording = true;

  showWarning(
    '⚠️ Recording in progress...',
    true
  );

  setButtonLoading(UI.recordBtn, true);

  const previousShowInfo = app.showInfo;

  app.showInfo = false;

  if (UI.tokenListContainer) {
    UI.tokenListContainer.style.display = 'none';
  }

  const originalParticles = app.particles;

  if (
    window.LOW_POWER_MODE &&
    app.particles.length > 40
  ) {
    app.particles = app.particles.slice(0, 40);
  }

  let stream;

  try {

    stream = UI.canvas.captureStream(30);

  } catch (error) {

    showToast(
      'Recording not supported',
      'error'
    );

    cleanupRecording(
      app,
      previousShowInfo,
      originalParticles
    );

    throw error;
  }

  const mimeType = pickSupportedMimeType();

  console.log(
    'Recording MIME type:',
    mimeType
  );

  let recorder;

  try {

    recorder = new MediaRecorder(
      stream,
      { mimeType }
    );

  } catch (error) {

    cleanupRecording(
      app,
      previousShowInfo,
      originalParticles
    );

    throw error;
  }

  const chunks = [];

  let animationFrameId = null;

  function recordAnimation() {

    if (!app.isRecording) return;

    drawFrame(
      app,
      app.frameCount++,
      false
    );

    animationFrameId = requestAnimationFrame(
      recordAnimation
    );
  }

  return new Promise((resolve, reject) => {

    recorder.ondataavailable = (event) => {

      if (
        event.data &&
        event.data.size
      ) {
        chunks.push(event.data);
      }
    };

    recorder.onerror = (error) => {

      console.error(
        'Recorder error:',
        error
      );

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      cleanupRecording(
        app,
        previousShowInfo,
        originalParticles
      );

      reject(error);
    };

    recorder.onstart = () => {

      showToast(
        'Recording started',
        'info'
      );

      recordAnimation();
    };

    recorder.onstop = async () => {

      try {

        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }

        const blob = new Blob(
          chunks,
          { type: mimeType }
        );

        cleanupRecording(
          app,
          previousShowInfo,
          originalParticles
        );

        showToast(
          'Recording finished!',
          'success'
        );

        if (app.animFrameId) {
          cancelAnimationFrame(app.animFrameId);
        }

        animate(app);

        resolve({
          blob,
          mimeType
        });

      } catch (error) {

        cleanupRecording(
          app,
          previousShowInfo,
          originalParticles
        );

        reject(error);
      }
    };

    recorder.start(1000);

    const startTime = performance.now();

    const updateProgressLoop = (timestamp) => {

      const elapsed = timestamp - startTime;

      const progress = Math.min(
        elapsed / duration,
        1
      );

      setProgress(progress * 100);

      const seconds = Math.floor(
        elapsed / 1000
      );

      UI.recordTimer.textContent =
        `Recording: ${seconds} / 15 s`;

      if (elapsed < duration) {

        requestAnimationFrame(
          updateProgressLoop
        );

      } else {

        try {

          if (
            recorder.state === 'recording'
          ) {
            recorder.stop();
          }

        } catch (error) {
          console.error(error);
        }
      }
    };

    requestAnimationFrame(
      updateProgressLoop
    );
  });
}
```

---

# `public/modules/ipfs.js`

```js
// ============================================ //
// IPFS FUNCTIONS
// ============================================ //

import { apiFetch } from './api.js';

import {
  showToast
} from './ui.js';

import {
  PINATA_GATEWAY
} from './config.js';

import {
  UI
} from './state.js';

import {
  FFmpeg
} from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';

import {
  fetchFile,
  toBlobURL
} from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

// ============================================ //
// FFMPEG
// ============================================ //

let ffmpeg = null;

async function loadFFmpeg() {

  if (ffmpeg) {
    return ffmpeg;
  }

  ffmpeg = new FFmpeg();

  const baseURL =
    'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  await ffmpeg.load({

    coreURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.js`,
      'text/javascript'
    ),

    wasmURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.wasm`,
      'application/wasm'
    ),

    workerURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.worker.js`,
      'text/javascript'
    )
  });

  return ffmpeg;
}

// ============================================ //
// WEBM -> MP4
// ============================================ //

async function convertWebMToMP4(webmBlob) {

  showToast(
    'Converting WEBM to MP4...',
    'info'
  );

  const ffmpeg = await loadFFmpeg();

  await ffmpeg.writeFile(
    'input.webm',
    await fetchFile(webmBlob)
  );

  await ffmpeg.exec([

    '-i', 'input.webm',

    '-c:v', 'mpeg4',

    '-q:v', '5',

    '-pix_fmt', 'yuv420p',

    '-movflags', 'faststart',

    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',

    'output.mp4'
  ]);

  const data =
    await ffmpeg.readFile('output.mp4');

  const mp4Blob = new Blob(
    [data.buffer],
    { type: 'video/mp4' }
  );

  await ffmpeg.deleteFile('input.webm');
  await ffmpeg.deleteFile('output.mp4');

  return mp4Blob;
}

// ============================================ //
// PREVIEW
// ============================================ //

export function showIPFSPreview(
  imageURL,
  videoURL,
  metadataURL
) {

  if (!UI.previewImage) return;

  UI.previewImage.innerHTML = '';
  UI.previewVideo.innerHTML = '';
  UI.previewMetadata.innerHTML = '';

  if (imageURL) {

    UI.previewImage.innerHTML =
      `🖼️ Image: <a href="${PINATA_GATEWAY}${imageURL.cid}" target="_blank">${imageURL.cid.substring(0, 20)}...</a>`;
  }

  if (videoURL) {

    UI.previewVideo.innerHTML =
      `🎬 Video: <a href="${PINATA_GATEWAY}${videoURL.cid}" target="_blank">${videoURL.cid.substring(0, 20)}...</a>`;
  }

  if (metadataURL) {

    UI.previewMetadata.innerHTML =
      `📄 Metadata: <a href="${PINATA_GATEWAY}${metadataURL.cid}" target="_blank">${metadataURL.cid.substring(0, 20)}...</a>`;
  }

  if (UI.ipfsPreview) {
    UI.ipfsPreview.style.display = 'block';
  }

  setTimeout(() => {

    if (UI.ipfsPreview) {
      UI.ipfsPreview.style.display = 'none';
    }

  }, 10000);
}

// ============================================ //
// FILE UPLOAD
// ============================================ //

export async function uploadFileToIPFS(file) {

  showToast(
    'Getting upload permission...',
    'info'
  );

  const tokenRes = await apiFetch(
    '/api/getUploadToken',
    {
      method: 'POST'
    }
  );

  if (!tokenRes.ok) {

    const errorText =
      await tokenRes.text();

    console.error(
      'GetUploadToken error:',
      tokenRes.status,
      errorText
    );

    throw new Error(
      `Failed to get upload permission: ${tokenRes.status}`
    );
  }

  const tokenData =
    await tokenRes.json();

  if (!tokenData.token) {
    throw new Error(
      'No token received from server'
    );
  }

  const formData = new FormData();

  formData.append('file', file);

  showToast(
    'Uploading to IPFS...',
    'info'
  );

  const uploadRes = await fetch(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${tokenData.token}`
      },

      body: formData
    }
  );

  if (!uploadRes.ok) {

    const errorText =
      await uploadRes.text();

    console.error(
      'Pinata upload error:',
      errorText
    );

    throw new Error(
      `Pinata upload failed: ${uploadRes.status}`
    );
  }

  const result = await uploadRes.json();

  if (!result.IpfsHash) {
    throw new Error(
      'Upload failed - no IPFS hash'
    );
  }

  console.log(
    'File uploaded:',
    result.IpfsHash
  );

  return {
    success: true,
    ipfs: `ipfs://${result.IpfsHash}`,
    cid: result.IpfsHash
  };
}

// ============================================ //
// METADATA
// ============================================ //

export async function uploadMetadataToIPFS(
  metadata
) {

  showToast(
    'Preparing metadata...',
    'info'
  );

  const response = await apiFetch(
    '/api/uploadMetadataToIPFS',
    {
      method: 'POST',
      body: JSON.stringify(metadata)
    }
  );

  if (!response.ok) {

    throw new Error(
      `Metadata upload failed: ${response.status}`
    );
  }

  showToast(
    'Metadata uploaded!',
    'success'
  );

  return await response.json();
}

// ============================================ //
// IMAGE
// ============================================ //

export async function uploadImageToIPFS(canvas) {

  showToast(
    'Preparing image...',
    'info'
  );

  return new Promise((resolve, reject) => {

    canvas.toBlob(async (blob) => {

      if (!blob) {

        reject(
          new Error(
            'Failed to create image'
          )
        );

        return;
      }

      try {

        const file = new File(
          [blob],
          `snapshot_${Date.now()}.png`,
          { type: 'image/png' }
        );

        resolve(
          await uploadFileToIPFS(file)
        );

      } catch (error) {

        reject(error);
      }

    }, 'image/png');
  });
}

// ============================================ //
// VIDEO
// ============================================ //

export async function uploadVideoToIPFS(
  recording
) {

  if (!recording?.blob) {
    throw new Error('No recording blob');
  }

  const {
    blob,
    mimeType
  } = recording;

  console.log(
    'Upload video mime type:',
    mimeType
  );

  let finalFile;

  // ============================================ //
  // SAFARI / NATIVE MP4
  // ============================================ //

  if (mimeType === 'video/mp4') {

    finalFile = new File(
      [blob],
      `video_${Date.now()}.mp4`,
      {
        type: 'video/mp4'
      }
    );

  } else {

    // ============================================ //
    // WEBM -> MP4
    // ============================================ //

    const mp4Blob =
      await convertWebMToMP4(blob);

    finalFile = new File(
      [mp4Blob],
      `video_${Date.now()}.mp4`,
      {
        type: 'video/mp4'
      }
    );
  }

  showToast(
    'Uploading video...',
    'info'
  );

  return await uploadFileToIPFS(
    finalFile
  );
}
```

---

# `vercel.json`

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

---

# FINAL FLOW

```text
recording.js
    ↓
returns:
{ blob, mimeType }
    ↓
ipfs.js
    ↓
if mp4:
    upload directly

if webm:
    convert -> mp4
    upload
```

Šī ir pareiza browser-side WEBM → MP4 → Pinata IPFS arhitektūra priekš tava projekta.
