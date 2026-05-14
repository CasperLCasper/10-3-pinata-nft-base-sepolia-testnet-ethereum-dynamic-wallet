import { uploadVideoToIPFS } from './ipfs.js';
import { showToast } from './ui.js';

export const UI = {
    previewVideo: document.getElementById('previewVideo'),
    // Pievieno citus UI elementus, ja nepieciešams
};

export async function initRecording(stream, duration = 15000) {
    if (!stream) {
        showToast("Nav video straumes!", "error");
        return null;
    }
    return await uploadVideoToIPFS(stream, duration);
}
