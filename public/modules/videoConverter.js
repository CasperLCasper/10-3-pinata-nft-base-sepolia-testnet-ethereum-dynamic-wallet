// ============================================ //
// VIDEO CONVERTER - WebM to MP4 in Browser
// FFmpeg.wasm UMD versija (bez worker/ESM)
// ============================================ //

let ffmpeg = null;
let isFFmpegLoaded = false;

async function initFFmpeg() {
  if (isFFmpegLoaded && ffmpeg) return ffmpeg;
  
  console.log('🔄 Loading FFmpeg.wasm (UMD, no worker)...');
  
  // Ielādē UMD versiju kā script (globāls FFmpeg)
  if (!window.FFmpegWASM) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  const { FFmpeg: FFmpegClass } = window.FFmpegWASM;
  ffmpeg = new FFmpegClass();
  
  await ffmpeg.load({
    coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
    wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
  });
  
  isFFmpegLoaded = true;
  console.log('✅ FFmpeg.wasm loaded (UMD)');
  
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
      console.log(`✅ MP4 supported: ${codec}`);
      return true;
    }
  }
  
  return false;
}

export async function convertWebMToMP4(webmBlob) {
  try {
    console.log('🔄 Converting WebM to MP4...');
    
    const ffmpegInstance = await initFFmpeg();
    
    const inputData = new Uint8Array(await webmBlob.arrayBuffer());
    await ffmpegInstance.writeFile('input.webm', inputData);
    
    await ffmpegInstance.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
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
