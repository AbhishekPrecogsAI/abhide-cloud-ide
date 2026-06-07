import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import tarStream from 'tar-stream';
import { detectLanguage } from './templates.js';

const MAX_FILES = 400;
const MAX_FILE_SIZE = 200 * 1024; // per file
const MAX_TOTAL_SIZE = 4 * 1024 * 1024; // whole project
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.github', 'dist', 'build', '.next', '.nuxt',
  'coverage', 'vendor', '.cache', '__pycache__',
]);
const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|avif|ico|bmp|psd|woff2?|ttf|otf|eot|zip|gz|tar|rar|7z|mp[34]|wav|ogg|webm|mov|pdf|wasm|exe|dll|so|dylib|jar|class|pyc|lockb)$/i;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Accepts: owner/repo · github.com/owner/repo · https://github.com/owner/repo(.git)
 *  · git@github.com:owner/repo · …/tree/<branch> */
export function parseRepoUrl(input) {
  const cleaned = String(input)
    .trim()
    .replace(/^git@github\.com:/, '')
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\.git$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2 || cleaned.includes(':')) return null;
  const [owner, repo, maybeTree, ...rest] = parts;
  const ref = maybeTree === 'tree' && rest.length ? rest.join('/') : null;
  return { owner, repo, ref };
}

function untar(gzippedBuf) {
  return new Promise((resolve, reject) => {
    const extract = tarStream.extract();
    const out = [];

    extract.on('entry', (header, stream, next) => {
      if (header.type !== 'file') {
        stream.on('end', next);
        stream.resume();
        return;
      }
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => {
        out.push({ name: header.name, content: Buffer.concat(chunks) });
        next();
      });
    });

    extract.on('finish', () => resolve(out));
    extract.on('error', reject);

    Readable.from(gzippedBuf)
      .pipe(zlib.createGunzip())
      .on('error', reject)
      .pipe(extract);
  });
}

/** Convert tar entries → our flat file array (folders + files). */
function entriesToFiles(entries) {
  const files = [];
  const folders = new Set();
  let total = 0;

  for (const e of entries) {
    // tarball paths are "repo-ref/path/to/file" — strip the wrapper dir
    const segs = e.name.split('/').slice(1).filter(Boolean);
    if (!segs.length) continue;
    if (segs.some((s) => SKIP_DIRS.has(s))) continue;

    const path = '/' + segs.join('/');
    if (BINARY_EXT.test(path)) continue;
    if (e.content.length > MAX_FILE_SIZE) continue;
    if (e.content.includes(0)) continue; // binary sniff: null byte

    const content = e.content.toString('utf-8');
    total += content.length;
    files.push({
      name: segs[segs.length - 1],
      type: 'file',
      path,
      content,
      language: detectLanguage(segs[segs.length - 1]),
    });
    for (let i = 1; i < segs.length; i++) {
      folders.add('/' + segs.slice(0, i).join('/'));
    }
  }

  if (!files.length) throw httpError('No importable text files found in that repo', 422);
  if (files.length > MAX_FILES)
    throw httpError(`Repo too large: ${files.length} files (limit ${MAX_FILES})`, 413);
  if (total > MAX_TOTAL_SIZE)
    throw httpError('Repo too large: over 4MB of source text', 413);

  const folderEntries = [...folders].sort().map((p) => ({
    name: p.split('/').pop(),
    type: 'folder',
    path: p,
    content: '',
    language: 'plaintext',
  }));

  return [...folderEntries, ...files];
}

export async function fetchGitHubRepoFiles(repoUrl) {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) throw httpError('Invalid GitHub repo URL', 400);
  let { owner, repo, ref } = parsed;

  // Resolve default branch when none given
  if (!ref) {
    const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { 'User-Agent': 'webide', Accept: 'application/vnd.github+json' },
    });
    if (metaRes.status === 404)
      throw httpError('Repository not found (private repos are not supported)', 404);
    if (metaRes.status === 403)
      throw httpError('GitHub rate limit hit — try again in a few minutes', 429);
    if (!metaRes.ok) throw httpError('GitHub API error', 502);
    ref = (await metaRes.json()).default_branch;
  }

  const tarRes = await fetch(
    `https://codeload.github.com/${owner}/${repo}/tar.gz/${encodeURIComponent(ref)}`
  );
  if (!tarRes.ok)
    throw httpError(`Could not download ${owner}/${repo}@${ref} — check the URL/branch`, 404);

  const buf = Buffer.from(await tarRes.arrayBuffer());
  const entries = await untar(buf);
  return { owner, repo, ref, files: entriesToFiles(entries) };
}
