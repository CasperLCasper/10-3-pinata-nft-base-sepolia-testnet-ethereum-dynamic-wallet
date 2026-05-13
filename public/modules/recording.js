// ============================================ //
// RECORDING FUNCTIONS
// ============================================ //

import { UI } from './state.js';
import {
  showWarning,
  showToast,
  setProgress,
  hideProgress,
  setButtonLoading,
  updateTokenListUI
} from './ui.js';

import {
  drawFrame,
  animate
} from './visualizer.js';

// ============================================ //
// MIME TYPE DETECTION
// ============================================ //

export function pickSupportedMimeType() {

  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp8',
    'video/webm'
  ];

  for (const candidate of candidates) {

    try {

      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }

    } catch (error) {
      console.warn('Mime type check failed:', error);
    }
  }

  throw new Error(
    'No supported recording format found'
  );
}

// ============================================ //
// CLEANUP
// ============================================ //

export function cleanupRecording(
  app,
  previousShowInfo,
  originalParticles = null
) {

  if (originalParticles) {
    app.particles = originalParticles;
  }

  app.showInfo = previousShowInfo;

  if (
    app.showInfo &&
    UI.tokenListContainer
  ) {
    UI.tokenListContainer.style.display = 'block';
  }
}
