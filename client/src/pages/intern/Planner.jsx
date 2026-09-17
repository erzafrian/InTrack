import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPlannerEvents, createPlannerEvent, deletePlannerEvent, syncPlannerEvent, getGoogleStatus, getGoogleAuthUrl, disconnectGoogle } from '../../api/planner';
import Modal from '../../components/Modal';
import { toLocalDateKey, fromLocalDateKey, shiftCalendarMonth } from '../../utils/calendarDate';
import { Plus, Trash2, ChevronLeft, ChevronRight, CalendarDays, Clock, Link2, Unlink, CheckCircle2, ExternalLink } from 'lucide-react';

function GoogleIcon({ size = 16, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...props}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function Planner() {
  const [events, setEvents] = useState([]);
  const [pageError, setPageError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: '', startDate: '', startTime: '10:00', endDate: '', endTime: '17:00', allDay: false, description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [syncingEvent, setSyncingEvent] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => { fetchEvents(); checkGoogleStatus(); }, []);

  // Handle "?google=connected" from OAuth callback
  useEffect(() => {
    const g = searchParams.get('google');
    if (g === 'connected') {
      setGoogleConnected(true);
      setSearchParams({}, { replace: true });
    } else if (g === 'error') {
      setPageError('Calendar authorization failed. Please connect again.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchEvents = async () => {
    try { const res = await getPlannerEvents(); setEvents(res.data.data); }
    catch (err) { setPageError(err.response?.data?.error || 'Unable to load or update planner. Please try again.'); } finally { setLoading(false); }
  };

  const checkGoogleStatus = async () => {
    try { const res = await getGoogleStatus(); setGoogleConnected(res.data.data.connected); }
    catch { setGoogleConnected(false); }
  };

  const handleGoogleConnect = async () => {
    setGoogleLoading(true);
    try {
      const res = await getGoogleAuthUrl();
      window.location.href = res.data.data.url;
    } catch (err) { setPageError(err.response?.data?.error || 'Unable to connect Google Calendar.'); setGoogleLoading(false); }
  };

  const handleGoogleDisconnect = async () => {
    if (!confirm("Disconnect Google Calendar? Previously synced events will remain.")) return;
    try { await disconnectGoogle(); setGoogleConnected(false); } catch (err) { setPageError(err.response?.data?.error || 'Unable to load or update planner. Please try again.'); }
  };

  const openNewEvent = () => {
    setForm({ title: '', startDate: selectedDate, startTime: '10:00', endDate: selectedDate, endTime: '17:00', allDay: false, description: '' });
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.startDate || !form.endDate || form.endDate < form.startDate || (!form.allDay && form.endDate === form.startDate && form.endTime <= form.startTime)) { setPageError('End date/time must be later than start.'); return; }
    setSubmitting(true);
    try {
      const startDate = form.allDay ? `${form.startDate}T00:00:00+07:00` : `${form.startDate}T${form.startTime}:00+07:00`;
      const endDate = form.allDay ? `${form.endDate}T23:59:59+07:00` : `${form.endDate}T${form.endTime}:00+07:00`;
      const res = await createPlannerEvent({ title: form.title, startDate, endDate, allDay: form.allDay, description: form.description });
      setPageError(res.data.data.calendarWarning || ''); setModalOpen(false); fetchEvents();
    } catch (err) { setPageError(err.response?.data?.error || 'Unable to save changes. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this event?")) return;
    try { await deletePlannerEvent(id); fetchEvents(); } catch (err) { setPageError(err.response?.data?.error || 'Unable to load or update planner. Please try again.'); }
  };

  const handleSync = async (id) => {
    setSyncingEvent(id); setPageError('');
    try { await syncPlannerEvent(id); await fetchEvents(); }
    catch (err) { setPageError(err.response?.data?.error || 'Calendar sync failed. Please retry.'); }
    finally { setSyncingEvent(null); }
  };

  const getEventsForDate = (dateStr) => events.filter(e => { const s = e.startDate ? new Date(e.startDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) : ''; const en = e.endDate ? new Date(e.endDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) : ''; return dateStr >= s && dateStr <= en; });

  const getDaysInMonth = () => {
    const d = fromLocalDateKey(selectedDate);
    const year = d.getFullYear(); const month = d.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const monthLabel = () => fromLocalDateKey(selectedDate).toLocaleDateString("en-GB", { month: 'long', year: 'numeric' });
  const changeMonth = (offset) => setSelectedDate(date => shiftCalendarMonth(date, offset));
  const today = toLocalDateKey();
  const todayEvents = getEventsForDate(selectedDate);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

  return (
    <div className="animate-fade-in-up">
      {pageError && <p role="alert" className="mb-3 text-sm text-red-400">{pageError}</p>}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Planner</h1>
          <p className="page-subtitle">Manage your schedule and activities</p>
        </div>
        <div className="flex items-center gap-2">
          {googleConnected ? (
            <button onClick={handleGoogleDisconnect} className="btn btn-secondary text-xs gap-1.5 group" title="Disconnect Google Calendar">
              <GoogleIcon size={14} />
              <span className="hidden sm:inline">Google Calendar</span>
              <CheckCircle2 size={13} style={{ color: 'var(--color-success)' }} />
            </button>
          ) : (
            <button onClick={handleGoogleConnect} disabled={googleLoading} className="btn btn-secondary text-xs gap-1.5" title="Connect Google Calendar">
              <GoogleIcon size={14} />
              <span className="hidden sm:inline">{googleLoading ? 'Connecting...' : 'Connect Calendar'}</span>
              <Link2 size={13} />
            </button>
          )}
          <button onClick={openNewEvent} aria-label="Add Event" className="btn btn-primary"><Plus size={16} /> <span className="hidden sm:inline">Add Event</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => changeMonth(-1)} className="btn btn-ghost p-2"><ChevronLeft size={18} /></button>
            <h2 className="text-base font-semibold capitalize" style={{ color: 'var(--color-text)' }}>{monthLabel()}</h2>
            <button onClick={() => changeMonth(1)} className="btn btn-ghost p-2"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-[11px] font-semibold py-2" style={{ color: 'var(--color-text-muted)' }}>{d}</div>
            ))}
            {getDaysInMonth().map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const dateStr = toLocalDateKey(day);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === today;
              const hasEvents = getEventsForDate(dateStr).length > 0;
              return (
                <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                  aria-label={dateStr}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  className="relative p-1.5 sm:p-2 rounded-xl text-sm transition-all cursor-pointer hover:bg-surface-hover"
                  style={isSelected ? { background: 'var(--color-primary)', color: 'var(--color-text-inverse)', fontWeight: 600, boxShadow: 'var(--shadow-panel-hover)' }
                    : isToday ? { background: 'var(--color-primary-100)', color: 'var(--color-primary)', fontWeight: 600 }
                    : { color: 'var(--color-text)' }}
                >
                  {day.getDate()}
                  {hasEvents && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: isSelected ? 'var(--color-text-inverse)' : 'var(--color-accent)' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Events panel */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            <CalendarDays size={14} />
            {fromLocalDateKey(selectedDate).toLocaleDateString("en-GB", { weekday: 'short', day: 'numeric', month: 'long' })}
          </h3>
          {todayEvents.length === 0 ? (
            <div className="card empty-state py-8">
              <CalendarDays size={28} className="empty-state-icon" />
              <p className="empty-state-text text-xs">No events scheduled</p>
            </div>
          ) : (
            <div className="space-y-3 stagger-children">
              {todayEvents.map(event => (
                <div key={event.id} className="card animate-fade-in-up group hover:shadow-panel-hover transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>{event.title}</h4>
                        {event.gcalEventId && (
                          <span title="Linked to Google Calendar" className="flex-shrink-0">
                            <GoogleIcon size={12} />
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                        <Clock size={11} />
                        {event.allDay ? "All Day" : `${new Date(event.startDate).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} - ${new Date(event.endDate).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`}
                      </p>
                      {event.description && <p className="text-xs mt-1.5 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{event.description}</p>}
                      {googleConnected && <button onClick={() => handleSync(event.id)} disabled={syncingEvent !== null} className="btn btn-ghost text-xs mt-2">{syncingEvent === event.id ? 'Syncing...' : 'Sync to Google'}</button>}
                    </div>
                    <button onClick={() => handleDelete(event.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-danger-surface cursor-pointer flex-shrink-0" style={{ color: 'var(--color-danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Event">
          {pageError && <p role="alert" className="text-sm text-red-400">{pageError}</p>}
        <div className="space-y-4">
          <div><label className="label">Title</label><input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Event name" className="input" autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start Date</label><input type="date" value={form.startDate} onChange={(e) => setForm(p => ({ ...p, startDate: e.target.value }))} className="input" /></div>
            <div><label className="label">Start Time</label><input type="time" value={form.startTime} onChange={(e) => setForm(p => ({ ...p, startTime: e.target.value }))} className="input" disabled={form.allDay} /></div>
            <div><label className="label">End Date</label><input type="date" value={form.endDate} onChange={(e) => setForm(p => ({ ...p, endDate: e.target.value }))} className="input" /></div>
            <div><label className="label">End Time</label><input type="time" value={form.endTime} onChange={(e) => setForm(p => ({ ...p, endTime: e.target.value }))} className="input" disabled={form.allDay} /></div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.allDay} onChange={(e) => setForm(p => ({ ...p, allDay: e.target.checked }))} className="w-4 h-4 rounded accent-primary" />
            <span className="text-sm" style={{ color: 'var(--color-text)' }}>All Day</span>
          </label>
          <div><label className="label">Detail</label><textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Event description..." className="input min-h-[72px] resize-none" rows={3} /></div>
          {googleConnected && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg text-xs" style={{ background: 'var(--color-success-surface)', color: 'var(--color-success)' }}>
              <GoogleIcon size={14} />
              <span>This event will automatically sync to Google Calendar</span>
            </div>
          )}
          <button onClick={handleCreate} disabled={submitting || !form.title} className="btn btn-primary w-full py-2.5">
            {submitting ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : 'Create Event'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
