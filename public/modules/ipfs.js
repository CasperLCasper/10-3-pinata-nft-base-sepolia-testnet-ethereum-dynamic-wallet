// ============================================ //
// VIDEO
// ============================================ //

export async function uploadVideoToIPFS(
  recording
) {

  if (!recording?.blob) {
    throw new Error('No recording blob');
  }

  const {
    blob,
    mimeType
  } = recording;

  console.log(
    'Upload video mime type:',
    mimeType
  );

  let finalFile;

  // ============================================ //
  // SAFARI / NATIVE MP4
  // ============================================ //

  if (mimeType === 'video/mp4') {

    finalFile = new File(
      [blob],
      `video_${Date.now()}.mp4`,
      {
        type: 'video/mp4'
      }
    );

  } else {

    // ============================================ //
    // WEBM -> MP4
    // ============================================ //

    const mp4Blob =
      await convertWebMToMP4(blob);

    finalFile = new File(
      [mp4Blob],
      `video_${Date.now()}.mp4`,
      {
        type: 'video/mp4'
      }
    );
  }

  showToast(
    'Uploading video...',
    'info'
  );

  return await uploadFileToIPFS(
    finalFile
  );
}
