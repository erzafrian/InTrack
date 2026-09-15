import { useState, useEffect } from 'react';
import { getLogbookEntries, createLogbookEntry, addLogbookTask, deleteLogbookTask } from '../../api/logbook';
import Modal from '../../components/Modal';
import FileUpload from '../../components/FileUpload';
import { Plus, Trash2, Clock, Paperclip, ExternalLink, BookOpen, BarChart3, MessageSquareText, PackageCheck, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Logbook() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [taskModal, setTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ timeStart: '10:00', timeEnd: '13:00', quantitativeActivity: '', qualitativeActivity: '', output: '' });
  const [taskEvidence, setTaskEvidence] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // For PDF download — fetch all entries for this month
  const [allEntries, setAllEntries] = useState([]);

  useEffect(() => { fetchEntry(); }, [selectedDate]);
  useEffect(() => { fetchAllEntries(); }, []);

  const fetchEntry = async () => {
    setLoading(true);
    try {
      const res = await getLogbookEntries({ startDate: selectedDate, endDate: selectedDate });
      const data = res.data.data;
      setCurrentEntry(data.length > 0 ? data[0] : null);
    } catch {} finally { setLoading(false); }
  };

  const fetchAllEntries = async () => {
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];
      const res = await getLogbookEntries({ startDate, endDate });
      setAllEntries(res.data.data);
    } catch {}
  };

  const handleCreateEntry = async () => {
    try { const res = await createLogbookEntry(selectedDate); setCurrentEntry(res.data.data); } catch (err) { console.error(err); }
  };

  const handleAddTask = async () => {
    if (!currentEntry) return;
    setSubmitting(true);
    try {
      await addLogbookTask(currentEntry.id, { ...taskForm, evidence: taskEvidence });
      setTaskModal(false);
      setTaskForm({ timeStart: '10:00', timeEnd: '13:00', quantitativeActivity: '', qualitativeActivity: '', output: '' });
      setTaskEvidence(null);
      fetchEntry(); fetchAllEntries();
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm("Delete this task?")) return;
    try { await deleteLogbookTask(taskId); fetchEntry(); fetchAllEntries(); } catch (err) { console.error(err); }
  };

  const formatDateDisplay = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString("en-GB", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const now = new Date();
    const monthName = now.toLocaleDateString("en-GB", { month: 'long', year: 'numeric' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("Daily Activity Logbook", 14, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Period: ${monthName}`, 14, 28);
    doc.text(`Printed: ${new Date().toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, 34);

    const tableData = [];
    allEntries.forEach(entry => {
      const dateStr = new Date(entry.date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' });
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
      startY: 42,
      head: [["Date", "Time", "Quantitative Activity", "Qualitative Activity", 'Output']],
      body: tableData.length > 0 ? tableData : [["No data available", '-', '-', '-', '-']],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [27, 28, 30], textColor: 255, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 22 },
        2: { cellWidth: 48 },
        3: { cellWidth: 48 },
        4: { cellWidth: 40 },
      },
      theme: 'grid',
    });

    doc.save(`logbook_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}.pdf`);
  };

  const isFormValid = (taskForm.quantitativeActivity.trim() || taskForm.qualitativeActivity.trim()) && taskEvidence;

  return (
    <div className="animate-fade-in-up">
      <div className="page-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Logbook</h1>
          <p className="page-subtitle">Record your daily activities</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadPDF} className="btn btn-secondary" title="Download PDF">
            <Download size={15} /> PDF
          </button>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="input w-full sm:w-auto" />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatDateDisplay(selectedDate)}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="spinner" /></div>
      ) : !currentEntry ? (
        <div className="card empty-state">
          <BookOpen size={40} className="empty-state-icon" />
          <p className="empty-state-text mb-4">No logbook for this date</p>
          <button onClick={handleCreateEntry} className="btn btn-primary"><Plus size={16} /> Create Logbook Entry</button>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {currentEntry.tasks?.length === 0 && (
            <div className="card empty-state animate-fade-in-up">
              <Clock size={32} className="empty-state-icon" />
              <p className="empty-state-text">No tasks for this day</p>
            </div>
          )}

          {currentEntry.tasks?.map(task => (
            <div key={task.id} className="card animate-fade-in-up group hover:shadow-panel-hover transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-primary-100)', boxShadow: 'var(--shadow-panel-sm)' }}>
                  <Clock size={18} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)', boxShadow: 'var(--shadow-panel)' }}>
                      {task.timeStart} – {task.timeEnd}
                    </span>
                  </div>

                  {task.activity && !task.quantitativeActivity && !task.qualitativeActivity && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>{task.activity}</p>
                  )}

                  {task.quantitativeActivity && (
                    <div className="mb-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <BarChart3 size={12} style={{ color: 'var(--color-text-secondary)' }} />
                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Quantitative</span>
                      </div>
                      <p className="text-sm leading-relaxed pl-5" style={{ color: 'var(--color-text)' }}>{task.quantitativeActivity}</p>
                    </div>
                  )}

                  {task.qualitativeActivity && (
                    <div className="mb-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <MessageSquareText size={12} style={{ color: 'var(--color-primary)' }} />
                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>Qualitative</span>
                      </div>
                      <p className="text-sm leading-relaxed pl-5" style={{ color: 'var(--color-text)' }}>{task.qualitativeActivity}</p>
                    </div>
                  )}

                  {task.output && (
                    <div className="mb-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <PackageCheck size={12} style={{ color: 'var(--color-text-secondary)' }} />
                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Output</span>
                      </div>
                      <p className="text-sm leading-relaxed pl-5" style={{ color: 'var(--color-text)' }}>{task.output}</p>
                    </div>
                  )}

                  {task.evidenceUrl && (
                    <a href={task.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs mt-2 hover:underline" style={{ color: 'var(--color-primary)' }}>
                      <ExternalLink size={12} /> View Evidence
                    </a>
                  )}
                </div>
                <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-danger-surface cursor-pointer" style={{ color: 'var(--color-danger)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          <button onClick={() => setTaskModal(true)} className="card w-full text-center py-6 cursor-pointer border-dashed border-2 transition-all group" style={{ borderColor: 'var(--color-border)' }}>
            <Plus size={20} className="mx-auto mb-1 transition-colors" style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-sm font-medium transition-colors" style={{ color: 'var(--color-text-muted)' }}>Add Task</span>
          </button>
        </div>
      )}

      <Modal isOpen={taskModal} onClose={() => setTaskModal(false)} title="Add Task">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Time</label>
              <input type="time" value={taskForm.timeStart} onChange={(e) => setTaskForm(p => ({ ...p, timeStart: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" value={taskForm.timeEnd} onChange={(e) => setTaskForm(p => ({ ...p, timeEnd: e.target.value }))} className="input" />
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <BarChart3 size={13} style={{ color: 'var(--color-text-secondary)' }} />
              Quantitative Activity
            </label>
            <textarea value={taskForm.quantitativeActivity} onChange={(e) => setTaskForm(p => ({ ...p, quantitativeActivity: e.target.value }))} placeholder="e.g. Write 5 report pages, enter 20 records..." className="input min-h-[72px] resize-none" rows={3} />
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <MessageSquareText size={13} style={{ color: 'var(--color-primary)' }} />
              Qualitative Activity
            </label>
            <textarea value={taskForm.qualitativeActivity} onChange={(e) => setTaskForm(p => ({ ...p, qualitativeActivity: e.target.value }))} placeholder="e.g. Discuss progress, review code, brainstorm ideas..." className="input min-h-[72px] resize-none" rows={3} />
          </div>

          <div>
            <label className="label flex items-center gap-1.5">
              <PackageCheck size={13} style={{ color: 'var(--color-text-secondary)' }} />
              Activity Output
            </label>
            <textarea value={taskForm.output} onChange={(e) => setTaskForm(p => ({ ...p, output: e.target.value }))} placeholder="Results or output of the activity..." className="input min-h-[56px] resize-none" rows={2} />
          </div>

          <div>
            <label className="label">Evidence (required)</label>
            <FileUpload onFileSelect={setTaskEvidence} />
            {taskEvidence && <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--color-success)' }}><Paperclip size={12} />{taskEvidence.name}</p>}
            {!taskEvidence && <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Upload evidence to enable submission</p>}
          </div>

          <button onClick={handleAddTask} disabled={submitting || !isFormValid} className="btn btn-primary w-full py-2.5">
            {submitting ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : 'Submit'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
