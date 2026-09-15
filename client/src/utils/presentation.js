// Translate display labels while preserving the API and database status values.
export function attendanceLabel(status) {
  return { HADIR: 'Present', IZIN: 'On Leave', SAKIT: 'Sick' }[status] || 'Not Checked In';
}
