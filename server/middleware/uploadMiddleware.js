const multer = require('multer');
const crypto = require('crypto');

// Memory storage for direct in-memory verification and streaming
const storage = multer.memoryStorage();

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/m4a',
  'audio/aac',
  // Documents
  'application/pdf',
  'text/plain'
];

/**
 * Sniff magic bytes from file buffer to verify true content type
 */
const verifyBufferSignature = (buffer, mimetype) => {
  if (!buffer || buffer.length < 4) return false;

  const hexHeader = buffer.slice(0, 12).toString('hex').toUpperCase();

  // JPEG: FF D8 FF
  if (mimetype === 'image/jpeg') {
    return hexHeader.startsWith('FFD8FF');
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimetype === 'image/png') {
    return hexHeader.startsWith('89504E47');
  }

  // GIF: 47 49 46 38 (GIF87a / GIF89a)
  if (mimetype === 'image/gif') {
    return hexHeader.startsWith('47494638');
  }

  // WebP: RIFF .... WEBP
  if (mimetype === 'image/webp') {
    const textHeader = buffer.slice(0, 12).toString('utf-8');
    return textHeader.startsWith('RIFF') && textHeader.includes('WEBP');
  }

  // PDF: %PDF- (25 50 44 46)
  if (mimetype === 'application/pdf') {
    return hexHeader.startsWith('25504446');
  }

  // MP4 / MOV: ftyp box
  if (mimetype === 'video/mp4' || mimetype === 'video/quicktime') {
    const textHeader = buffer.slice(4, 12).toString('utf-8');
    return textHeader.includes('ftyp') || textHeader.includes('moov');
  }

  // WebM / Matroska: 1A 45 DF A3
  if (mimetype === 'video/webm' || mimetype === 'audio/webm') {
    return hexHeader.startsWith('1A45DFA3');
  }

  // MP3: ID3 or FF FB / FF F3 / FF F2
  if (mimetype === 'audio/mpeg' || mimetype === 'audio/mp3') {
    return hexHeader.startsWith('494433') || hexHeader.startsWith('FFFB') || hexHeader.startsWith('FFF3');
  }

  // SVG: Must be XML and NOT contain malicious scripts/event handlers
  if (mimetype === 'image/svg+xml') {
    const content = buffer.toString('utf-8');
    const hasScript = /<script\b/i.test(content) ||
      /on\w+\s*=/i.test(content) ||
      /javascript\s*:/i.test(content) ||
      /<foreignObject\b/i.test(content);
    if (hasScript) {
      return false;
    }
    return content.includes('<svg') || content.includes('<?xml');
  }

  // Plain text
  if (mimetype === 'text/plain') {
    return true;
  }

  // Default allow if covered by general MIME checks
  return true;
};

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        `Invalid file format: ${file.mimetype}. Allowed types: image, video, audio, pdf.`
      ),
      false
    );
  }

  // Sanitize filename to prevent directory traversal or script execution
  const ext = file.originalname ? file.originalname.split('.').pop().toLowerCase() : 'bin';
  const blockedExts = ['exe', 'bat', 'sh', 'cmd', 'js', 'vbs', 'scr', 'pif', 'php', 'py', 'pl'];
  if (blockedExts.includes(ext)) {
    return cb(new Error('Executable or script files are strictly blocked for security.'), false);
  }

  file.secureFilename = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max upload
  },
  fileFilter
});

/**
 * Middleware: Post-upload deep buffer verification
 */
const verifyUploadedFile = (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);

  for (const file of files) {
    if (file.buffer) {
      const isValid = verifyBufferSignature(file.buffer, file.mimetype);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: `Security validation failed: File content does not match reported MIME type ${file.mimetype}.`
        });
      }
    }
  }

  next();
};

module.exports = {
  upload,
  verifyUploadedFile,
  verifyBufferSignature
};
