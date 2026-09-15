import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { Send, Bot, Trash2, Plus, MessageSquare, Pencil, Check, X } from 'lucide-react';

// ── Markdown Renderer ──

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('### ')) { elements.push(<h4 key={i} className="font-semibold text-sm mt-2 mb-1">{renderInline(line.slice(4))}</h4>); i++; continue; }
    if (line.startsWith('## ')) { elements.push(<h3 key={i} className="font-semibold text-base mt-2 mb-1">{renderInline(line.slice(3))}</h3>); i++; continue; }
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++; }
      elements.push(<ol key={`ol-${i}`} className="list-decimal list-inside space-y-0.5 my-1 text-sm">{items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ol>);
      continue;
    }
    if (/^[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s/, '')); i++; }
      elements.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 my-1 text-sm">{items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ul>);
      continue;
    }
    if (/^\s+[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s+[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^\s+[-*]\s/, '')); i++; }
      elements.push(<ul key={`sul-${i}`} className="list-disc list-inside space-y-0.5 my-0.5 ml-4 text-sm">{items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ul>);
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    elements.push(<p key={i} className="text-sm my-0.5">{renderInline(line)}</p>);
    i++;
  }
  return elements;
}

function renderInline(text) {
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  );
}

// ── Room Sidebar ──

function RoomSidebar({ rooms, activeRoom, onSelect, onCreate, onRename, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (editingId && inputRef.current) inputRef.current.focus(); }, [editingId]);

  const startEdit = (room) => { setEditingId(room.id); setEditName(room.name); };
  const confirmEdit = () => { if (editName.trim()) { onRename(editingId, editName.trim()); } setEditingId(null); };

  return (
    <div className="flex flex-col h-full border-r" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-alt)' }}>
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Rooms</span>
        <button onClick={onCreate} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer" style={{ color: 'var(--color-primary)' }}>
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {rooms.map(room => (
          <div key={room.id}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${activeRoom === room.id ? 'font-medium' : ''}`}
            style={activeRoom === room.id ? { background: 'var(--color-primary-100)', color: 'var(--color-primary)' } : { color: 'var(--color-text-secondary)' }}
            onClick={() => onSelect(room.id)}
          >
            <MessageSquare size={14} className="flex-shrink-0" />
            {editingId === room.id ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input ref={inputRef} value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmEdit()}
                  className="flex-1 min-w-0 bg-transparent border-b text-sm px-0 py-0 outline-none" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-text)' }}
                  onClick={e => e.stopPropagation()} />
                <button onClick={(e) => { e.stopPropagation(); confirmEdit(); }} className="cursor-pointer"><Check size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="cursor-pointer"><X size={12} /></button>
              </div>
            ) : (
              <>
                <span className="flex-1 truncate">{room.name}</span>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); startEdit(room); }} className="cursor-pointer opacity-60 hover:opacity-100"><Pencil size={11} /></button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(room.id); }} className="cursor-pointer opacity-60 hover:opacity-100 text-red-400"><Trash2 size={11} /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {rooms.length === 0 && <p className="text-xs p-3 text-center" style={{ color: 'var(--color-text-muted)' }}>No conversations yet</p>}
      </div>
    </div>
  );
}

// ── Main Component ──

const greeting = { role: 'assistant', content: 'Hello! I am the **InTrack AI Assistant**.\n\nI can help you:\n- Monitor **intern progress**\n- Analyse **attendance data**\n- Get **insights and suggestions**\n\nAsk me anything!' };

export default function AiChat() {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef(null);




  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadRooms = useCallback(async () => {
    try {
      const res = await api.get('/admin/mentor/chat-rooms');
      const data = res.data.data;
      setRooms(data);
      if (data.length > 0) setActiveRoom(current => current || data[0].id);
    } catch (err) { setChatError(err.response?.data?.error || 'Unable to load or update conversation. Please try again.'); } finally { setRoomsLoaded(true); }
  }, []);
  useEffect(() => { loadRooms(); }, [loadRooms]);

  const loadMessages = useCallback(async (roomId) => {
    if (!roomId) { setMessages([greeting]); return; }
    try {
      const res = await api.get(`/admin/mentor/chat-rooms/${roomId}/messages`);
      const data = res.data.data;
      setMessages(data.length > 0 ? data.map(m => ({ role: m.role, content: m.content })) : [greeting]);
    } catch { setMessages([greeting]); }
  }, []);

  useEffect(() => { if (activeRoom) loadMessages(activeRoom); else setMessages([greeting]); }, [activeRoom, loadMessages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setChatError('');
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const res = await api.post('/admin/mentor/ai-query', { query: userMsg, roomId: activeRoom });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.data.response }]);
      // If a new room was created by the backend, set it
      if (res.data.data.roomId && !activeRoom) {
        setActiveRoom(res.data.data.roomId);
        loadRooms();
      }
    } catch (err) {
      setChatError(err.response?.data?.error || 'Unable to send your message. Please try again.');
      setMessages(prev => prev.slice(0, -1));
      setInput(userMsg);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  const createRoom = async () => {
    try {
      const res = await api.post('/admin/mentor/chat-rooms', { name: "New Chat" });
      await loadRooms();
      setActiveRoom(res.data.data.id);
    } catch (err) { setChatError(err.response?.data?.error || 'Unable to load or update conversation. Please try again.'); }
  };

  const renameRoom = async (id, name) => {
    try {
      await api.put(`/admin/mentor/chat-rooms/${id}`, { name });
      loadRooms();
    } catch (err) { setChatError(err.response?.data?.error || 'Unable to load or update conversation. Please try again.'); }
  };

  const deleteRoom = async (id) => {
    try {
      await api.delete(`/admin/mentor/chat-rooms/${id}`);
      const updated = rooms.filter(r => r.id !== id);
      setRooms(updated);
      if (activeRoom === id) setActiveRoom(updated[0]?.id || null);
    } catch (err) { setChatError(err.response?.data?.error || 'Unable to load or update conversation. Please try again.'); }
  };

  if (!roomsLoaded) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

  return (
    <div className="flex h-[calc(100vh-5rem)] lg:h-[calc(100vh-4rem)] animate-fade-in-up rounded-xl overflow-hidden relative" style={{ border: '1px solid var(--color-border)' }}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {/* Room sidebar */}
      <div className={`absolute md:relative z-40 h-full w-64 min-w-[16rem] transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`} style={{ maxWidth: '80vw' }}>
        <RoomSidebar rooms={rooms} activeRoom={activeRoom} onSelect={(id) => { setActiveRoom(id); setSidebarOpen(false); }} onCreate={createRoom} onRename={renameRoom} onDelete={deleteRoom} />
      </div>

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0" style={{ background: 'var(--color-bg)' }}>
        {/* Header */}
        <div className="flex-shrink-0 px-3 sm:px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
              <MessageSquare size={18} />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <Bot size={18} style={{ color: 'var(--color-primary)' }} />
                AI Assistant
              </h1>
              <p className="flex items-center gap-2 mt-0.5">
                <span className="text-xs hidden sm:inline" style={{ color: 'var(--color-text-muted)' }}>Powered by InTrack</span>
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {chatError && <p role="alert" className="px-4 py-2 text-sm text-red-400">{chatError}</p>}
        <div className="flex-1 overflow-y-auto space-y-3 p-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: 'var(--color-primary-100)' }}>
                  <Bot size={14} style={{ color: 'var(--color-primary)' }} />
                </div>
              )}
              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 leading-relaxed"
                style={msg.role === 'user'
                  ? { background: 'var(--color-primary)', color: 'var(--color-text-inverse)', borderBottomRightRadius: '0.375rem', fontSize: '0.875rem' }
                  : { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)', borderBottomLeftRadius: '0.375rem' }
                }
              >
                {msg.role === 'user' ? msg.content : renderMarkdown(msg.content)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mr-2" style={{ background: 'var(--color-primary-100)' }}>
                <Bot size={14} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderBottomLeftRadius: '0.375rem' }}>
                <div className="flex gap-1">
                  {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-text-muted)', animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 pb-4 flex gap-2 sm:gap-3">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask about intern progress..." className="input flex-1" disabled={loading} />
          <button onClick={handleSend} aria-label="Kirim pesan" disabled={loading || !input.trim()} className="btn btn-primary px-3 sm:px-5 cursor-pointer">
            <Send size={16} />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
