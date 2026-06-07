import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  LogOut,
  Trash2,
  Clock,
  ArrowRight,
  FolderOpen,
  AtSign,
  Loader2,
  X,
  GitFork,
  LayoutTemplate,
} from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Logo } from '../components/Logo.jsx';

const TEMPLATES = [
  { id: 'vanilla', label: 'Vanilla', desc: 'HTML · CSS · JS with Vite', icon: 'JS' },
  { id: 'react', label: 'React', desc: 'React 18 + Vite starter', icon: '⚛' },
  { id: 'express', label: 'Express', desc: 'Node.js API server', icon: 'ex' },
  { id: 'empty', label: 'Empty', desc: 'Blank canvas', icon: '∅' },
];

const TEMPLATE_COLORS = {
  vanilla: 'text-yellow-300 bg-yellow-300/10',
  react: 'text-sky-300 bg-sky-300/10',
  express: 'text-ink-dim bg-white/5',
  empty: 'text-ink-faint bg-white/5',
  github: 'text-violet-300 bg-violet-300/10',
};

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Create-modal state
  const [mode, setMode] = useState('template'); // 'template' | 'github'
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('react');
  const [repoUrl, setRepoUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/projects')
      .then(({ data }) => setProjects(data.projects))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const { data } =
        mode === 'github'
          ? await api.post('/projects/import', { repoUrl, name })
          : await api.post('/projects', { name, description, template });
      navigate(`/ide/${data.project._id}`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (mode === 'github' ? 'Failed to import repository' : 'Failed to create project')
      );
      setCreating(false);
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this project? This cannot be undone.')) return;
    await api.delete(`/projects/${id}`);
    setProjects((prev) => prev.filter((p) => p._id !== id));
  }

  return (
    <div className="relative min-h-full overflow-x-hidden bg-surface-0">
      {/* Ambient atmosphere */}
      <div className="orb orb-mint opacity-60" />
      <div className="orb orb-violet opacity-60" />
      <div className="absolute inset-0 grid-bg opacity-50" />

      {/* Top bar — frosted */}
      <header className="sticky top-0 z-20 bg-surface-0/60 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1 text-sm text-ink-dim font-mono">
              <AtSign size={13} className="text-accent" />
              {user?.username}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-2 font-mono text-xs text-ink-faint hover:text-ink border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5 transition-all"
            >
              <LogOut size={13} />
              logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-12 animate-fade-up">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-ink-dim mt-2 font-mono">
              {projects.length} project{projects.length === 1 ? '' : 's'} in your
              workspace
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-glow flex items-center gap-2"
          >
            <Plus size={16} strokeWidth={2.5} />
            New project
          </button>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-ink-dim font-mono text-sm">
            <Loader2 size={14} className="animate-spin text-accent" />
            loading…
          </p>
        ) : projects.length === 0 ? (
          <div className="glass-card rounded-3xl py-24 text-center animate-fade-up">
            <FolderOpen size={36} strokeWidth={1.5} className="mx-auto text-ink-faint mb-4" />
            <p className="font-mono text-ink-faint text-sm mb-3">$ ls projects/</p>
            <p className="text-ink-dim mb-8">
              Nothing here yet. Spin up your first project.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="btn-glow inline-flex items-center gap-2"
            >
              <Plus size={16} strokeWidth={2.5} />
              Create a project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p, i) => (
              <div
                key={p._id}
                onClick={() => navigate(`/ide/${p._id}`)}
                className="group relative overflow-hidden glass-card rounded-2xl p-6 cursor-pointer animate-fade-up
                  transition-all duration-300 ease-out
                  hover:-translate-y-1.5 hover:border-accent/30
                  hover:shadow-[0_20px_48px_-12px_rgba(0,0,0,0.6),0_0_32px_-8px_rgba(110,231,183,0.25)]"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Sheen sweep on hover */}
                <span
                  className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full
                    bg-gradient-to-r from-transparent via-white/[0.05] to-transparent
                    transition-transform duration-700 ease-out"
                />

                <div className="relative flex items-start justify-between mb-4">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`font-mono text-[11px] px-2.5 py-1 rounded-md transition-transform duration-300 group-hover:scale-105 ${TEMPLATE_COLORS[p.template]}`}
                    >
                      {p.template}
                    </span>
                    {p.owner !== user?._id && (
                      <span className="font-mono text-[11px] px-2.5 py-1 rounded-md text-accent bg-accent/10">
                        shared
                      </span>
                    )}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, p._id)}
                    className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-red-400 hover:scale-110 transition-all duration-300 p-1"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <h3 className="relative font-semibold text-lg truncate transition-colors duration-300 group-hover:text-accent">
                  {p.name}
                </h3>
                <p className="relative text-sm text-ink-dim truncate mt-1 min-h-[1.25rem]">
                  {p.description || '—'}
                </p>

                <div className="relative flex items-center justify-between mt-6">
                  <p className="flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
                    <Clock size={11} />
                    {timeAgo(p.updatedAt)}
                  </p>
                  <span
                    className="flex items-center gap-1 font-mono text-[11px] text-accent opacity-0 translate-x-2
                      group-hover:opacity-100 group-hover:translate-x-0
                      transition-all duration-300"
                  >
                    open
                    <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => !creating && setShowModal(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md glass-card rounded-3xl p-8 space-y-6 animate-fade-up"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">New project</h2>
              <button
                type="button"
                onClick={() => !creating && setShowModal(false)}
                className="text-ink-faint hover:text-ink transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 font-mono">
                {error}
              </p>
            )}

            {/* Mode switch */}
            <div className="flex gap-1.5 bg-white/[0.03] border border-white/10 rounded-xl p-1">
              {[
                { id: 'template', label: 'Template', Icon: LayoutTemplate },
                { id: 'github', label: 'GitHub', Icon: GitFork },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMode(id);
                    setError('');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                    mode === id
                      ? 'bg-accent/10 text-accent border border-accent/30'
                      : 'text-ink-dim hover:text-ink border border-transparent'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {mode === 'github' ? (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-ink-faint font-mono uppercase tracking-widest">
                    repository url
                  </label>
                  <input
                    className="input-glass font-mono text-[13px]"
                    placeholder="github.com/owner/repo or owner/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    required
                    autoFocus
                  />
                  <p className="text-[11px] text-ink-faint">
                    Public repos only · node_modules, binaries &amp; build dirs are
                    skipped · max 400 files
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-ink-faint font-mono uppercase tracking-widest">
                    project name <span className="normal-case">(optional — defaults to repo name)</span>
                  </label>
                  <input
                    className="input-glass"
                    placeholder="my-app"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-ink-faint font-mono uppercase tracking-widest">
                    name
                  </label>
                  <input
                    className="input-glass"
                    placeholder="my-app"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-ink-faint font-mono uppercase tracking-widest">
                    description <span className="normal-case">(optional)</span>
                  </label>
                  <input
                    className="input-glass"
                    placeholder="What are you building?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={300}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-ink-faint font-mono uppercase tracking-widest">
                    template
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplate(t.id)}
                        className={`text-left rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 ${
                          template === t.id
                            ? 'border-accent/60 bg-accent/[0.07] shadow-[0_0_20px_-6px_rgba(110,231,183,0.4)]'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="font-mono text-xs text-accent">{t.icon}</span>
                        <p className="text-sm font-medium mt-1.5">{t.label}</p>
                        <p className="text-[11px] text-ink-dim mt-0.5">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 text-sm text-ink-dim hover:text-ink border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 transition-all"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-glow flex-1 flex items-center justify-center gap-2"
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {mode === 'github' ? 'Importing…' : 'Creating…'}
                  </>
                ) : mode === 'github' ? (
                  'Import'
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
