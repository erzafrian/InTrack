import api from './client';

export const getAttendances = (params) => api.get('/attendance', { params });

export const submitAttendance = (data) => {
  const formData = new FormData();
  formData.append('date', data.date);
  formData.append('status', data.status);
  if (data.latitude != null) formData.append('latitude', data.latitude);
  if (data.longitude != null) formData.append('longitude', data.longitude);
  if (data.reason) formData.append('reason', data.reason);
  if (data.evidence) formData.append('evidence', data.evidence);
  return api.post('/attendance', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const getAttendanceById = (id) => api.get(`/attendance/${id}`);
export const uploadEvidence = (id, file) => {
  const formData = new FormData();
  formData.append('evidence', file);
  return api.post(`/attendance/${id}/evidence`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};
