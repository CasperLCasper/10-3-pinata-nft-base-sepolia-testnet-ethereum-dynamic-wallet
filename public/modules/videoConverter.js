// ============================================ //
// VIDEO CONVERTER - WebM to MP4 via Canvas
// BEZ FFMPEG! Tikai browsera iebūvētie API
// ============================================ //

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
  
  console.log('⚠️ MP4 recording not supported, will use WebM + convert');
  return false;
}

// 🔥 Konvertē WebM → MP4 izmantojot Canvas + MediaRecorder
export async function convertWebMToMP4(webmBlob) {
  console.log('🔄 convertWebMToMP4 called, blob size:', (webmBlob.size / 1024).toFixed(0), 'KB');
  
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(webmBlob);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    
    video.onloadedmetadata = () => {
      console.log('📹 Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      const stream = canvas.captureStream(30);
      
      // 🔥 VISPIRMS MĒĢINA MP4, TAD VIENKĀRŠU WEBM
      let mimeType;
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else {
        mimeType = 'video/webm';  // vienkāršs, bez codecs
      }
      
      console.log('🎬 Recording with mimeType:', mimeType);
      
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 5000000
      });
      
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const outputBlob = new Blob(chunks, { type: 'video/mp4' });
        console.log('✅ Conversion done! Output size:', (outputBlob.size / 1024).toFixed(0), 'KB');
        console.log('✅ Output type:', outputBlob.type);
        URL.revokeObjectURL(video.src);
        resolve(outputBlob);
      };
      
      recorder.onerror = (err) => {
        console.error('❌ Recorder error:', err);
        URL.revokeObjectURL(video.src);
        reject(err);
      };
      
      video.play().then(() => {
        console.log('▶️ Video playing');
        recorder.start(1000);
        
        const drawFrame = () => {
          if (video.ended || video.paused) {
            console.log('⏹️ Video ended, stopping recorder');
            recorder.stop();
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawFrame);
        };
        
        drawFrame();
      }).catch(err => {
        console.error('❌ Video play failed:', err);
        URL.revokeObjectURL(video.src);
        reject(err);
      });
      
      video.onended = () => {
        console.log('📼 Video onended fired');
        if (recorder.state === 'recording') recorder.stop();
      };
    };
    
    video.onerror = (err) => {
      console.error('❌ Video load error:', err);
      URL.revokeObjectURL(video.src);
      reject(err);
    };
  });
}
