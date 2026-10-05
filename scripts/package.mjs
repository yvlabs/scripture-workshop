import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const RIGHTS = 'I have permission to publish these files under their stated licenses and offer my original contributions under MIT.';
const MAX_FILE = 65536, MAX_TOTAL = 2097152, MAX_PACKAGE = 4194304, MAX_FILES = 200;
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
function check(ok, message) { if (!ok) throw new Error(message); }
function object(value, keys) {
  check(value && typeof value === 'object' && !Array.isArray(value), 'Expected object');
  check(Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), `Expected exactly: ${keys.join(', ')}`);
}
function text(value, max = 2000) {
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value), 'Invalid metadata text');
}
function contact(value) { text(value, 500); check(/^(https:\/\/[^\s]+|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(value), 'Expected public HTTPS contact or email'); }
function person(value) { object(value, ['name', 'contact']); text(value.name, 120); contact(value.contact); }
export const hash = content => createHash('sha256').update(content, 'utf8').digest('hex');
export function validateProject(m, expectedId) {
  object(m, ['id','purpose','status','directoryUrl','maintainer','license','maintenance','testCommand','buildCommand']);
  check(typeof m.id === 'string' && m.id.length <= 64 && idPattern.test(m.id) && m.id === expectedId, 'Project ID mismatch/invalid');
  for (const k of ['purpose','maintenance','testCommand','buildCommand']) text(m[k]);
  check(['prototype','example','active','paused','graduated','retired'].includes(m.status), 'Invalid project status');
  check(m.directoryUrl === null || /^https:\/\/github\.com\/yvlabs\/scripture-for-everyone\/(blob\/main\/efforts\/[a-z0-9-]+\.yaml|issues\/[1-9][0-9]*)$/.test(m.directoryUrl), 'Invalid mission record URL');
  person(m.maintainer); check(m.license === 'MIT', 'Original contribution license must be MIT');
}
export function safePath(value) {
  check(typeof value === 'string' && value.length <= 240, 'Invalid file path');
  const parts = value.split('/');
  check(parts.length <= 8 && parts.every(p => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(p) || p === '.gitignore'), 'Unsafe file path');
  check(parts.every(p => !/[. ]$/.test(p) && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p) && !['node_modules','vendor','staging'].includes(p.toLowerCase())), 'Reserved file path');
}
function metadata(p) {
  check(p.formatVersion === 1, 'Unsupported package version');
  check(typeof p.projectId === 'string' && p.projectId.length <= 64 && idPattern.test(p.projectId), 'Invalid project ID');
  check(p.baseRevision === null || /^[a-f0-9]{40}$/.test(p.baseRevision), 'baseRevision must be null or full commit SHA');
  person(p.contributor); check(p.rights === RIGHTS, 'Missing contribution rights declaration');
  check(Array.isArray(p.testResults) && p.testResults.length > 0 && p.testResults.length <= 20, 'Expected 1–20 test results');
  for (const t of p.testResults) {
    object(t, ['command','result','notes']); text(t.command); text(t.notes);
    check(['passed','failed','not-run'].includes(t.result), 'Invalid test result');
  }
}
export function validatePackage(p) {
  object(p, ['formatVersion','projectId','baseRevision','contributor','rights','testResults','files']); metadata(p);
  check(Array.isArray(p.files) && p.files.length >= 3 && p.files.length <= MAX_FILES, 'Expected 3–200 files');
  const seen = new Set(); let total = 0;
  for (const f of p.files) {
    object(f, ['path','sha256','content']); safePath(f.path);
    const key = f.path.toLowerCase(); check(!seen.has(key), 'Duplicate/case-colliding file path'); seen.add(key);
    check(typeof f.content === 'string' && f.content.isWellFormed() && !f.content.includes('\0'), 'Only well-formed UTF-8 text is supported');
    const bytes = Buffer.byteLength(f.content); total += bytes;
    check(bytes <= MAX_FILE && total <= MAX_TOTAL, 'File/package content too large');
    check(/^[a-f0-9]{64}$/.test(f.sha256) && f.sha256 === hash(f.content), 'Content hash mismatch');
    check(!/-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/.test(f.content), 'Possible credential: remove before submission');
  }
  for (const key of seen) for (const other of seen) check(!other.startsWith(key + '/'), 'File/directory path collision');
  for (const required of ['project.json','README.md','LICENSE']) check(p.files.some(f => f.path === required), `Missing ${required}`);
  validateProject(JSON.parse(p.files.find(f => f.path === 'project.json').content), p.projectId);
  return p;
}
async function readBounded(file, limit) {
  const stat = await fs.lstat(file); check(stat.isFile() && !stat.isSymbolicLink() && stat.size <= limit, 'Expected bounded regular file');
  const bytes = await fs.readFile(file); check(bytes.length <= limit, 'File too large');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
export async function readPackage(file) { return validatePackage(JSON.parse(await readBounded(file, MAX_PACKAGE))); }
export async function pack(directory, meta) {
  object(meta, ['formatVersion','projectId','baseRevision','contributor','rights','testResults']); metadata(meta);
  const root = await fs.lstat(directory); check(root.isDirectory() && !root.isSymbolicLink(), 'Expected regular project directory');
  const files = []; let total = 0;
  async function walk(dir, prefix = '') {
    for (const entry of (await fs.readdir(dir)).sort()) {
      const relative = prefix + entry; safePath(relative);
      const full = path.join(dir, entry), stat = await fs.lstat(full);
      check(!stat.isSymbolicLink(), 'Symlinks are not supported');
      if (stat.isDirectory()) await walk(full, relative + '/');
      else {
        check(files.length < MAX_FILES && stat.size <= MAX_FILE, 'Too many/large files');
        total += stat.size; check(total <= MAX_TOTAL, 'Project too large');
        const content = await readBounded(full, MAX_FILE); files.push({path: relative, sha256: hash(content), content});
      }
    }
  }
  await walk(directory); return validatePackage({...meta, files});
}
export async function stage(p, destination) {
  validatePackage(p);
  // mkdir without recursive is intentional: an existing destination is never trusted.
  await fs.mkdir(destination, { mode: 0o700 });
  try {
    for (const f of p.files) {
      const target = path.join(destination, f.path);
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await fs.writeFile(target, f.content, { flag: 'wx', mode: 0o600 });
    }
  } catch (error) { await fs.rm(destination, { recursive: true, force: true }); throw error; }
}
async function repository(directory) {
  await pack(path.join(directory, 'templates/project'), JSON.parse(await readBounded(path.join(directory, 'examples/submission-metadata.json'), MAX_FILE)));
  for (const name of await fs.readdir(path.join(directory, 'projects'))) {
    if (name === 'README.md') continue;
    const project = path.join(directory, 'projects', name);
    const m = JSON.parse(await readBounded(path.join(project, 'project.json'), MAX_FILE));
    validateProject(m, name);
    await pack(project, {formatVersion:1, projectId:name, baseRevision:null, contributor:m.maintainer, rights:RIGHTS, testResults:[{command:'Structure validation only',result:'not-run',notes:'Project commands are never executed by repository validation.'}]});
  }
}
async function main() {
  const [command, input, second, third] = process.argv.slice(2);
  if (command === 'validate' && input) { await readPackage(input); console.log('Valid package; code and contributor test claims not executed or verified.'); }
  else if (command === 'pack' && input && second && third) {
    const p = await pack(input, JSON.parse(await readBounded(second, MAX_FILE)));
    const output = JSON.stringify(p, null, 2) + '\n'; check(Buffer.byteLength(output) <= MAX_PACKAGE, 'Serialized package too large');
    await fs.writeFile(third, output, { flag: 'wx', mode: 0o600 }); console.log('Package written.');
  } else if (command === 'stage' && input && second) { await stage(await readPackage(input), second); console.log('Staged for inspection; no commands executed.'); }
  else if (command === 'repository' && input) { await repository(input); console.log('Project structure valid; no project code executed.'); }
  else throw new Error('Usage: package.mjs validate FILE | pack PROJECT METADATA OUTPUT | stage FILE NEW_DIRECTORY | repository ROOT');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
