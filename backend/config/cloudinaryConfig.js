const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

const hasCloudinary =
  process.env.CLOUDINARY_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  !process.env.CLOUDINARY_API_KEY.includes("xxxx") &&
  process.env.CLOUDINARY_API_SECRET &&
  !process.env.CLOUDINARY_API_SECRET.includes("xxxx");

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const uploadFileToCloudinary = async (file) => {
  if (!file) throw new Error("No file provided");

  const isVideo = file.mimetype?.startsWith("video");
  const options = {
    resource_type: isVideo ? "video" : "auto",
  };

  if (hasCloudinary) {
    try {
      const uploader = isVideo
        ? cloudinary.uploader.upload_large
        : cloudinary.uploader.upload;

      const result = await new Promise((resolve, reject) => {
        uploader(file.path, options, (error, res) => {
          fs.unlink(file.path, () => {});
          if (error) return reject(error);
          resolve(res);
        });
      });
      return result;
    } catch (err) {
      console.warn("[Cloudinary] Upload failed, falling back to local file storage:", err.message);
    }
  }

  // Local storage fallback for seamless development & offline media
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 8000}`;
  const ext = path.extname(file.originalname || "") || "";
  let finalFileName = file.filename;
  if (ext && !file.filename.endsWith(ext)) {
    finalFileName = `${file.filename}${ext}`;
    const newPath = path.join(path.dirname(file.path), finalFileName);
    try {
      fs.renameSync(file.path, newPath);
    } catch (e) {
      finalFileName = file.filename;
    }
  }

  return {
    secure_url: `${backendUrl}/upload/${finalFileName}`,
    url: `${backendUrl}/upload/${finalFileName}`,
    public_id: finalFileName,
    format: ext.replace(".", "") || "bin",
  };
};

const upload = multer({ dest: "upload/" });
const multerMiddleware = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) return next(err);
    if (req.files && req.files.length > 0) {
      req.file = req.files.find((f) => f.fieldname === "file" || f.fieldname === "media") || req.files[0];
    }
    next();
  });
};

module.exports = {
  uploadFileToCloudinary,
  uploadFileCloudinary: uploadFileToCloudinary,
  multerMiddleware,
};
