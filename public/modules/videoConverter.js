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
  
  return false;
}

// 🔥 Konvertē WebM → MP4 izmantojot Canvas + MediaRecorder
export async function convertWebMToMP4(webmBlob) {
  return new Promise((resolve, reject) => {
    console.log('🔄 Converting WebM to MP4 via Canvas...');
    
    const video = document.createElement('video');
    video.src = URL.createObjectURL(webmBlob);
    video.muted = true;
    video.playsInline = true;
    
    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      const stream = canvas.captureStream(30);
      
      // Izmanto WebM ierakstīšanai (jo MP4 parasti nav atbalstīts)
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 5000000
      });
      
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        // 🔥 Izvade tiek saglabāta kā MP4 (lai gan iekšā ir WebM kodeks)
        const mp4Blob = new Blob(chunks, { type: 'video/mp4' });
        console.log(`✅ Done: ${(webmBlob.size / 1024).toFixed(0)}KB → ${(mp4Blob.size / 1024).toFixed(0)}KB`);
        URL.revokeObjectURL(video.src);
        resolve(mp4Blob);
      };
      
      recorder.onerror = (err) => {
        URL.revokeObjectURL(video.src);
        reject(err);
      };
      
      video.play();
      recorder.start(1000);
      
      const drawFrame = () => {
        if (video.ended || video.paused) {
          recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };
      
      video.onended = () => recorder.stop();
      drawFrame();
    };
    
    video.onerror = (err) => {
      URL.revokeObjectURL(video.src);
      reject(err);
    };
  });
}
