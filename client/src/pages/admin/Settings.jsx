import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Save, Clock as ClockIcon, MapPin, Link2, CalendarDays, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try { const res = await api.get('/admin/settings'); setSettings(res.data.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setMessage('');
    try { await api.put('/admin/settings', settings); setMessage('saved'); setTimeout(() => setMessage(''), 3000); }
    catch { setMessage('error'); }
    finally { setSaving(false); }
  };

  const updateSetting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure attendance settings</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          {saving ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} />
            : message === 'saved' ? <><CheckCircle2 size={16} /> Saved!</>
            : <><Save size={16} /> Save</>}
        </button>
      </div>

      {message === 'error' && (
        <div className="mb-5 p-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in-up" style={{ background: 'var(--color-danger-surface)', color: 'var(--color-danger)' }}>
          Unable to save settings
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary-100)' }}>
              <ClockIcon size={18} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Attendance Hours</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Time</label>
              <input type="time" value={settings.absen_start_time || '10:00'} onChange={(e) => updateSetting('absen_start_time', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" value={settings.absen_end_time || '17:00'} onChange={(e) => updateSetting('absen_end_time', e.target.value)} className="input" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-surface-hover)' }}>
              <MapPin size={18} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Office Location</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Latitude</label>
              <input type="text" value={settings.office_latitude || ''} onChange={(e) => updateSetting('office_latitude', e.target.value)} className="input" placeholder="-6.2088" />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input type="text" value={settings.office_longitude || ''} onChange={(e) => updateSetting('office_longitude', e.target.value)} className="input" placeholder="106.8456" />
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-surface-hover)' }}>
            <Link2 size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Integrations</h2>
        </div>
        <div className="space-y-2">
          {/* Calendar is connected by each intern from Planner. */}
          <div className="flex items-center justify-between p-3 rounded-xl transition-all hover:bg-surface-hover cursor-default" style={{ background: 'var(--color-bg)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <CalendarDays size={18} style={{ color: 'var(--color-text-muted)' }} className="flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>Google Calendar</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>Interns connect their calendar from Planner</p>
              </div>
            </div>
            <span className="badge flex-shrink-0" style={{ background: 'var(--color-warning-surface)', color: 'var(--color-warning)' }}>Managed in Planner</span>
          </div>

        </div>
      </div>
    </div>
  );
}
