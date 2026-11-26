import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { ensurePrivateStorageDirectory } from '../agreements/document-storage.js'

export const offerPdfUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      ensurePrivateStorageDirectory('tmp').then(
        (directory) => callback(null, directory),
        (error) => callback(error),
      )
    },
    filename(_req, _file, callback) {
      callback(null, `${randomUUID()}.upload`)
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (file.mimetype !== 'application/pdf' || !/\.pdf$/i.test(file.originalname)) {
      return callback(Object.assign(new Error('Upload an offer PDF only.'), { statusCode: 400 }))
    }
    return callback(null, true)
  },
}).single('offerPdf')
