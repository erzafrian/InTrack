import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import Brand from '../components/Brand';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password, rememberMe);
      if (user.role === 'INTERN') navigate('/absen');
      else navigate('/mentor/dashboard');
    } catch (err) {
      const status = err.response?.status;
      if (!err.response) setError("Unable to connect to the server. Check your connection and try again.");
      else if (status >= 500) setError("Login is temporarily unavailable. Please try again shortly.");
      else if (status === 401) setError("Incorrect email or password.");
      else setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <div className="relative w-full max-w-[400px] animate-scale-in">
        <div className="text-center mb-8">
          <h1><Brand variant="login" /></h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Intern Tracking System</p>
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--color-text)' }}>Welcome back</h2>

          {error && (
            <div role="alert" id="login-error" className="mb-4 p-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in-up" style={{ background: 'var(--color-danger-surface)', color: 'var(--color-danger)', boxShadow: 'var(--shadow-inset)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input id="email" type="email" autoComplete="username" aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@intrack.com" className="input pl-10" required autoFocus />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
                <input id="password" type="password" autoComplete="current-password" aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input pl-10" required />
              </div>
            </div>

            {/* Stay Signed In */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-2 accent-[var(--color-primary)]"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Remember me</span>
            </label>

            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5 text-sm mt-2 group">
              {loading ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} />
                : <><span>Login</span><ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs font-mono mt-6" style={{ color: 'var(--color-text-muted)' }}>© {new Date().getFullYear()} InTrack</p>
      </div>
    </div>
  );
}
