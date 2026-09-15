import { attendanceLabel } from '../../utils/presentation';
import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Filter, CheckCircle2, FileText, Thermometer, MapPin, Clock, Unlock, Lock } from 'lucide-react';

export default function AttendanceView() {
  const { user } = useAuth();
  const [interns, setInterns] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState('');
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reopenedDates, setReopenedDates] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: '2026-02-23',
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => { api.get('/users', { params: { role: 'INTERN' } }).then(res => setInterns(res.data.data)); }, []);
  useEffect(() => { fetchAttendances(); }, [selectedIntern, dateRange]);
  useEffect(() => { fetchReopenedDates(); }, []);

  const fetchReopenedDates = async () => {
    try { const res = await api.get('/admin/attendance/reopened'); setReopenedDates(res.data.data); } catch {}
  };

  const fetchAttendances = async () => {
    setLoading(true);
    try {
      const params = { ...dateRange };
      if (selectedIntern) params.targetUserId = selectedIntern;
      const res = await api.get('/attendance', { params });
      setAttendances(res.data.data);
    } catch {} finally { setLoading(false); }
  };

  const handleReopen = async (dateStr) => {
    try {
      await api.post('/admin/attendance/reopen', { date: dateStr });
      fetchReopenedDates();
    } catch {}
  };

  const handleClose = async (dateStr) => {
    try {
      await api.delete('/admin/attendance/reopen', { data: { date: dateStr } });
      fetchReopenedDates();
    } catch {}
  };

  const handleBulkReopen = async () => {
    const workdays = getWorkdays();
    const closedDates = workdays.filter(d => !reopenedDates.includes(d));
    if (closedDates.length === 0) return;
    try {
      await api.post('/admin/attendance/reopen-bulk', { dates: closedDates });
      fetchReopenedDates();
    } catch {}
  };

  const handleBulkClose = async () => {
    const workdays = getWorkdays();
    const openDates = workdays.filter(d => reopenedDates.includes(d));
    if (openDates.length === 0) return;
    try {
      await api.post('/admin/attendance/close-bulk', { dates: openDates });
      fetchReopenedDates();
    } catch {}
  };

  const isAdmin = user?.role === 'SUPERUSER';
  const todayStr = new Date().toISOString().split('T')[0];

  // Generate list of workdays in the date range for the reopen feature
  const getWorkdays = () => {
    const days = [];
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const d = new Date(start);
    while (d <= end) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) {
        const ds = d.toISOString().split('T')[0];
        if (ds <= todayStr) days.push(ds);
      }
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1 className="page-title">Intern Attendance</h1>
        <p className="page-subtitle">View attendance history for all interns</p>
      </div>

      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Filter</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Intern</label>
            <select value={selectedIntern} onChange={(e) => setSelectedIntern(e.target.value)} className="input">
              <option value="">All Interns</option>
              {interns.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange(p => ({ ...p, startDate: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange(p => ({ ...p, endDate: e.target.value }))} className="input" />
          </div>
        </div>
      </div>

      {/* Reopen panel for admin */}
      {isAdmin && (
        <div className="card mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Unlock size={14} style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Reopen Attendance</span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleBulkReopen}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer hover:shadow-panel-hover"
                style={{ background: 'var(--color-success-surface)', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
              >
                <Unlock size={12} /> Open All
              </button>
              <button onClick={handleBulkClose}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer hover:shadow-panel-hover"
                style={{ background: 'var(--color-danger-surface)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
              >
                <Lock size={12} /> Close All
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {getWorkdays().map(ds => {
              const isOpen = reopenedDates.includes(ds);
              return (
                <button key={ds} onClick={() => isOpen ? handleClose(ds) : handleReopen(ds)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer"
                  style={isOpen
                    ? { background: 'var(--color-success-surface)', borderColor: 'var(--color-success)', color: 'var(--color-success)' }
                    : { background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                  }
                >
                  {isOpen ? <Unlock size={11} /> : <Lock size={11} />}
                  {new Date(ds + 'T00:00:00').toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })}
                  {isOpen && <span className="text-[9px] font-semibold">OPEN</span>}
                </button>
              );
            })}
            {getWorkdays().length === 0 && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No past dates in this range</span>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th className="hidden sm:table-cell">Check-in</th>
                  <th className="hidden md:table-cell">Distance</th>
                  <th className="hidden lg:table-cell">Reason</th>
                </tr>
              </thead>
              <tbody>
                {attendances.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No data available</td></tr>
                ) : attendances.map(a => (
                  <tr key={a.id}>
                    <td style={{ color: 'var(--color-text)' }}>{new Date(a.date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })}</td>
                    <td className="font-medium" style={{ color: 'var(--color-text)' }}>{a.user?.name}</td>
                    <td>
                      <span className={`badge ${a.status === 'HADIR' ? 'badge-hadir' : a.status === 'IZIN' ? 'badge-izin' : 'badge-sakit'}`}>
                        {a.status === 'HADIR' ? <CheckCircle2 size={11} /> : a.status === 'IZIN' ? <FileText size={11} /> : <Thermometer size={11} />}
                        {attendanceLabel(a.status)}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell">
                      {a.checkInTime ? <span className="flex items-center gap-1"><Clock size={12} />{new Date(a.checkInTime).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' })}</span> : '-'}
                    </td>
                    <td className="hidden md:table-cell">{a.distanceKm != null ? <span className="flex items-center gap-1"><MapPin size={12} />{a.distanceKm} km</span> : '-'}</td>
                    <td className="hidden lg:table-cell">{a.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
