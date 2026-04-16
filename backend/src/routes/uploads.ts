import path from "node:path";

import { Router } from "express";

import { bookCoversRoot, memberPhotosRoot } from "../config/paths.js";
import { HttpError } from "../lib/errors.js";
import { createImageUpload } from "../lib/uploads.js";

export const uploadsRouter = Router();

const bookUpload = createImageUpload(bookCoversRoot);
const memberUpload = createImageUpload(memberPhotosRoot);

uploadsRouter.post("/book-cover", (req, res, next) => {
  bookUpload.single("file")(req, res, (error) => {
    if (error) {
      next(new HttpError(400, error.message));
      return;
    }

    if (!req.file) {
      next(new HttpError(400, "File is required"));
      return;
    }

    res.status(201).json({
      url: `/uploads/books/${path.basename(req.file.path)}`,
    });
  });
});

uploadsRouter.post("/member-photo", (req, res, next) => {
  memberUpload.single("file")(req, res, (error) => {
    if (error) {
      next(new HttpError(400, error.message));
      return;
    }

    if (!req.file) {
      next(new HttpError(400, "File is required"));
      return;
    }

    res.status(201).json({
      url: `/uploads/members/${path.basename(req.file.path)}`,
    });
  });
});
