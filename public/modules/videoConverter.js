// ============================================
// VIDEO CONVERTER - REAL WebM → MP4
// using ffmpeg.wasm (stable, explicit wasmURL)
// ============================================

import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js';

const ffmpeg = new FFmpeg();
let loaded = false;

async function loadFFmpeg() {
  if (loaded) return;

  console.log('⏳ Loading FFmpeg...');

  // 🔥 VIENS AVOTS (jsdelivr), EKSPLICĪTS wasmURL
  await ffmpeg.load({
    coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
    wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
  });

  ffmpeg.on('log', ({ message }) => {
    console.log('FFMPEG:', message);
  });

  loaded = true;
  console.log('✅ FFmpeg loaded');
}

export async function convertWebMToMP4(webmBlob) {
  await loadFFmpeg();

  console.log('🔄 Converting:', (webmBlob.size / 1024).toFixed(0), 'KB');

  await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

  await ffmpeg.exec([
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-movflags', 'faststart',
    '-fflags', '+genpts',
    '-vsync', '0',
    'output.mp4'
  ]);

  const data = await ffmpeg.readFile('output.mp4');
  const mp4Blob = new Blob([data], { type: 'video/mp4' });

  console.log('✅ MP4:', (mp4Blob.size / 1024).toFixed(0), 'KB');
  return mp4Blob;
}
