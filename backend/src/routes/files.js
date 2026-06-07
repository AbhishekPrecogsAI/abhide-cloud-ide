import { Router } from 'express';
import Project from '../models/Project.js';
import { protect } from '../middleware/auth.js';
import { detectLanguage } from '../lib/templates.js';

const router = Router();
router.use(protect);

async function getOwnedProject(req, res) {
  // Owner or invited collaborator — both can edit files
  const project = await Project.findOne({
    _id: req.params.projectId,
    $or: [{ owner: req.user._id }, { collaborators: req.user._id }],
  });
  if (!project) {
    res.status(404).json({ message: 'Project not found' });
    return null;
  }
  return project;
}

// PUT /api/files/:projectId/save — save file content
router.put('/:projectId/save', async (req, res) => {
  try {
    const { path, content } = req.body;
    if (!path || content === undefined) {
      return res.status(400).json({ message: 'path and content are required' });
    }

    const project = await getOwnedProject(req, res);
    if (!project) return;

    const file = project.files.find((f) => f.path === path && f.type === 'file');
    if (!file) return res.status(404).json({ message: 'File not found' });

    file.content = content;
    await project.save();
    res.json({ message: 'File saved', path });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save file' });
  }
});

// POST /api/files/:projectId — create file or folder
router.post('/:projectId', async (req, res) => {
  try {
    const { name, type = 'file', path } = req.body;
    if (!name || !path) return res.status(400).json({ message: 'name and path are required' });
    if (!path.startsWith('/')) return res.status(400).json({ message: 'path must start with /' });

    const project = await getOwnedProject(req, res);
    if (!project) return;

    if (project.files.some((f) => f.path === path)) {
      return res.status(409).json({ message: 'A file already exists at that path' });
    }

    project.files.push({
      name,
      type,
      path,
      content: '',
      language: type === 'file' ? detectLanguage(name) : 'plaintext',
    });
    await project.save();
    res.status(201).json({ message: `${type} created`, path });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create file' });
  }
});

// DELETE /api/files/:projectId — delete file or folder (recursive)
router.delete('/:projectId', async (req, res) => {
  try {
    const { path } = req.body;
    if (!path) return res.status(400).json({ message: 'path is required' });

    const project = await getOwnedProject(req, res);
    if (!project) return;

    const before = project.files.length;
    // Remove the entry itself and, for folders, everything nested under it
    project.files = project.files.filter(
      (f) => f.path !== path && !f.path.startsWith(path + '/')
    );
    if (project.files.length === before) {
      return res.status(404).json({ message: 'File not found' });
    }

    await project.save();
    res.json({ message: 'Deleted', path });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete file' });
  }
});

export default router;
