import { useMemo, useState } from 'react';
import { FilePlus2, FolderPlus, Folder, FolderOpen } from 'lucide-react';
import { getIcon } from 'material-file-icons';
import api from '../../lib/api';
import { useIDEStore } from '../../store/ideStore';
import { useSettingsStore } from '../../store/settingsStore';
import { languageFromPath } from '../../lib/webcontainer';

// ---- helpers ---------------------------------------------------------------

/** Material icon theme (same pack as VS Code's Material Icon Theme) */
function FileIcon({ filename }) {
  return (
    <span
      className="w-4 h-4 shrink-0"
      dangerouslySetInnerHTML={{ __html: getIcon(filename).svg }}
    />
  );
}

/** Build a nested tree from the flat file array via parent-path matching */
function buildTree(files) {
  const children = (parentPath) =>
    files
      .filter((f) => {
        const parent = f.path.slice(0, f.path.lastIndexOf('/')) || '/';
        return parent === parentPath;
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((f) => ({ ...f, children: f.type === 'folder' ? children(f.path) : [] }));
  return children('/');
}

// ---- nodes -----------------------------------------------------------------

function TreeNode({ node, depth, onDelete, onCreateIn }) {
  const { activeTab, openFile } = useIDEStore();
  const showIcons = useSettingsStore((s) => s.fileIcons);
  const [open, setOpen] = useState(true);
  const isActive = activeTab === node.path;
  const pad = { paddingLeft: `${depth * 12 + 10}px` };

  if (node.type === 'folder') {
    return (
      <div>
        <div
          className="group flex items-center gap-1.5 py-1 pr-2 cursor-pointer text-ink-dim hover:text-ink hover:bg-surface-2 text-[13px] font-mono select-none"
          style={pad}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="text-[10px] text-ink-faint w-2.5">{open ? '▾' : '▸'}</span>
          {showIcons ? (
            open ? (
              <FolderOpen size={14} className="shrink-0 text-[#90a4ae]" />
            ) : (
              <Folder size={14} className="shrink-0 text-[#90a4ae]" />
            )
          ) : null}
          <span className="truncate flex-1">{node.name}</span>
          <span className="hidden group-hover:flex items-center gap-1">
            <button
              title="New file in folder"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
                onCreateIn(node.path, 'file');
              }}
              className="text-ink-faint hover:text-accent text-[11px]"
            >
              +
            </button>
            <button
              title="Delete folder"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node);
              }}
              className="text-ink-faint hover:text-red-400 text-[11px]"
            >
              ✕
            </button>
          </span>
        </div>
        {open &&
          node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onDelete={onDelete}
              onCreateIn={onCreateIn}
            />
          ))}
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-2 py-1 pr-2 cursor-pointer text-[13px] font-mono select-none
        ${
          isActive
            ? 'bg-surface-3 text-ink border-l-2 border-accent'
            : 'text-ink-dim hover:text-ink hover:bg-surface-2 border-l-2 border-transparent'
        }`}
      style={pad}
      onClick={() => openFile(node.path)}
    >
      {showIcons ? (
        <FileIcon filename={node.name} />
      ) : (
        <span className="text-[10px] w-4 text-center text-ink-faint">·</span>
      )}
      <span className="truncate flex-1">{node.name}</span>
      <button
        title="Delete file"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node);
        }}
        className="hidden group-hover:block text-ink-faint hover:text-red-400 text-[11px]"
      >
        ✕
      </button>
    </div>
  );
}

// ---- main ------------------------------------------------------------------

export default function FileTree() {
  const { project, files, addFile, removeFile, openFile, webcontainerInstance } =
    useIDEStore();
  const tree = useMemo(() => buildTree(files), [files]);

  // { parentPath, type } while the inline input is showing
  const [draft, setDraft] = useState(null);
  const [draftName, setDraftName] = useState('');

  function startCreate(parentPath, type) {
    setDraft({ parentPath, type });
    setDraftName('');
  }

  async function commitCreate() {
    const name = draftName.trim();
    if (!name) return setDraft(null);

    const base = draft.parentPath === '/' ? '' : draft.parentPath;
    const path = `${base}/${name}`;

    if (files.some((f) => f.path === path)) {
      alert('A file already exists at that path');
      return;
    }

    try {
      await api.post(`/files/${project._id}`, { name, type: draft.type, path });
      addFile({
        name,
        type: draft.type,
        path,
        content: '',
        language: draft.type === 'file' ? languageFromPath(path) : 'plaintext',
      });

      // Mirror into the WebContainer filesystem
      if (webcontainerInstance) {
        if (draft.type === 'folder') {
          await webcontainerInstance.fs.mkdir(path, { recursive: true });
        } else {
          await webcontainerInstance.fs.writeFile(path, '');
        }
      }

      if (draft.type === 'file') openFile(path);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create');
    } finally {
      setDraft(null);
    }
  }

  async function handleDelete(node) {
    if (!confirm(`Delete ${node.type} "${node.name}"?`)) return;
    try {
      await api.delete(`/files/${project._id}`, { data: { path: node.path } });
      removeFile(node.path);
      if (webcontainerInstance) {
        await webcontainerInstance.fs
          .rm(node.path, { recursive: true })
          .catch(() => {});
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  }

  return (
    <div className="py-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pb-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          explorer
        </span>
        <div className="flex items-center gap-2.5">
          <button
            title="New file"
            onClick={() => startCreate('/', 'file')}
            className="text-ink-faint hover:text-accent transition-colors"
          >
            <FilePlus2 size={13} />
          </button>
          <button
            title="New folder"
            onClick={() => startCreate('/', 'folder')}
            className="text-ink-faint hover:text-accent transition-colors"
          >
            <FolderPlus size={13} />
          </button>
        </div>
      </div>

      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          onDelete={handleDelete}
          onCreateIn={startCreate}
        />
      ))}

      {/* Inline create input */}
      {draft && (
        <div className="px-3 py-1.5" style={{ paddingLeft: draft.parentPath === '/' ? 12 : 24 }}>
          <input
            autoFocus
            className="w-full bg-surface-2 border border-accent/40 rounded px-2 py-1 font-mono text-[12px] outline-none"
            placeholder={
              (draft.parentPath !== '/' ? `${draft.parentPath}/` : '/') +
              (draft.type === 'folder' ? 'folder-name' : 'file.js')
            }
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitCreate();
              if (e.key === 'Escape') setDraft(null);
            }}
            onBlur={() => setDraft(null)}
          />
        </div>
      )}
    </div>
  );
}
