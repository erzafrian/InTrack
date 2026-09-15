import { attendanceLabel } from '../../utils/presentation';
import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Users, CheckCircle2, FileText, Thermometer, HourglassIcon, TrendingUp, MapPin } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ totalInterns: 0, todayHadir: 0, todayIzin: 0, todaySakit: 0, todayBelum: 0 });
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [usersRes, attendanceRes] = await Promise.all([
        api.get('/users', { params: { role: 'INTERN' } }),
        api.get('/attendance', { params: { startDate: today, endDate: today } }),
      ]);
      const internList = usersRes.data.data;
      const todayAttendance = attendanceRes.data.data;
      const h = todayAttendance.filter(a => a.status === 'HADIR').length;
      const iz = todayAttendance.filter(a => a.status === 'IZIN').length;
      const s = todayAttendance.filter(a => a.status === 'SAKIT').length;
      setStats({ totalInterns: internList.length, todayHadir: h, todayIzin: iz, todaySakit: s, todayBelum: internList.length - h - iz - s });
      setInterns(internList.map(intern => {
        const att = todayAttendance.find(a => a.user?.id === intern.id);
        return { ...intern, todayStatus: att?.status || null, distance: att?.distanceKm };
      }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

  const statCards = [
    { label: "Total Interns", value: stats.totalInterns, Icon: Users, color: 'var(--color-primary)', bg: 'var(--color-primary-100)' },
    { label: "Present", value: stats.todayHadir, Icon: CheckCircle2, color: 'var(--color-success)', bg: 'var(--color-success-surface)' },
    { label: "On Leave", value: stats.todayIzin, Icon: FileText, color: 'var(--color-warning)', bg: 'var(--color-warning-surface)' },
    { label: "Sick", value: stats.todaySakit, Icon: Thermometer, color: 'var(--color-danger)', bg: 'var(--color-danger-surface)' },
    { label: "Not Checked In", value: stats.todayBelum, Icon: HourglassIcon, color: 'var(--color-text-muted)', bg: 'var(--color-surface-hover)' },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle flex items-center gap-1.5">
          <TrendingUp size={14} />
          {new Date().toLocaleDateString("en-GB", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 stagger-children">
        {statCards.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="stat-card animate-fade-in-up">
            <div className="stat-icon" style={{ background: bg }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
              <p className="text-xl font-semibold tabular-nums" style={{ color }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Today's Intern Status</h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="hidden sm:table-cell">Email</th>
                <th>Status</th>
                <th className="hidden md:table-cell">Distance</th>
              </tr>
            </thead>
            <tbody>
              {interns.map(intern => (
                <tr key={intern.id}>
                  <td className="font-medium" style={{ color: 'var(--color-text)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-surface-hover border border-border flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                        {intern.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="truncate max-w-[120px] sm:max-w-none">{intern.name}</p>
                        <p className="text-[10px] sm:hidden" style={{ color: 'var(--color-text-muted)' }}>{intern.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell">{intern.email}</td>
                  <td>
                    {intern.todayStatus ? (
                      <span className={`badge ${intern.todayStatus === 'HADIR' ? 'badge-hadir' : intern.todayStatus === 'IZIN' ? 'badge-izin' : 'badge-sakit'}`}>
                        {intern.todayStatus === 'HADIR' ? <CheckCircle2 size={11} /> : intern.todayStatus === 'IZIN' ? <FileText size={11} /> : <Thermometer size={11} />}
                        {attendanceLabel(intern.todayStatus)}
                      </span>
                    ) : <span className="badge" style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}>Not Checked In</span>}
                  </td>
                  <td className="hidden md:table-cell">{intern.distance != null ? <span className="flex items-center gap-1"><MapPin size={12} />{intern.distance} km</span> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
