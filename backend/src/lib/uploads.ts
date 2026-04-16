import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import multer from "multer";

export function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createStorage(targetDir: string) {
  ensureDir(targetDir);

  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
}

export function createImageUpload(targetDir: string) {
  return multer({
    storage: createStorage(targetDir),
    limits: {
      fileSize: 8 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
        return;
      }

      cb(new Error("Only image uploads are supported"));
    },
  });
}
