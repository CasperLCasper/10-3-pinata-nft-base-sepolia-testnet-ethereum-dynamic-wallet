import { apiFetch } from './api.js';
import { showToast } from './ui.js';
import { PINATA_GATEWAY } from './config.js';

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
    const tokenRes = await apiFetch('/api/getUploadToken', { method: 'POST' });
    const tokenData = await tokenRes.json();
    
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
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    showToast(`Ieraksta ${mimeType}...`, 'info');
    
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    return new Promise((resolve) => {
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = async () => {
            const rawBlob = new Blob(chunks, { type: mimeType });

            if (mimeType === 'video/mp4') {
                showToast('Safari MP4 gatavs...', 'success');
                const file = new File([rawBlob], `v_${Date.now()}.mp4`, { type: 'video/mp4' });
                return resolve(await uploadFileToIPFS(file));
            }

            showToast('Konvertē uz MP4...', 'info');
            const ff = await loadFFmpeg();
            await ff.writeFile('in.webm', await fetchFile(rawBlob));
            await ff.exec(['-i', 'in.webm', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', 'out.mp4']);
            const data = await ff.readFile('out.mp4');
            const mp4File = new File([data.buffer], `v_${Date.now()}.mp4`, { type: 'video/mp4' });
            resolve(await uploadFileToIPFS(mp4File));
        };
        recorder.start();
        setTimeout(() => recorder.stop(), duration);
    });
}

export async function uploadImageToIPFS(canvas) {
    return new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
            const file = new File([blob], `img_${Date.now()}.png`, { type: 'image/png' });
            resolve(await uploadFileToIPFS(file));
        }, 'image/png');
    });
}

export async function uploadMetadataToIPFS(metadata) {
    const res = await apiFetch('/api/uploadMetadataToIPFS', {
        method: 'POST',
        body: JSON.stringify(metadata)
    });
    return await res.json();
}
