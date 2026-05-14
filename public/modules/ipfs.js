import { apiFetch } from './api.js';
import { showToast } from './ui.js';
import { PINATA_GATEWAY } from './config.js';
import { UI } from './state.js';

// FFmpeg ielāde no CDN (v0.12.10)
import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

let ffmpeg = null;

async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg;
  ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
  });
  return ffmpeg;
}

export async function uploadFileToIPFS(file) {
  showToast(`Sūta uz Pinata: ${file.name}...`, 'info');
  const tokenRes = await apiFetch('/api/getUploadToken', { method: 'POST' });
  const tokenData = await tokenRes.json();
  
  if (!tokenData.token) throw new Error("Nav Pinata autorizācijas");

  const formData = new FormData();
  formData.append('file', file);

  const uploadRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenData.token}` },
    body: formData
  });

  const result = await uploadRes.json();
  return { 
    success: true, 
    ipfs: `${PINATA_GATEWAY}${result.IpfsHash}`, 
    cid: result.IpfsHash 
  };
}

export async function uploadVideoToIPFS(stream, duration = 15000) {
  // GUDRA FORMĀTA IZVĒLE: Safari māk mp4, pārējie (Chrome) - webm
  const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
  showToast(`Ieraksta ${mimeType}...`, 'info');
  
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];

  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      try {
        const rawBlob = new Blob(chunks, { type: mimeType });

        // JA PĀRLŪKS JAU IERAKSTĪJA MP4 (Safari gadījums)
        if (mimeType === 'video/mp4') {
          showToast('Safari MP4 gatavs, augšupielādē...', 'success');
          const file = new File([rawBlob], `video_${Date.now()}.mp4`, { type: 'video/mp4' });
          return resolve(await uploadFileToIPFS(file));
        }

        // JA PĀRLŪKS IERAKSTĪJA WEBM (Chrome gadījums) - KONVERTĒJAM
        showToast('Konvertē WebM -> MP4...', 'info');
        const ffmpegInstance = await loadFFmpeg();
        await ffmpegInstance.writeFile('input.webm', await fetchFile(rawBlob));
        
        await ffmpegInstance.exec([
          '-i', 'input.webm',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
          'output.mp4'
        ]);

        const data = await ffmpegInstance.readFile('output.mp4');
        const mp4File = new File([data.buffer], `video_${Date.now()}.mp4`, { type: 'video/mp4' });
        resolve(await uploadFileToIPFS(mp4File));

      } catch (err) {
        console.error("Video apstrādes kļūda:", err);
        showToast("Kļūda, augšupielādē oriģinālu", "warning");
        resolve(await uploadFileToIPFS(new File([new Blob(chunks)], 'video.webm', { type: mimeType })));
      }
    };
    recorder.start();
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, duration);
  });
}

export async function uploadImageToIPFS(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      try {
        const file = new File([blob], `snap_${Date.now()}.png`, { type: 'image/png' });
        resolve(await uploadFileToIPFS(file));
      } catch (err) { reject(err); }
    }, 'image/png');
  });
}

export async function uploadMetadataToIPFS(metadata) {
  const response = await apiFetch('/api/uploadMetadataToIPFS', {
    method: 'POST',
    body: JSON.stringify(metadata)
  });
  return await response.json();
}
