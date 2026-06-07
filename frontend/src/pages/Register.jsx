import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AuthLayout from '../components/Layout/AuthLayout.jsx';

export default function Register() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
        <h2 className="text-2xl font-bold tracking-tight">Create your account</h2>
        <p className="text-sm text-ink-dim mt-1.5 mb-9">
          Your projects live in the cloud, your code runs locally.
        </p>

        {error && (
          <p className="mb-6 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 font-mono animate-fade-up">
            {error}
          </p>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ink-faint font-mono uppercase tracking-widest">
              username
            </label>
            <input
              className="input-glass"
              placeholder="abhi"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              maxLength={30}
              required
              autoFocus
            />
          </div>

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
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-medium text-ink-faint font-mono uppercase tracking-widest">
              password
            </label>
            <input
              type="password"
              className="input-glass"
              placeholder="6+ characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn-glow w-full mt-9" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account →'}
        </button>

        <p className="text-sm text-ink-dim text-center mt-8">
          Already registered?{' '}
          <Link to="/login" className="text-accent hover:underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
