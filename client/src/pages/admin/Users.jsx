import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/client';
import Modal from '../../components/Modal';
import { Plus, Pencil, Trash2, Search, UserPlus, Shield, GraduationCap } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'INTERN', department: '' });
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');



  const latestRequest = useRef({ id: 0 });
  const fetchUsers = useCallback(async () => {
    const requestId = ++latestRequest.current.id;
    try {
      const params = {};
      if (filter) params.role = filter;
      if (search) params.search = search;
      const res = await api.get('/users', { params });
      if (requestId !== latestRequest.current.id) return;
      setUsers(res.data.data);
    } catch (err) { setError(err.response?.data?.error || 'Unable to load users. Please try again.'); } finally { if (requestId === latestRequest.current.id) setLoading(false); }
  }, [filter, search]);
  useEffect(() => { fetchUsers(); const counter = latestRequest.current; return () => { counter.id++; }; }, [fetchUsers]);

  const openCreate = () => { setEditUser(null); setForm({ name: '', email: '', password: '', role: 'INTERN', department: '' }); setError(''); setModalOpen(true); };
  const openEdit = (user) => { setEditUser(user); setForm({ name: user.name, email: user.email, password: '', role: user.role, department: user.department || '' }); setError(''); setModalOpen(true); };

  const handleSubmit = async () => {
    setError('');
    if (!form.name || !form.email) { setError("Name and email are required"); return; }
    if (!editUser && !form.password) { setError("Password is required"); return; }
    setSubmitting(true);
    try {
      const data = { ...form };
      if (!data.password) delete data.password;
      if (editUser) await api.put(`/users/${editUser.id}`, data);
      else await api.post('/users', data);
      setModalOpen(false); fetchUsers();
    } catch (err) { setError(err.response?.data?.error || "Failed"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete user "${name}"? All associated data, including attendance and logbooks, will also be deleted.`)) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert("Unable to delete user: " + (err.response?.data?.error || err.message));
    }
  };

  const roleConfig = {
    SUPERUSER: { color: 'var(--color-primary)', bg: 'var(--color-primary-100)', Icon: Shield },
    MENTOR: { color: 'var(--color-text-secondary)', bg: 'var(--color-surface-hover)', Icon: GraduationCap },
    INTERN: { color: 'var(--color-text-secondary)', bg: 'var(--color-surface-hover)', Icon: UserPlus },
  };

  return (
    <div className="animate-fade-in-up">
      {error && !modalOpen && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage intern and mentor accounts</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary"><Plus size={16} /> Add User</button>
      </div>

      <div className="card mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="input pl-10" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input">
            <option value="">All Roles</option>
            <option value="INTERN">Intern</option>
            <option value="MENTOR">Mentor</option>
            <option value="SUPERUSER">Super User</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="spinner" /></div>
      ) : (
        /* Mobile: Card list; Desktop: Table */
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3 stagger-children">
            {users.map(user => {
              const rc = roleConfig[user.role] || roleConfig.INTERN;
              return (
                <div key={user.id} className="card animate-fade-in-up">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-hover border border-border flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {user.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>{user.name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{user.email}</p>
                    </div>
                    <span className="badge flex items-center gap-1" style={{ background: rc.bg, color: rc.color }}>
                      <rc.Icon size={11} />{user.role}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{user.department || 'No dept'}</span>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(user)} className="btn btn-ghost p-1.5 cursor-pointer"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(user.id, user.name)} className="btn btn-ghost p-1.5 cursor-pointer" style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th className="hidden md:table-cell">Department</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const rc = roleConfig[user.role] || roleConfig.INTERN;
                    return (
                      <tr key={user.id}>
                        <td className="font-medium" style={{ color: 'var(--color-text)' }}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-surface-hover border border-border flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                              {user.name?.charAt(0)?.toUpperCase()}
                            </div>
                            {user.name}
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td><span className="badge flex items-center gap-1" style={{ background: rc.bg, color: rc.color }}><rc.Icon size={11} />{user.role}</span></td>
                        <td className="hidden md:table-cell">{user.department || '-'}</td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(user)} className="btn btn-ghost p-1.5 cursor-pointer"><Pencil size={14} /></button>
                            <button onClick={() => handleDelete(user.id, user.name)} className="btn btn-ghost p-1.5 cursor-pointer" style={{ color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? 'Edit User' : 'Inject User Baru'}>
        <div className="space-y-3">
          {error && <div className="p-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in-up" style={{ background: 'var(--color-danger-surface)', color: 'var(--color-danger)' }}><span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />{error}</div>}
          <div><label className="label">Name</label><input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} className="input" /></div>
          <div><label className="label">Email</label><input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className="input" /></div>
          <div><label className="label">Password {editUser && "(leave blank to keep unchanged)"}</label><input type="password" value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} className="input" placeholder={editUser ? '••••••••' : ''} /></div>
          <div><label className="label">Role</label><select value={form.role} onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))} className="input"><option value="INTERN">Intern</option><option value="MENTOR">Mentor</option><option value="SUPERUSER">Super User</option></select></div>
          <div><label className="label">Department</label><input value={form.department} onChange={(e) => setForm(p => ({ ...p, department: e.target.value }))} className="input" placeholder="e.g. AI Engineering" /></div>
          <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary w-full py-2.5 mt-1">
            {submitting ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : editUser ? 'Update User' : 'Create User'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
