import multer from "multer";
import { httpError } from "./errorHandler.js";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Optional finder photo, kept in memory and re-encoded with sharp before it touches the database
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 20 },
  fileFilter(req, file, cb) {
    if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(httpError(400, "Photo must be a JPEG, PNG or WebP image"));
  },
}).single("photo");
