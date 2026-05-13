// ============================================ //
// RECORDING FUNCTIONS
// ============================================ //

import { UI } from './state.js';
import { showWarning, showToast, showProgress, setProgress, hideProgress, setButtonLoading, updateTokenListUI } from './ui.js';
import { stopAnimation, drawFrame, animate } from './visualizer.js';

export function pickSupportedMimeType() {
  // Prioritāte WEBM (universāls)
  if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return 'video/webm;codecs=vp8';
  if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4';
  return '';
}

export function cleanupRecording(app, previousShowInfo, originalParticles = null) {
  if (originalParticles) app.particles = originalParticles;
  app.showInfo = previousShowInfo;
  if (app.showInfo && UI.tokenListContainer) UI.tokenListContainer.style.display = 'block';
  updateTokenListUI(app.tokens);
  setButtonLoading(UI.recordBtn, false);
  UI.renderBtn.disabled = false;
  UI.connectBtn.disabled = false;
  UI.generateNFTBtn.disabled = false;
  hideProgress();
  UI.recordTimer.textContent = 'Recording: 0 / 15 s';
  app.isRecording = false;
  showWarning('', false);
}

// 🔥 JAUNS: startRecording atgriež Promise ar { blob, mimeType }
export async function startRecording(app) {
  return new Promise(async (resolve, reject) => {
    if (app.isRecording) {
      reject(new Error('Already recording'));
      return;
    }
    
    app.isRecording = true;
    
    showWarning('⚠️ Recording in progress...', true);
    setButtonLoading(UI.recordBtn, true);
    
    const previousShowInfo = app.showInfo;
    app.showInfo = false;
    if (UI.tokenListContainer) UI.tokenListContainer.style.display = 'none';
    
    const originalParticles = app.particles;
    if (window.LOW_POWER_MODE && app.particles.length > 40) {
      app.particles = app.particles.slice(0, 40);
    }
    
    let stream;
    try { 
      stream = UI.canvas.captureStream(30);
    } catch (err) { 
      showToast('Recording not supported', 'error'); 
      cleanupRecording(app, previousShowInfo, originalParticles);
      reject(err);
      return; 
    }
    
    const mimeType = pickSupportedMimeType();
    if (!mimeType) {
      showToast('No supported video codec found', 'error');
      cleanupRecording(app, previousShowInfo, originalParticles);
      reject(new Error('No supported video codec'));
      return;
    }
    
    let recorder;
    try { 
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (err) { 
      alert('Recording not available'); 
      cleanupRecording(app, previousShowInfo, originalParticles); 
      reject(err);
      return; 
    }
    
    const chunks = [];
    let animationFrameId = null;
    
    function recordAnimation() {
      if (!app.isRecording) return;
      drawFrame(app, app.frameCount++, false);
      animationFrameId = requestAnimationFrame(recordAnimation);
    }
    
    recorder.ondataavailable = (e) => { 
      if (e.data && e.data.size) chunks.push(e.data); 
    };
    
    recorder.onerror = (ev) => { 
      console.error(ev); 
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      app.isRecording = false;
      showToast('Recording error', 'error');
      reject(new Error('Recording error'));
    };
    
    recorder.onstart = () => { 
      showToast('Recording...', 'info'); 
      recordAnimation(); 
    };
    
    recorder.start(1000);
    
    const startTime = performance.now();
    const duration = 15000;
    
    const updateProgress = (timestamp) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setProgress(progress * 100);
      const seconds = Math.floor(elapsed / 1000);
      UI.recordTimer.textContent = `Recording: ${seconds} / 15 s`;
      if (elapsed < duration) {
        requestAnimationFrame(updateProgress);
      } else {
        try { 
          if (recorder.state === 'recording') recorder.stop(); 
        } catch (e) {}
      }
    };
    requestAnimationFrame(updateProgress);
    
    recorder.onstop = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      
      const blob = new Blob(chunks, { type: mimeType });
      
      // 🔥 Atjauno stāvokli
      app.particles = originalParticles;
      app.showInfo = previousShowInfo;
      if (app.showInfo && UI.tokenListContainer) UI.tokenListContainer.style.display = 'block';
      updateTokenListUI(app.tokens);
      
      UI.recordTimer.textContent = 'Recording: 0 / 15 s';
      hideProgress();
      setButtonLoading(UI.recordBtn, false);
      UI.renderBtn.disabled = false;
      UI.connectBtn.disabled = false;
      UI.generateNFTBtn.disabled = false;
      app.isRecording = false;
      showWarning('', false);
      
      if (app.animFrameId) cancelAnimationFrame(app.animFrameId);
      animate(app);
      
      // 🔥 ATGRIEŽ blob un mimeType!
      resolve({ blob, mimeType });
    };
    
    recorder.onerror = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      cleanupRecording(app, previousShowInfo, originalParticles);
      reject(new Error('Recording failed'));
    };
  });
}
