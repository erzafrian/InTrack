import { useState, useEffect } from 'react';
import api from '../../api/client';
import { Save, Clock as ClockIcon, MapPin, Link2, Cloud, BookOpen, CalendarDays, CheckCircle2, Unplug, Plug } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [notionStatus, setNotionStatus] = useState({ connected: false, hasDatabaseId: false });
  const [notionLoading, setNotionLoading] = useState(false);
  const [databases, setDatabases] = useState([]);
  const [dataSourceId, setDataSourceId] = useState('');
  const [syncs, setSyncs] = useState([]);
  const [integrationError, setIntegrationError] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchNotionStatus();

    // Check for Notion callback result in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('notion') === 'success') {
      setMessage('notion_connected');
      setTimeout(() => setMessage(''), 4000);
      window.history.replaceState({}, '', window.location.pathname);
      fetchNotionStatus();
    } else if (params.get('notion') === 'error') {
      setMessage('notion_error');
      setTimeout(() => setMessage(''), 4000);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchSettings = async () => {
    try { const res = await api.get('/admin/settings'); setSettings(res.data.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchNotionStatus = async () => {
    try {
      const res = await api.get('/auth/notion/status');
      setNotionStatus(res.data.data);
      setDataSourceId(res.data.data.dataSourceId || '');
      if (res.data.data.connected) {
        const [sources, recent] = await Promise.all([api.get('/auth/notion/databases'), api.get('/auth/notion/syncs')]);
        setDatabases(sources.data.data);
        setSyncs(recent.data.data);
      }
    } catch (err) { setIntegrationError(err.response?.data?.error || 'Unable to load Notion settings'); }
  };

  const saveDatabase = async () => {
    setNotionLoading(true); setIntegrationError('');
    try { await api.put('/auth/notion/database', { dataSourceId }); await fetchNotionStatus(); }
    catch (err) { setIntegrationError(err.response?.data?.error || 'Unable to select database'); }
    finally { setNotionLoading(false); }
  };

  const retrySync = async (attendanceId) => {
    setNotionLoading(true); setIntegrationError('');
    try { await api.post(`/auth/notion/sync/${attendanceId}`); await fetchNotionStatus(); }
    catch (err) { setIntegrationError(err.response?.data?.error || 'Unable to sync attendance'); }
    finally { setNotionLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setMessage('');
    try { await api.put('/admin/settings', settings); setMessage('saved'); setTimeout(() => setMessage(''), 3000); }
    catch { setMessage('error'); }
    finally { setSaving(false); }
  };

  const connectNotion = async () => {
    setNotionLoading(true);
    try {
      const res = await api.get('/auth/notion');
      const url = res.data.data.url;
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setMessage('notion_error');
      setTimeout(() => setMessage(''), 3000);
      setNotionLoading(false);
    }
  };

  const disconnectNotion = async () => {
    setNotionLoading(true);
    try {
      await api.delete('/auth/notion/disconnect');
      setNotionStatus({ connected: false, hasDatabaseId: false });
    } catch (err) { console.error(err); }
    finally { setNotionLoading(false); }
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
      {message === 'notion_connected' && (
        <div className="mb-5 p-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in-up" style={{ background: 'var(--color-success-surface)', color: 'var(--color-success)' }}>
          <CheckCircle2 size={16} /> Notion connected successfully!
        </div>
      )}
      {message === 'notion_error' && (
        <div className="mb-5 p-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in-up" style={{ background: 'var(--color-danger-surface)', color: 'var(--color-danger)' }}>
          Unable to connect Notion. Please try again.
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
          {integrationError && <p role="alert" className="text-sm text-red-400">{integrationError}</p>}
          {notionStatus.connected && <div className="space-y-3 p-3">
            <label className="label" htmlFor="notion-database">Shared attendance database</label>
            <p className="text-xs">Required columns: Name (title), Status (select), Date (date), Distance (number), Reason (text). Share the database with the integration in Notion.</p>
            <select id="notion-database" className="input" value={dataSourceId} onChange={e => setDataSourceId(e.target.value)}>
              <option value="">Select a database</option>
              {databases.map(db => <option key={db.id} value={db.id}>{db.name}</option>)}
            </select>
            <button className="btn btn-primary" disabled={notionLoading || !dataSourceId} onClick={saveDatabase}>Save database</button>
            <button className="btn ml-2" disabled={notionLoading} onClick={fetchNotionStatus}>Refresh</button>
            {notionStatus.hasDatabaseId && <p className="text-xs">Attendance from all interns will sync to this database.</p>}
            {syncs.length > 0 && <div className="space-y-2"><h3 className="text-sm font-semibold">Recent syncs</h3>{syncs.map(sync => <div key={sync.id} className="flex justify-between gap-2 text-xs">
              <span>{sync.entityId.slice(0, 8)}: {sync.status}</span>
              {sync.status === 'failed' && <button className="btn" disabled={notionLoading} onClick={() => retrySync(sync.entityId)}>Retry</button>}
            </div>)}</div>}
          </div>}
          {/* Notion — OAuth Connect */}
          <div className="flex items-center justify-between p-3 rounded-xl transition-all" style={{ background: 'var(--color-bg)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <BookOpen size={18} style={{ color: 'var(--color-text-muted)' }} className="flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>Notion</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>Sync attendance to a Notion database</p>
              </div>
            </div>
            {notionStatus.connected ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="badge" style={{ background: 'var(--color-success-surface)', color: 'var(--color-success)' }}>Connected</span>
                <button onClick={disconnectNotion} disabled={notionLoading} className="btn text-xs px-2 py-1" style={{ background: 'var(--color-danger-surface)', color: 'var(--color-danger)', border: 'none', borderRadius: '0.5rem' }}>
                  <Unplug size={14} />
                </button>
              </div>
            ) : (
              <button onClick={connectNotion} disabled={notionLoading} className="btn text-xs px-3 py-1.5 flex items-center gap-1.5" style={{ background: 'var(--color-primary)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: '0.5rem' }}>
                {notionLoading ? <span className="spinner" style={{ width: '0.75rem', height: '0.75rem', borderWidth: '2px' }} /> : <><Plug size={14} /> Connect</>}
              </button>
            )}
          </div>

          {/* Google Calendar — static */}
          <div className="flex items-center justify-between p-3 rounded-xl transition-all hover:bg-surface-hover cursor-default" style={{ background: 'var(--color-bg)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <CalendarDays size={18} style={{ color: 'var(--color-text-muted)' }} className="flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>Google Calendar</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>Sync planner to Google Calendar</p>
              </div>
            </div>
            <span className="badge flex-shrink-0" style={{ background: 'var(--color-warning-surface)', color: 'var(--color-warning)' }}>Via .env</span>
          </div>

          {/* Cloudflare R2 — static */}
          <div className="flex items-center justify-between p-3 rounded-xl transition-all hover:bg-surface-hover cursor-default" style={{ background: 'var(--color-bg)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <Cloud size={18} style={{ color: 'var(--color-text-muted)' }} className="flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>S3 Storage (Supabase)</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>Evidence file storage</p>
              </div>
            </div>
            <span className="badge flex-shrink-0" style={{ background: 'var(--color-warning-surface)', color: 'var(--color-warning)' }}>Via .env</span>
          </div>
        </div>
      </div>
    </div>
  );
}
