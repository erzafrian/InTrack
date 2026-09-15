import api from './client';

export const getLogbookEntries = (params) => api.get('/logbook', { params });
export const createLogbookEntry = (date) => api.post('/logbook', { date });

export const addLogbookTask = (entryId, data) => {
  const formData = new FormData();
  formData.append('timeStart', data.timeStart);
  formData.append('timeEnd', data.timeEnd);
  formData.append('activity', data.activity || '');
  if (data.quantitativeActivity) formData.append('quantitativeActivity', data.quantitativeActivity);
  if (data.qualitativeActivity) formData.append('qualitativeActivity', data.qualitativeActivity);
  if (data.output) formData.append('output', data.output);
  if (data.evidence) formData.append('evidence', data.evidence);
  return api.post(`/logbook/${entryId}/tasks`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const updateLogbookTask = (taskId, data) => api.put(`/logbook/tasks/${taskId}`, data);
export const deleteLogbookTask = (taskId) => api.delete(`/logbook/tasks/${taskId}`);
