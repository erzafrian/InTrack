import api from './client';

export const enrollFace = (photo, label) => {
  const formData = new FormData();
  formData.append('photo', photo);
  formData.append('label', label);
  return api.post('/face/enroll', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const verifyFace = (photo) => {
  const formData = new FormData();
  formData.append('photo', photo);
  return api.post('/face/verify', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const getFaceStatus = () => api.get('/face/status');

export const resetFaceEnrollment = (userId) => api.delete(`/face/enroll/${userId}`);
