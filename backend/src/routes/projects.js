import { Router } from 'express';
import Project from '../models/Project.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { getTemplateFiles } from '../lib/templates.js';
import { fetchGitHubRepoFiles } from '../lib/github.js';

const router = Router();
router.use(protect);

// owner OR invited collaborator
const memberQuery = (req) => ({
  _id: req.params.id,
  $or: [{ owner: req.user._id }, { collaborators: req.user._id }],
});

// GET /api/projects — list owned + shared (no file contents)
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { collaborators: req.user._id }],
    })
      .select('-files')
      .sort({ updatedAt: -1 });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
});

// POST /api/projects — create from template
router.post('/', async (req, res) => {
  try {
    const { name, description = '', template = 'vanilla' } = req.body;
    if (!name) return res.status(400).json({ message: 'Project name is required' });

    const files = getTemplateFiles(template);
    if (!files) return res.status(400).json({ message: `Unknown template: ${template}` });

    const project = await Project.create({
      name,
      description,
      template,
      owner: req.user._id,
      files,
      lastOpenedFile: files.find((f) => f.type === 'file')?.path || '',
    });
    res.status(201).json({ project });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors)[0]?.message || 'Validation failed';
      return res.status(400).json({ message });
    }
    res.status(500).json({ message: 'Failed to create project' });
  }
});

// POST /api/projects/import — import a public GitHub repo
router.post('/import', async (req, res) => {
  try {
    const { repoUrl, name } = req.body;
    if (!repoUrl) return res.status(400).json({ message: 'repoUrl is required' });

    const { owner, repo, ref, files } = await fetchGitHubRepoFiles(repoUrl);

    const project = await Project.create({
      name: (name || repo).slice(0, 60),
      description: `Imported from github.com/${owner}/${repo} (${ref})`,
      template: 'github',
      owner: req.user._id,
      files,
      lastOpenedFile:
        files.find((f) => f.path === '/package.json')?.path ||
        files.find((f) => f.path === '/README.md')?.path ||
        files.find((f) => f.type === 'file')?.path ||
        '',
    });
    res.status(201).json({ project });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ message: err.message || 'Failed to import repository' });
  }
});

// GET /api/projects/:id — full project with files (owner or collaborator)
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findOne(memberQuery(req));
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch project' });
  }
});

// POST /api/projects/:id/invite — owner adds a collaborator by email/username
router.post('/:id/invite', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ message: 'identifier is required' });

    const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const invitee = await User.findOne({
      $or: [{ email: identifier.toLowerCase().trim() }, { username: identifier.trim() }],
    });
    if (!invitee) return res.status(404).json({ message: 'No user with that email/username' });
    if (invitee._id.equals(req.user._id))
      return res.status(400).json({ message: "That's you — already the owner" });
    if (project.collaborators.some((c) => c.equals(invitee._id)))
      return res.status(409).json({ message: `${invitee.username} is already a collaborator` });

    project.collaborators.push(invitee._id);
    await project.save();
    res.json({ message: `${invitee.username} can now open this project`, username: invitee.username });
  } catch (err) {
    res.status(500).json({ message: 'Failed to invite' });
  }
});

// PUT /api/projects/:id — update metadata
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['name', 'description', 'isPublic', 'lastOpenedFile'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      updates,
      { new: true, runValidators: true }
    ).select('-files');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete project' });
  }
});

export default router;
