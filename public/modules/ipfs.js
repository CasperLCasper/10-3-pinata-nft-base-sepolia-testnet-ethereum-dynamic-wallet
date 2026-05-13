// ============================================ //
// IPFS FUNCTIONS
// ============================================ //

import { apiFetch } from './api.js';
import { showToast, showProgress, setProgress, hideProgress } from './ui.js';
import { PINATA_GATEWAY } from './config.js';
import { UI } from './state.js';

// 🔥 Konvertē WebM uz MP4
async function convertWebMToMP4(webmBlob) {
  // ... tava konvertēšanas loģika ...
}

export async function uploadFileToIPFS(file) {
  // ... tava augšupielādes loģika ...
}

// 🔥 EKSPORTĒ TRŪKSTOŠĀS FUNKCIJAS
export async function uploadImageToIPFS(canvas) {
  showToast('📸 Preparing image...', 'info');
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('Failed to create image')); return; }
      const file = new File([blob], `snapshot_${Date.now()}.png`, { type: 'image/png' });
      try { 
        showToast('Uploading image...', 'info'); 
        resolve(await uploadFileToIPFS(file)); 
      } catch (error) { reject(error); }
    }, 'image/png');
  });
}

export async function uploadMetadataToIPFS(metadata) {
  showToast('📝 Preparing metadata...', 'info');
  
  const response = await apiFetch('/api/uploadMetadataToIPFS', {
    method: 'POST',
    body: JSON.stringify(metadata)
  });
  
  if (!response.ok) throw new Error(`Metadata upload failed: ${response.status}`);
  
  showToast('Metadata uploaded!', 'success');
  return await response.json();
}

export function showIPFSPreview(imageURL, videoURL, metadataURL) {
  if (UI.previewImage) {
    UI.previewImage.innerHTML = '';
    UI.previewVideo.innerHTML = '';
    UI.previewMetadata.innerHTML = '';
    if (imageURL) UI.previewImage.innerHTML = `🖼️ Image: <a href="${PINATA_GATEWAY}${imageURL.cid}" target="_blank">${imageURL.cid.substring(0, 20)}...</a>`;
    if (videoURL) UI.previewVideo.innerHTML = `🎬 Video: <a href="${PINATA_GATEWAY}${videoURL.cid}" target="_blank">${videoURL.cid.substring(0, 20)}...</a>`;
    if (metadataURL) UI.previewMetadata.innerHTML = `📄 Metadata: <a href="${PINATA_GATEWAY}${metadataURL.cid}" target="_blank">${metadataURL.cid.substring(0, 20)}...</a>`;
    if (UI.ipfsPreview) UI.ipfsPreview.style.display = 'block';
    setTimeout(() => { if (UI.ipfsPreview) UI.ipfsPreview.style.display = 'none'; }, 10000);
  }
}

export async function uploadVideoToIPFS(recording) {
  // ... tavs esošais kods ...
}
