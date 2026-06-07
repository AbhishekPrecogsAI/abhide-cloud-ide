import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AuthLayout from '../components/Layout/AuthLayout.jsx';

export default function Login() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form
        onSubmit={handleSubmit}
        className="glass-card rounded-3xl p-9 sm:p-10 animate-fade-up"
        style={{ animationDelay: '150ms' }}
      >
        <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
        <p className="text-sm text-ink-dim mt-1.5 mb-9">
          Sign in to pick up where you left off.
        </p>

        {error && (
          <p className="mb-6 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 font-mono animate-fade-up">
            {error}
          </p>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ink-faint font-mono uppercase tracking-widest">
              email
            </label>
            <input
              type="email"
              className="input-glass"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ink-faint font-mono uppercase tracking-widest">
              password
            </label>
            <input
              type="password"
              className="input-glass"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn-glow w-full mt-9" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in →'}
        </button>

        <p className="text-sm text-ink-dim text-center mt-8">
          No account?{' '}
          <Link
            to="/register"
            className="text-accent hover:underline underline-offset-4"
          >
            Create one
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
