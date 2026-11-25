import multer from 'multer'

export const uploadCandidateResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (file.mimetype !== 'application/pdf' || !/\.pdf$/i.test(file.originalname)) {
      return callback(Object.assign(new Error('Upload a PDF resume only.'), { statusCode: 400 }))
    }
    return callback(null, true)
  },
}).single('resume')