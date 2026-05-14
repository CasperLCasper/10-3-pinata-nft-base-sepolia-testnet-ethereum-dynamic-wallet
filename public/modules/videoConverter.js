// ============================================
// VIDEO CONVERTER - WebM → MP4
// Lokālie ffmpeg faili + UMD globālais skripts
// ============================================

let ffmpeg = null;
let loaded = false;

async function loadFFmpeg() {
  if (loaded) return ffmpeg;

  console.log('⏳ Loading FFmpeg.wasm...');

  // 1. Ielādē UMD build KĀ GLOBĀLU SKRIPTU (nav ESM, nav worker)
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const { FFmpeg: FFmpegClass } = window.FFmpegWASM;
  ffmpeg = new FFmpegClass();
  
  // 2. Izmanto TAVUS LOKĀLOS failus
  await ffmpeg.load({
    coreURL: '/ffmpeg/ffmpeg-core.js',
    wasmURL: '/ffmpeg/ffmpeg-core.wasm'
  });

  loaded = true;
  console.log('✅ FFmpeg loaded');
  return ffmpeg;
}

export async function convertWebMToMP4(webmBlob) {
  const ffmpegInstance = await loadFFmpeg();

  console.log('🔄 Converting:', (webmBlob.size / 1024).toFixed(0), 'KB');

  const inputData = new Uint8Array(await webmBlob.arrayBuffer());
  await ffmpegInstance.writeFile('input.webm', inputData);

  await ffmpegInstance.exec([
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-movflags', 'faststart',
    '-fflags', '+genpts',
    '-vsync', '0',
    'output.mp4'
  ]);

  const data = await ffmpegInstance.readFile('output.mp4');
  return new Blob([data], { type: 'video/mp4' });
}
