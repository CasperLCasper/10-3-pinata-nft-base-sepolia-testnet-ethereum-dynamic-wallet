import { PinataSDK } from 'pinata';
import formidable from 'formidable';
import fs from 'fs';

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

// ============================================ //
// CONFIG
// ============================================ //

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/webm'
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

// svarīgi priekš Vercel / Next.js
export const config = {
  api: {
    bodyParser: false
  }
};

// ============================================ //
// HANDLER
// ============================================ //

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {

    // ============================================ //
    // PARSE FORM DATA (SAFE WAY)
    // ============================================ //

    const form = formidable({
      maxFileSize: MAX_SIZE,
      keepExtensions: true
    });

    const [fields, files] = await form.parse(req);

    const file = files.file?.[0] || files.file;

    if (!file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }

    // ============================================ //
    // VALIDATION
    // ============================================ //

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return res.status(400).json({
        error: `File type not allowed: ${file.mimetype}. Allowed: ${ALLOWED_TYPES.join(', ')}`
      });
    }

    const buffer = fs.readFileSync(file.filepath);

    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({
        error: `File too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB. Max: 50MB`
      });
    }

    // ============================================ //
    // CREATE FILE FOR PINATA
    // ============================================ //

    const finalFile = new File(
      [buffer],
      file.originalFilename || 'upload',
      { type: file.mimetype }
    );

    // ============================================ //
    // UPLOAD TO PINATA
    // ============================================ //

    const result =
      await pinata.upload.public.file(finalFile);

    // cleanup temp file
    fs.unlinkSync(file.filepath);

    console.log(
      `Uploaded: ${file.originalFilename},`,
      `type: ${file.mimetype},`,
      `size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB,`,
      `cid: ${result.cid}`
    );

    // ============================================ //
    // RESPONSE
    // ============================================ //

    return res.status(200).json({
      success: true,
      ipfs: `ipfs://${result.cid}`,
      http: `https://gateway.pinata.cloud/ipfs/${result.cid}`,
      cid: result.cid
    });

  } catch (error) {

    console.error('Upload error:', error);

    return res.status(500).json({
      error: error.message
    });
  }
}
