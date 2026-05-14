// ============================================ //
// VIDEO CONVERTER - WebM to MP4 in Browser
// Izmanto FFmpeg.wasm WebAssembly
// ============================================ //

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;
let isFFmpegLoaded = false;

// 🔥 Inicializē FFmpeg (vienreiz)
async function initFFmpeg() {
  if (isFFmpegLoaded && ffmpeg) return ffmpeg;
  
  console.log('🔄 Loading FFmpeg.wasm...');
  
  ffmpeg = new FFmpeg();
  
  // 🔥 .js un .worker.js no TAVA domēna, .wasm no CDN (jo pārāk liels GitHub)
  await ffmpeg.load({
    coreURL: await toBlobURL('/ffmpeg-core/ffmpeg-core.js', 'text/javascript'),
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
    workerURL: '/ffmpeg-core/ffmpeg-core.worker.js'
  });
  
  isFFmpegLoaded = true;
  console.log('✅ FFmpeg.wasm loaded successfully');
  
  return ffmpeg;
}

// 🔥 Pārbauda, vai browseris spēj ierakstīt MP4
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
  
  console.log('⚠️ MP4 recording not supported, will use WebM');
  return false;
}

// 🔥 Konvertē WebM → MP4
export async function convertWebMToMP4(webmBlob) {
  try {
    console.log('🔄 Starting WebM to MP4 conversion...');
    console.log(`📦 Input WebM size: ${(webmBlob.size / 1024 / 1024).toFixed(2)}MB`);
    
    const ffmpegInstance = await initFFmpeg();
    
    // Ieraksta WebM failu FFmpeg virtuālajā failu sistēmā
    await ffmpegInstance.writeFile('input.webm', await fetchFile(webmBlob));
    
    // Izpilda konvertāciju
    await ffmpegInstance.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',         // H.264 video kodeks
      '-preset', 'fast',          // Ātrums (fast = labs balanss)
      '-crf', '23',               // Kvalitāte (mazāks = labāka, 18-28)
      '-c:a', 'aac',              // AAC audio kodeks
      '-b:a', '128k',             // Audio bitrate
      '-movflags', '+faststart',  // Ātrai atskaņošanai web
      '-y',                        // Pārraksta, ja eksistē
      'output.mp4'
    ]);
    
    // Izlasa rezultātu
    const data = await ffmpegInstance.readFile('output.mp4');
    
    // Notīra pagaidu failus
    await ffmpegInstance.deleteFile('input.webm');
    await ffmpegInstance.deleteFile('output.mp4');
    
    const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
    
    console.log(`✅ Conversion complete: ${(webmBlob.size / 1024).toFixed(1)}KB → ${(mp4Blob.size / 1024).toFixed(1)}KB`);
    
    return mp4Blob;
    
  } catch (error) {
    console.error('❌ FFmpeg conversion error:', error);
    throw new Error('Video conversion failed. Please try a different browser or format.');
  }
}
