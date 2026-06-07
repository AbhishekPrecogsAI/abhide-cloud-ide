// Starter file templates. Files are stored as a flat array — paths always start with /.

const LANGUAGE_MAP = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  css: 'css',
  html: 'html',
  json: 'json',
  md: 'markdown',
  svg: 'xml',
};

export function detectLanguage(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  return LANGUAGE_MAP[ext] || 'plaintext';
}

function file(path, content) {
  const name = path.split('/').pop();
  return { name, type: 'file', path, content, language: detectLanguage(name) };
}

function folder(path) {
  return { name: path.split('/').pop(), type: 'folder', path, content: '', language: 'plaintext' };
}

const vanilla = () => [
  file(
    '/index.html',
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vanilla App</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <div id="app">
      <h1>Hello, WebIDE 👋</h1>
      <p>Edit <code>index.js</code> and watch it live-reload.</p>
      <button id="counter">Count: 0</button>
    </div>
    <script type="module" src="/index.js"></script>
  </body>
</html>
`
  ),
  file(
    '/index.js',
    `let count = 0;
const btn = document.getElementById('counter');

btn.addEventListener('click', () => {
  count++;
  btn.textContent = \`Count: \${count}\`;
});
`
  ),
  file(
    '/style.css',
    `* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, sans-serif;
  background: #0a0a0c;
  color: #e7e7ea;
  display: grid;
  place-items: center;
  min-height: 100vh;
}

#app { text-align: center; }

h1 { margin-bottom: 0.5rem; }

p { color: #9a9aa3; margin-bottom: 1.5rem; }

button {
  background: #6ee7b7;
  color: #0a0a0c;
  border: none;
  padding: 0.6rem 1.4rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

button:hover { opacity: 0.85; }
`
  ),
  file(
    '/package.json',
    `{
  "name": "vanilla-app",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
`
  ),
];

const react = () => [
  file(
    '/package.json',
    `{
  "name": "react-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.0"
  }
}
`
  ),
  file(
    '/vite.config.js',
    `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`
  ),
  file(
    '/index.html',
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`
  ),
  folder('/src'),
  file(
    '/src/main.jsx',
    `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`
  ),
  file(
    '/src/App.jsx',
    `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>React in your browser ⚡</h1>
      <p>Powered by WebContainers — no server, no VM.</p>
      <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
    </div>
  );
}
`
  ),
  file(
    '/src/index.css',
    `* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, sans-serif;
  background: #0a0a0c;
  color: #e7e7ea;
}

.app {
  min-height: 100vh;
  display: grid;
  place-content: center;
  text-align: center;
  gap: 0.75rem;
}

p { color: #9a9aa3; }

button {
  margin: 1rem auto 0;
  background: #6ee7b7;
  color: #0a0a0c;
  border: none;
  padding: 0.6rem 1.4rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

button:hover { opacity: 0.85; }
`
  ),
];

const expressTemplate = () => [
  file(
    '/package.json',
    `{
  "name": "express-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "express": "^4.21.2"
  }
}
`
  ),
  file(
    '/index.js',
    `import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send(\`
    <body style="font-family: system-ui; background: #0a0a0c; color: #e7e7ea; display: grid; place-items: center; min-height: 95vh;">
      <div style="text-align: center;">
        <h1>Express, running in your browser 🚀</h1>
        <p style="color: #9a9aa3;">Try <code style="color: #6ee7b7;">GET /api/hello</code></p>
      </div>
    </body>
  \`);
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from WebContainer!', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`
  ),
];

const empty = () => [
  file(
    '/README.md',
    `# New Project

A blank canvas. Create files from the explorer on the left.

To make something runnable, add a \`package.json\` with a \`dev\` script.
`
  ),
];

const TEMPLATES = { vanilla, react, express: expressTemplate, empty };

export function getTemplateFiles(template) {
  const factory = TEMPLATES[template];
  return factory ? factory() : null;
}
