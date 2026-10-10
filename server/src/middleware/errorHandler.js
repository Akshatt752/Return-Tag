import multer from "multer";

// Throw this from controllers; Express 5 forwards rejected promises to errorHandler
export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Photo is too large (max 5 MB)" : err.message;
    return res.status(400).json({ message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body isn't valid JSON" });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: Object.values(err.errors)[0].message });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid id" });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    const message = field === "email" ? "An account with this email already exists" : "That already exists";
    return res.status(409).json({ message });
  }

  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ message: status === 500 ? "Something went wrong on our side" : err.message });
}
