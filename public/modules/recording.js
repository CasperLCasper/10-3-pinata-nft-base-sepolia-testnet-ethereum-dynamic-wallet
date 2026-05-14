import { uploadVideoToIPFS } from './ipfs.js';
import { showToast } from './ui.js';

/**
 * Uzsāk video ierakstīšanu un tālāku apstrādi.
 * @param {MediaStream} stream - Video straume
 * @param {number} duration - Ieraksta ilgums (ms)
 */
export async function startRecording(stream, duration = 15000) {
    if (!stream) {
        showToast("Nav aktīva video signāla", "error");
        return null;
    }

    try {
        // Visa loģika (Safari vs Chrome) tagad ir iekš uploadVideoToIPFS
        const result = await uploadVideoToIPFS(stream, duration);
        return result;
    } catch (error) {
        console.error("Ieraksta kļūda:", error);
        showToast("Neizdevās ierakstīt video", "error");
        throw error;
    }
}
