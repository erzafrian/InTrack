import { createElement } from 'react';
import { attendanceLabel } from '../../utils/presentation';
import { toLocalDateKey, fromLocalDateKey } from '../../utils/calendarDate';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/client';
import { Users, CalendarDays, BookOpen, ClipboardList, ChevronDown, ChevronUp, Clock, Check, FileText, Thermometer, MapPin, BarChart3, MessageSquareText, PackageCheck, ExternalLink, Search, Download, ScanFace, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InternProgress() {
  const [pageError, setPageError] = useState('');
  const [interns, setInterns] = useState([]);
  const [selectedIntern, setSelectedIntern] = useState('');
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: toLocalDateKey().slice(0, 7) + '-01',
    endDate: toLocalDateKey(),
  });
  const [activeTab, setActiveTab] = useState('logbook');
  const [logbookEntries, setLogbookEntries] = useState([]);
  const [plannerEvents, setPlannerEvents] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [resettingFace, setResettingFace] = useState(false);
  const [faceMsg, setFaceMsg] = useState('');

  useEffect(() => {
    api.get('/users', { params: { role: 'INTERN' } }).then(res => setInterns(res.data.data)).catch(() => setPageError('Unable to load interns. Please reload.'));
  }, []);



  const latestRequest = useRef({ id: 0 });
  const fetchAllData = useCallback(async () => {
    const requestId = ++latestRequest.current.id;
    setLogbookEntries([]); setPlannerEvents([]); setAttendances([]); setPageError('');
    setLoading(true);
    try {
      const params = { ...dateRange, targetUserId: selectedIntern };
      const [logRes, planRes, attRes] = await Promise.all([
        api.get('/logbook', { params }),
        api.get('/planner/events', { params }),
        api.get('/attendance', { params }),
      ]);
      if (requestId !== latestRequest.current.id) return;
      setLogbookEntries(logRes.data.data);
      setPlannerEvents(planRes.data.data);
      setAttendances(attRes.data.data);
    } catch (err) { if (requestId === latestRequest.current.id) setPageError(err.response?.data?.error || 'Unable to load intern progress. Please try again.'); }
    finally { if (requestId === latestRequest.current.id) setLoading(false); }
  }, [selectedIntern, dateRange]);
  useEffect(() => { if (selectedIntern) fetchAllData(); const counter = latestRequest.current; return () => { counter.id++; }; }, [fetchAllData, selectedIntern]);

  const formatDate = (dateStr, dateOnly = false) => {
    const d = dateOnly ? fromLocalDateKey(dateStr.split('T')[0]) : new Date(dateStr);
    return d.toLocaleDateString("en-GB", { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', ...(dateOnly ? {} : { timeZone: 'Asia/Jakarta' }) });
  };

  const selectedInternName = interns.find(i => i.id === selectedIntern)?.name || '';

  const handleResetFace = async () => {
    if (!selectedIntern) return;
    if (!window.confirm(`Reset Face ID for ${selectedInternName}? The intern will need to register their face again.`)) return;
    setResettingFace(true);
    setFaceMsg('');
    try {
      await api.delete(`/face/enroll/${selectedIntern}`);
      setFaceMsg("Face ID reset successfully");
      setTimeout(() => setFaceMsg(''), 3000);
    } catch (err) {
      setFaceMsg("Unable to reset: " + (err.response?.data?.error || err.message));
    } finally {
      setResettingFace(false);
    }
  };

  const tabs = [
    { key: 'logbook', label: 'Logbook Tasks', Icon: BookOpen, count: logbookEntries.reduce((acc, e) => acc + (e.tasks?.length || 0), 0) },
    { key: 'planner', label: 'Agenda/Planner', Icon: CalendarDays, count: plannerEvents.length },
    { key: 'attendance', label: "Attendance", Icon: ClipboardList, count: attendances.length },
  ];

  // Stats
  const totalHadir = attendances.filter(a => a.status === 'HADIR').length;
  const totalIzin = attendances.filter(a => a.status === 'IZIN').length;
  const totalSakit = attendances.filter(a => a.status === 'SAKIT').length;

  const downloadInternPDF = () => {
    if (!selectedIntern) return;
    const doc = new jsPDF();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`Logbook Progress — ${selectedInternName}`, 14, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Period: ${dateRange.startDate} to ${dateRange.endDate}`, 14, 28);
    doc.text(`Printed: ${new Date().toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`, 14, 34);

    // Attendance summary
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text("Attendance Summary", 14, 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Present: ${totalHadir}  |  On Leave: ${totalIzin}  |  Sick: ${totalSakit}`, 14, 53);

    // Logbook table
    const tableData = [];
    logbookEntries.forEach(entry => {
      const dateStr = fromLocalDateKey(entry.date.split('T')[0]).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' });
      if (entry.tasks?.length > 0) {
        entry.tasks.forEach(task => {
          tableData.push([
            dateStr,
            `${task.timeStart} - ${task.timeEnd}`,
            task.quantitativeActivity || task.activity || '-',
            task.qualitativeActivity || '-',
            task.output || '-',
          ]);
        });
      }
    });

    autoTable(doc, {
      startY: 60,
      head: [["Date", "Time", "Quantitative Activity", "Qualitative Activity", 'Output']],
      body: tableData.length > 0 ? tableData : [["No data available", '-', '-', '-', '-']],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [27, 28, 30], textColor: 255, fontSize: 8 },
      columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 22 }, 2: { cellWidth: 48 }, 3: { cellWidth: 48 }, 4: { cellWidth: 40 } },
      theme: 'grid',
    });

    const slug = selectedInternName.toLowerCase().replace(/\s+/g, '_');
    doc.save(`progress_${slug}_${dateRange.startDate}_${dateRange.endDate}.pdf`);
  };

  return (
    <div className="animate-fade-in-up">
      {pageError && <p role="alert" className="text-sm text-red-400">{pageError}</p>}
      <div className="page-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Intern Progress</h1>
          <p className="page-subtitle">View all data submitted by interns</p>
        </div>
        {selectedIntern && (
          <div className="flex items-center gap-2">
            {faceMsg && (
              <span className="text-xs font-medium px-2 py-1 rounded-lg" style={{ background: faceMsg.includes("successfully") ? 'var(--color-success-surface)' : 'var(--color-danger-surface)', color: faceMsg.includes("successfully") ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {faceMsg}
              </span>
            )}
            <button onClick={handleResetFace} disabled={resettingFace} className="btn btn-ghost flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-danger)' }}>
              {resettingFace ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <RotateCcw size={14} />}
              Reset Face ID
            </button>
            <button onClick={downloadInternPDF} className="btn btn-secondary">
              <Download size={15} /> Download PDF
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Filter</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Select Intern</label>
            <select value={selectedIntern} onChange={(e) => setSelectedIntern(e.target.value)} className="input">
              <option value="">-- Select Intern --</option>
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

      {!selectedIntern ? (
        <div className="card empty-state py-12">
          <Users size={40} className="empty-state-icon" />
          <p className="empty-state-text">Select an intern to view their progress</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-40"><div className="spinner" /></div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 stagger-children">
            <div className="stat-card animate-fade-in-up">
              <div className="stat-icon" style={{ background: 'var(--color-primary-100)' }}><BookOpen size={18} style={{ color: 'var(--color-primary)' }} /></div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Total Tasks</p>
                <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--color-primary)' }}>{logbookEntries.reduce((acc, e) => acc + (e.tasks?.length || 0), 0)}</p>
              </div>
            </div>
            <div className="stat-card animate-fade-in-up">
              <div className="stat-icon" style={{ background: 'var(--color-success-surface)' }}><Check size={18} style={{ color: 'var(--color-success)' }} /></div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Present</p>
                <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--color-success)' }}>{totalHadir}</p>
              </div>
            </div>
            <div className="stat-card animate-fade-in-up">
              <div className="stat-icon" style={{ background: 'var(--color-warning-surface)' }}><FileText size={18} style={{ color: 'var(--color-warning)' }} /></div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>On Leave</p>
                <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--color-warning)' }}>{totalIzin}</p>
              </div>
            </div>
            <div className="stat-card animate-fade-in-up">
              <div className="stat-icon" style={{ background: 'var(--color-danger-surface)' }}><Thermometer size={18} style={{ color: 'var(--color-danger)' }} /></div>
              <div>
                <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Sick</p>
                <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--color-danger)' }}>{totalSakit}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'var(--color-surface-alt)' }}>
            {tabs.map(({ key, label, Icon, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                style={activeTab === key
                  ? { background: 'var(--color-surface)', color: 'var(--color-primary)', boxShadow: 'var(--shadow-panel-sm)' }
                  : { color: 'var(--color-text-muted)' }}
              >
                {createElement(Icon, { size: 14 })}
                <span className="hidden sm:inline">{label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: activeTab === key ? 'var(--color-primary-100)' : 'var(--color-border-light)', color: activeTab === key ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{count}</span>
              </button>
            ))}
          </div>

          {/* Logbook Tab */}
          {activeTab === 'logbook' && (
            <div className="space-y-3 stagger-children">
              {logbookEntries.length === 0 ? (
                <div className="card empty-state py-8">
                  <BookOpen size={28} className="empty-state-icon" />
                  <p className="empty-state-text text-xs">No logbooks in this period</p>
                </div>
              ) : logbookEntries.map(entry => (
                <div key={entry.id} className="card animate-fade-in-up">
                  <button
                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    className="w-full flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatDate(entry.date, true)}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-primary-100)', color: 'var(--color-primary)' }}>
                        {entry.tasks?.length || 0} task
                      </span>
                    </div>
                    {expandedEntry === entry.id ? <ChevronUp size={16} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} />}
                  </button>
                  {expandedEntry === entry.id && (
                    <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                      {entry.tasks?.map(task => (
                        <div key={task.id} className="p-3 rounded-xl" style={{ background: 'var(--color-bg)' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <Clock size={13} style={{ color: 'var(--color-primary)' }} />
                            <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>{task.timeStart} – {task.timeEnd}</span>
                          </div>

                          {task.activity && !task.quantitativeActivity && !task.qualitativeActivity && (
                            <p className="text-sm mb-1" style={{ color: 'var(--color-text)' }}>{task.activity}</p>
                          )}
                          {task.quantitativeActivity && (
                            <div className="mb-1.5">
                              <div className="flex items-center gap-1 mb-0.5">
                                <BarChart3 size={11} style={{ color: 'var(--color-text-secondary)' }} />
                                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Quantitative</span>
                              </div>
                              <p className="text-sm pl-4" style={{ color: 'var(--color-text)' }}>{task.quantitativeActivity}</p>
                            </div>
                          )}
                          {task.qualitativeActivity && (
                            <div className="mb-1.5">
                              <div className="flex items-center gap-1 mb-0.5">
                                <MessageSquareText size={11} style={{ color: 'var(--color-primary)' }} />
                                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>Qualitative</span>
                              </div>
                              <p className="text-sm pl-4" style={{ color: 'var(--color-text)' }}>{task.qualitativeActivity}</p>
                            </div>
                          )}
                          {task.output && (
                            <div className="mb-1">
                              <div className="flex items-center gap-1 mb-0.5">
                                <PackageCheck size={11} style={{ color: 'var(--color-text-secondary)' }} />
                                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Output</span>
                              </div>
                              <p className="text-sm pl-4" style={{ color: 'var(--color-text)' }}>{task.output}</p>
                            </div>
                          )}
                          {task.evidenceUrl && (
                            <a href={task.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs mt-1 hover:underline" style={{ color: 'var(--color-primary)' }}>
                              <ExternalLink size={11} /> View Evidence
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Planner Tab */}
          {activeTab === 'planner' && (
            <div className="space-y-3 stagger-children">
              {plannerEvents.length === 0 ? (
                <div className="card empty-state py-8">
                  <CalendarDays size={28} className="empty-state-icon" />
                  <p className="empty-state-text text-xs">No scheduled events in this period</p>
                </div>
              ) : plannerEvents.map(event => (
                <div key={event.id} className="card animate-fade-in-up">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-surface-hover)' }}>
                      <CalendarDays size={18} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{event.title}</h4>
                      <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                        <Clock size={11} />
                        {event.allDay ? `${formatDate(event.startDate)} (All Day)` :
                          `${formatDate(event.startDate)} ${new Date(event.startDate).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} - ${new Date(event.endDate).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`}
                      </p>
                      {event.description && <p className="text-xs mt-1.5 line-clamp-3" style={{ color: 'var(--color-text-secondary)' }}>{event.description}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div className="card">
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="table" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Check-in</th>
                      <th>Distance</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendances.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No attendance records</td></tr>
                    ) : attendances.map(a => (
                      <tr key={a.id}>
                        <td style={{ color: 'var(--color-text)' }}>{formatDate(a.date)}</td>
                        <td>
                          <span className={`badge ${a.status === 'HADIR' ? 'badge-hadir' : a.status === 'IZIN' ? 'badge-izin' : 'badge-sakit'}`}>
                            {a.status === 'HADIR' ? <Check size={11} /> : a.status === 'IZIN' ? <FileText size={11} /> : <Thermometer size={11} />}
                            {attendanceLabel(a.status)}
                          </span>
                        </td>
                        <td>
                          {a.checkInTime ? <span className="flex items-center gap-1"><Clock size={12} />{new Date(a.checkInTime).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}</span> : '-'}
                        </td>
                        <td>{a.distanceKm != null ? <span className="flex items-center gap-1"><MapPin size={12} />{a.distanceKm} km</span> : '-'}</td>
                        <td>{a.reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
