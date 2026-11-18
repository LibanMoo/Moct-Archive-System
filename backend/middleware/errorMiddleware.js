export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, _req, res, _next) {
  console.error(err);
  if (err.name === "MulterError") {
    return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "File exceeds the upload size limit." : err.message });
  }
  res.status(err.status || 500).json({ message: err.message || "Internal server error." });
}
