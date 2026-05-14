// ============================================ //
// IPFS FUNCTIONS (CLEAN + NFT SAFE VERSION)
// ============================================ //

import { apiFetch } from './api.js';
import { showToast, setProgress } from './ui.js';
import { PINATA_GATEWAY } from './config.js';
import { UI } from './state.js';
import { convertWebMToMP4 } from './videoConverter.js';

/**
 * Show IPFS preview UI
 */
export function showIPFSPreview(imageURL, videoURL, metadataURL) {
  if (!UI.previewImage) return;

  UI.previewImage.innerHTML = '';
  UI.previewVideo.innerHTML = '';
  UI.previewMetadata.innerHTML = '';

  if (imageURL) {
    UI.previewImage.innerHTML = `
      🖼️ Image:
      <a href="${PINATA_GATEWAY}${imageURL.cid}" target="_blank">
        ${imageURL.cid.slice(0, 20)}...
      </a>
    `;
  }

  if (videoURL) {
    UI.previewVideo.innerHTML = `
      🎬 Video:
      <a href="${PINATA_GATEWAY}${videoURL.cid}" target="_blank">
        ${videoURL.cid.slice(0, 20)}...
      </a>
    `;
  }

  if (metadataURL) {
    UI.previewMetadata.innerHTML = `
      📄 Metadata:
      <a href="${PINATA_GATEWAY}${metadataURL.cid}" target="_blank">
        ${metadataURL.cid.slice(0, 20)}...
      </a>
    `;
  }

  UI.ipfsPreview.style.display = 'block';

  setTimeout(() => {
    UI.ipfsPreview.style.display = 'none';
  }, 10000);
}

/**
 * Generic file upload to IPFS (Pinata)
 */
export async function uploadFileToIPFS(file) {
  showToast('Getting upload token...', 'info');

  const tokenRes = await apiFetch('/api/getUploadToken', {
    method: 'POST'
  });

  if (!tokenRes.ok) {
    throw new Error('Failed to get upload token');
  }

  const { token } = await tokenRes.json();

  if (!token) {
    throw new Error('No upload token received');
  }

  showToast('Uploading to IPFS...', 'info');

  const formData = new FormData();

  // IMPORTANT: always preserve filename
  formData.append('file', file, file.name || 'file');

  const uploadRes = await fetch(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    console.error('Pinata error:', err);
    throw new Error('IPFS upload failed');
  }

  const result = await uploadRes.json();

  if (!result.IpfsHash) {
    throw new Error('No IPFS hash returned');
  }

  return {
    success: true,
    cid: result.IpfsHash,
    ipfs: `ipfs://${result.IpfsHash}`
  };
}

/**
 * Upload image (canvas → PNG → IPFS)
 */
export async function uploadImageToIPFS(canvas) {
  showToast('Preparing image...', 'info');

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        return reject(new Error('Canvas export failed'));
      }

      const file = new File(
        [blob],
        `image_${Date.now()}.png`,
        { type: 'image/png' }
      );

      try {
        showToast('Uploading image...', 'info');
        const res = await uploadFileToIPFS(file);
        resolve(res);
      } catch (err) {
        reject(err);
      }
    }, 'image/png');
  });
}

/**
 * Upload metadata JSON to IPFS
 */
export async function uploadMetadataToIPFS(metadata) {
  showToast('Uploading metadata...', 'info');

  const response = await apiFetch('/api/uploadMetadataToIPFS', {
    method: 'POST',
    body: JSON.stringify(metadata)
  });

  if (!response.ok) {
    throw new Error('Metadata upload failed');
  }

  const result = await response.json();

  showToast('Metadata uploaded', 'success');

  return result;
}

/**
 * MAIN VIDEO UPLOAD PIPELINE (FIXED & SIMPLE)
 *
 * IMPORTANT:
 * - ALWAYS record WEBM outside this function
 * - conversion happens ONLY here if needed
 */
export async function uploadVideoToIPFS(stream, duration = 15000) {
  showToast('Starting recording...', 'info');

  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp8'
  });

  const chunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };

  const recordedBlob = await new Promise((resolve, reject) => {
    recorder.onerror = reject;

    recorder.onstop = () => {
      const blob = new Blob(chunks, {
        type: 'video/webm'
      });
      resolve(blob);
    };

    recorder.start(1000);

    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
    }, duration);
  });

  console.log(
    '📹 Recorded WEBM:',
    (recordedBlob.size / 1024 / 1024).toFixed(2),
    'MB'
  );

  let finalFile = recordedBlob;

  // OPTIONAL: convert to MP4 only if ffmpeg exists
  if (convertWebMToMP4) {
    try {
      showToast('Converting to MP4...', 'info');

      const mp4Blob = await convertWebMToMP4(recordedBlob);

      finalFile = new File(
        [mp4Blob],
        `video_${Date.now()}.mp4`,
        { type: 'video/mp4' }
      );

      showToast('Converted to MP4', 'success');
    } catch (err) {
      console.warn('Conversion failed, fallback to WEBM', err);

      finalFile = new File(
        [recordedBlob],
        `video_${Date.now()}.webm`,
        { type: 'video/webm' }
      );
    }
  }

  showToast('Uploading to IPFS...', 'info');

  const result = await uploadFileToIPFS(finalFile);

  showToast('Upload complete!', 'success');

  return result;
}
