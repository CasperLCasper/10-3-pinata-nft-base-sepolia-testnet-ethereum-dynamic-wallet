// ============================================ //
// IPFS FUNCTIONS
// ============================================ //

import { apiFetch } from './api.js';
import { showToast, showProgress, setProgress, hideProgress } from './ui.js';
import { PINATA_GATEWAY } from './config.js';
import { UI } from './state.js';
import { convertWebMToMP4, isMP4Supported } from './videoConverter.js';

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

export async function uploadFileToIPFS(file) {
  showToast('Getting upload permission...', 'info');
  
  const tokenRes = await apiFetch('/api/getUploadToken', {
    method: 'POST'
  });
  
  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    console.error('GetUploadToken error:', tokenRes.status, errorText);
    throw new Error(`Failed to get upload permission: ${tokenRes.status}`);
  }
  
  const tokenData = await tokenRes.json();
  
  if (!tokenData.token) {
    throw new Error("No token received from server");
  }
  
  showToast('Uploading file to IPFS...', 'info');
  
  const formData = new FormData();
  formData.append('file', file);
  
  const uploadRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenData.token}` },
    body: formData
  });
  
  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    console.error('Pinata upload error:', errorText);
    throw new Error(`Pinata upload failed: ${uploadRes.status}`);
  }
  
  const result = await uploadRes.json();
  if (!result.IpfsHash) throw new Error("Upload failed - no IPFS hash");
  
  console.log("File uploaded:", result.IpfsHash);
  
  return { 
    success: true,
    ipfs: `ipfs://${result.IpfsHash}`,
    cid: result.IpfsHash
  };
}

export async function uploadMetadataToIPFS(metadata) {
  showToast('Preparing metadata...', 'info');
  
  const response = await apiFetch('/api/uploadMetadataToIPFS', {
    method: 'POST',
    body: JSON.stringify(metadata)
  });
  
  if (!response.ok) throw new Error(`Metadata upload failed: ${response.status}`);
  
  showToast('Metadata uploaded!', 'success');
  return await response.json();
}

export async function uploadImageToIPFS(canvas) {
  showToast('Preparing image...', 'info');
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

// 🔥 JAUNĀ VIDEO UPLOAD FUNKCIJA AR MP4 KONVERTĒŠANU
export async function uploadVideoToIPFS(stream, duration = 15000) {
  showToast('Checking video format support...', 'info');
  
  // 1. Pārbauda, vai browseris atbalsta MP4 ierakstīšanu
  const canRecordMP4 = isMP4Supported();
  
  let mimeType, fileExtension;
  
  if (canRecordMP4) {
    // ✅ Browseris spēj ierakstīt MP4 uzreiz
    mimeType = 'video/mp4';
    fileExtension = 'mp4';
    showToast('Recording MP4 directly...', 'info');
  } else {
    // ⚠️ Browseris ieraksta WebM, pēc tam konvertēs uz MP4
    mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
    fileExtension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    showToast(`Recording ${fileExtension.toUpperCase()} (will convert to MP4)...`, 'info');
  }
  
  // 2. Ieraksta video
  const recorder = new MediaRecorder(stream, { 
    mimeType,
    videoBitsPerSecond: 5000000 // 5 Mbps kvalitātei
  });
  
  const chunks = [];
  
  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (e) => { 
      if (e.data && e.data.size) chunks.push(e.data); 
    };
    
    recorder.onstop = async () => {
      try {
        const recordedBlob = new Blob(chunks, { type: mimeType });
        
        let finalFile;
        
        // 3. Ja nepieciešams, konvertē WebM → MP4
        if (!canRecordMP4 && fileExtension === 'webm') {
          showToast('Converting WebM to MP4...', 'info');
          
          try {
            const mp4Blob = await convertWebMToMP4(recordedBlob);
            finalFile = new File([mp4Blob], `video_${Date.now()}.mp4`, { type: 'video/mp4' });
            showToast('Conversion successful!', 'success');
          } catch (conversionError) {
            console.error('Conversion failed:', conversionError);
            // Fallback: sūta oriģinālo WebM
            showToast('Conversion failed, uploading original WebM...', 'warning');
            finalFile = new File([recordedBlob], `video_${Date.now()}.webm`, { type: 'video/webm' });
          }
        } else {
          // MP4 jau ir gatavs
          finalFile = new File([recordedBlob], `video_${Date.now()}.mp4`, { type: 'video/mp4' });
        }
        
        // 4. Augšupielādē failu (viemmēr MP4 vai fallback WebM)
        showToast('Uploading video to IPFS...', 'info');
        const result = await uploadFileToIPFS(finalFile);
        
        console.log(`✅ Video uploaded: ${result.cid} (${finalFile.type})`);
        resolve(result);
        
      } catch (error) {
        console.error('Video processing error:', error);
        reject(error);
      }
    };
    
    recorder.onerror = (err) => reject(err);
    
    // Sāk ierakstīšanu
    recorder.start(1000);
    
    // Aptur pēc norādītā laika
    setTimeout(() => { 
      if (recorder.state === 'recording') recorder.stop(); 
    }, duration);
  });
}
