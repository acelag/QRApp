import { Router } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

// Use memory storage — no local disk needed
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const router = Router();

router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  // Configure Cloudinary at request time so env vars are always available
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  // Debug: log whether keys are present (remove after confirming it works)
  console.log('Cloudinary config check — cloud_name:', process.env.CLOUDINARY_CLOUD_NAME ? '✓' : '✗ MISSING');
  console.log('Cloudinary config check — api_key:',    process.env.CLOUDINARY_API_KEY    ? '✓' : '✗ MISSING');
  console.log('Cloudinary config check — api_secret:', process.env.CLOUDINARY_API_SECRET ? '✓' : '✗ MISSING');

  try {
    // Upload buffer to Cloudinary
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'qrapp', resource_type: 'image' },
        (error, result) => {
          if (error || !result) reject(error ?? new Error('Upload failed'));
          else resolve(result as { secure_url: string });
        },
      );
      stream.end(req.file!.buffer);
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

export default router;
