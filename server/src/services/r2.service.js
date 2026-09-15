const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config/env');
const crypto = require('crypto');
const path = require('path');

const s3Client = (config.s3.endpoint && config.s3.accessKeyId) ? new S3Client({
  region: config.s3.region,
  endpoint: config.s3.endpoint,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  forcePathStyle: true,
}) : null;

async function uploadFile(file, folder = 'uploads') {
  if (!s3Client) {
    throw Object.assign(new Error('File storage is not configured'), { statusCode: 503 });
  }

  const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'application/pdf': '.pdf' }[file.mimetype];
  if (!ext) throw Object.assign(new Error('Unsupported file type'), { statusCode: 400 });
  const key = `${folder}/${crypto.randomUUID()}${ext}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: config.s3.bucketName,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  return config.s3.publicUrl
    ? `${config.s3.publicUrl}/${key}`
    : `${config.s3.endpoint}/${config.s3.bucketName}/${key}`;
}

async function deleteFile(url) {
  if (!url || !config.s3.publicUrl || !url.startsWith(config.s3.publicUrl.replace(/\/$/,'') + '/')) return;
  const key = url.slice(config.s3.publicUrl.replace(/\/$/,'').length + 1);
  await s3Client.send(new DeleteObjectCommand({ Bucket: config.s3.bucketName, Key: key }));
}
module.exports = { uploadFile, deleteFile };
