// ============================================ //
// VIDEO CONVERTER - WebM to MP4 in Browser
// FFmpeg.wasm BEZ worker (single-thread)
// ============================================ //

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg = null;
let isFFmpegLoaded = false;

async function initFFmpeg() {
  if (isFFmpegLoaded && ffmpeg) return ffmpeg;
  
  console.log('🔄 Loading FFmpeg.wasm (single-thread)...');
  
  ffmpeg = new FFmpeg();
  
  // 🔥 IZMANTO TIKAI CDN, BEZ WORKER (single-thread režīms)
  // Nenorāda workerURL — FFmpeg strādās galvenajā threadā
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm'
    // ❌ NAV workerURL — tas novērš CORS kļūdu!
  });
  
  isFFmpegLoaded = true;
  console.log('✅ FFmpeg.wasm loaded (single-thread mode)');
  
  return ffmpeg;
}

export function isMP4Supported() {
  const mp4Codecs = [
    'video/mp4;codecs=h264',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1.4d002a',
    'video/mp4',
    'video/mp4;codecs=vp9',
    'video/mp4;codecs=vp8'
  ];
  
  for (const codec of mp4Codecs) {
    if (MediaRecorder.isTypeSupported(codec)) {
      console.log(`✅ MP4 supported with codec: ${codec}`);
      return true;
    }
  }
  
  console.log('⚠️ MP4 recording not supported, will use WebM + convert');
  return false;
}

export async function convertWebMToMP4(webmBlob) {
  try {
    console.log('🔄 Converting WebM to MP4...');
    console.log(`📦 Input size: ${(webmBlob.size / 1024 / 1024).toFixed(2)}MB`);
    
    const ffmpegInstance = await initFFmpeg();
    
    await ffmpegInstance.writeFile('input.webm', await fetchFile(webmBlob));
    
    await ffmpegInstance.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',    // Ātrāk (single-thread)
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      'output.mp4'
    ]);
    
    const data = await ffmpegInstance.readFile('output.mp4');
    await ffmpegInstance.deleteFile('input.webm');
    await ffmpegInstance.deleteFile('output.mp4');
    
    const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
    
    console.log(`✅ Done: ${(webmBlob.size / 1024).toFixed(0)}KB → ${(mp4Blob.size / 1024).toFixed(0)}KB`);
    
    return mp4Blob;
    
  } catch (error) {
    console.error('❌ Conversion error:', error);
    throw new Error('Video conversion failed. Please try again.');
  }
}
