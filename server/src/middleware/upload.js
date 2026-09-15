const multer = require('multer');
const { badRequest } = require('../utils/validation');
const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(allowed.includes(file.mimetype) ? null : badRequest('Use JPG, PNG, WEBP or PDF files.'), allowed.includes(file.mimetype)) });
function matchesSignature(file) {
  const b = file.buffer;
  if (file.mimetype === 'image/png') return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (file.mimetype === 'image/jpeg') return b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (file.mimetype === 'image/webp') return b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP';
  return file.mimetype === 'application/pdf' && b.toString('ascii',0,5) === '%PDF-';
}
function single(field, imagesOnly = false) {
  return (req,res,next) => parser.single(field)(req,res,err => {
    if (err) { err.statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400; return next(err); }
    if (req.file && (!matchesSignature(req.file) || (imagesOnly && req.file.mimetype === 'application/pdf'))) return next(badRequest('File content must match an allowed image/document type.'));
    next();
  });
}
module.exports = { single, image: field => single(field, true), matchesSignature };
