import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['file', 'folder'], default: 'file' },
    content: { type: String, default: '' },
    language: { type: String, default: 'plaintext' },
    path: { type: String, required: true }, // always starts with /
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Project name is required'], trim: true, maxlength: 60 },
    description: { type: String, default: '', maxlength: 300 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    template: {
      type: String,
      enum: ['vanilla', 'react', 'express', 'empty', 'github'],
      default: 'vanilla',
    },
    files: { type: [fileSchema], default: [] },
    lastOpenedFile: { type: String, default: '' },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Project', projectSchema);
