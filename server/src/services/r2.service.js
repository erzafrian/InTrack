const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
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
    console.warn('[Storage] Not configured, skipping upload');
    return `https://placeholder.local/${folder}/${file.originalname}`;
  }

  const ext = path.extname(file.originalname);
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

module.exports = { uploadFile };
