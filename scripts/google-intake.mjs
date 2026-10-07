import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const RIGHTS = "I have permission to publish these files under their stated licenses and offer my original contributions under this repository's contribution licenses.";
export const TARGETS = ['yvlabs/scripture-for-everyone', 'yvlabs/scripture-workshop'];
export const MAX_ENVELOPE = 4 * 1024 * 1024;
const MAX_PATCH = 2 * 1024 * 1024, MAX_FILE = 65536, MAX_FILES = 200;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA = /^[a-f0-9]{40}$/;
const POSSIBLE_CREDENTIAL = /-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/;
const PRIVATE_KEY_DELIMITER = /^\s*-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----\s*$/;
export class SubmissionError extends Error {
  constructor(code, message) { super(message); this.name = 'SubmissionError'; this.code = code; }
}
function check(value, code, message) { if (!value) throw new SubmissionError(code, message); }
function exact(value, keys) {
  check(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), 'invalid-envelope', 'Unexpected submission fields.');
}
function text(value, max) { check(typeof value === 'string' && value.trim().length && value.length <= max && value.isWellFormed() && !/[\u0000-\u001f\u007f]/u.test(value), 'invalid-envelope', 'Invalid submission metadata.'); }
export const digest = value => createHash('sha256').update(value).digest('hex');
export function targetSlug(target) {
  check(TARGETS.includes(target), 'invalid-target', 'Unsupported target repository.'); return target.split('/')[1];
}
export function objectName(id, target, prefix = 'incoming') {
  check(UUID.test(id), 'invalid-id', 'Invalid submission ID.');
  check(['incoming', 'receipts'].includes(prefix), 'invalid-envelope', 'Invalid object prefix.');
  return `${prefix}/${targetSlug(target)}/${id}.json`;
}
export function bucketName(name) { check(typeof name === 'string' && /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(name) && !name.includes('..'), 'invalid-configuration', 'Invalid bucket name.'); return name; }
export function receiptURL(bucket, id, target) { return `https://storage.googleapis.com/${bucketName(bucket)}/${objectName(id, target, 'receipts')}`; }
export function validateEnvelope(value) {
  exact(value, ['formatVersion','submissionId','targetRepository','baseRevision','title','summary','contributor','rights','testResults','patch']);
  check(value.formatVersion === 1, 'invalid-envelope', 'Unsupported submission format.');
  objectName(value.submissionId, value.targetRepository);
  check(SHA.test(value.baseRevision), 'invalid-base', 'Base revision must be a full commit SHA.');
  text(value.title, 160); text(value.summary, 4000);
  exact(value.contributor, ['name','contact']); text(value.contributor.name, 120); text(value.contributor.contact, 500);
  check(/^(https:\/\/[^\s]+|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(value.contributor.contact), 'invalid-envelope', 'Contributor contact must be a public HTTPS URL or email.');
  check(value.rights === RIGHTS, 'invalid-rights', 'The contribution rights declaration is required.');
  check(Array.isArray(value.testResults) && value.testResults.length >= 1 && value.testResults.length <= 20, 'invalid-envelope', 'Include 1–20 test results.');
  for (const test of value.testResults) {
    exact(test, ['command','result','notes']); text(test.command, 1000); text(test.notes, 2000);
    check(['passed','failed','not-run'].includes(test.result), 'invalid-envelope', 'Invalid test result.');
  }
  check(typeof value.patch === 'string' && value.patch.isWellFormed() && value.patch.length > 0 && !value.patch.includes('\0') && Buffer.byteLength(value.patch) <= MAX_PATCH, 'invalid-patch', 'A bounded UTF-8 git diff is required.');
  check(!/^GIT binary patch$|^Binary files /m.test(value.patch), 'binary-patch', 'Binary patches are not supported.');
  return value;
}
export function decodeEnvelope(bytes) {
  check(bytes.length <= MAX_ENVELOPE, 'oversized-envelope', 'Submission exceeds 4 MiB.');
  try { return validateEnvelope(JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes))); }
  catch (error) { if (error instanceof SubmissionError) throw error; throw new SubmissionError('invalid-envelope', 'Submission must be UTF-8 JSON.'); }
}
export async function readEnvelope(file) {
  const stat = await fs.lstat(file);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.size <= MAX_ENVELOPE, 'invalid-envelope', 'Submission must be a bounded regular JSON file.');
  return decodeEnvelope(await fs.readFile(file));
}
export function safePath(value) {
  check(typeof value === 'string' && value.length <= 240 && !value.includes('\\'), 'unsafe-path', 'Unsupported file path.');
  const parts = value.split('/');
  check(parts.length <= 8 && parts.every(p => /^\.?[A-Za-z0-9][A-Za-z0-9._-]*$/.test(p) && !/[. ]$/.test(p)), 'unsafe-path', 'Unsupported file path.');
  check(parts.every(p => !['.git','.github','node_modules','vendor','staging'].includes(p.toLowerCase()) && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p)), 'unsafe-path', 'This POC does not accept workflow, Git metadata, dependency cache, or reserved paths.');
}
async function git(repo, args, {input, index} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args], {
      cwd: repo, env: {...process.env, GIT_CONFIG_NOSYSTEM:'1', GIT_CONFIG_GLOBAL:'/dev/null', ...(index ? {GIT_INDEX_FILE:index} : {})}, stdio:['pipe','pipe','pipe']
    });
    const out = []; let size = 0, killed = false;
    const timer = setTimeout(() => { killed=true; child.kill('SIGKILL'); },15000);
    child.stdout.on('data', chunk => { size += chunk.length; if (size > MAX_ENVELOPE) { killed = true; child.kill(); } else out.push(chunk); });
    // Git errors can contain candidate-controlled filenames or patch lines; never expose them.
    child.stderr.resume(); child.on('error', () => { clearTimeout(timer); reject(new Error('Trusted Git operation could not start.')); });
    child.on('close', code => { clearTimeout(timer); code === 0 && !killed ? resolve(Buffer.concat(out)) : reject(new Error('Trusted Git operation failed.')); });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
// A credential test literal is not newly submitted if its complete source line
// remains unchanged at the same path in both the base and pinned trusted main.
// Compare canonical Git hunks, not contributor-provided added-line claims.
async function unchangedCredentialLines(repo, revision, index, file, lines, flagged) {
  const entry = (await git(repo, ['ls-tree','-z',revision,'--',file])).toString('utf8');
  const match = /^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/.exec(entry);
  if (!match || match[3] !== file) return false;
  const size = Number((await git(repo, ['cat-file','-s',match[2]])).toString().trim());
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_FILE) return false;
  const before = await git(repo, ['cat-file','blob',match[2]]);
  let original;
  try { original = new TextDecoder('utf-8', {fatal:true}).decode(before).split('\n'); } catch { return false; }
  if (before.includes(0)) return false;
  const diff = (await git(repo, ['diff','--cached','--no-ext-diff','--no-textconv','--no-renames','--text','--unified=0','--diff-algorithm=histogram','--no-indent-heuristic',revision,'--',file], {index})).toString('utf8');
  const hunks = [];
  for (const line of diff.split('\n')) {
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk) continue;
    const oldCount = Number(hunk[2] ?? 1), newCount = Number(hunk[4] ?? 1);
    hunks.push({oldStart:Number(hunk[1]) - (oldCount ? 1 : 0), oldCount, newStart:Number(hunk[3]) - (newCount ? 1 : 0), newCount});
  }
  for (const candidate of flagged) {
    let oldCursor = 0, newCursor = 0, altered = false;
    for (const hunk of hunks) {
      if (candidate < hunk.newStart) break;
      if (candidate < hunk.newStart + hunk.newCount) { altered = true; break; }
      oldCursor = hunk.oldStart + hunk.oldCount; newCursor = hunk.newStart + hunk.newCount;
    }
    if (altered || original[oldCursor + candidate - newCursor] !== lines[candidate]) return false;
  }
  return true;
}
async function checkCredentials(repo, revisions, index, file, content) {
  const lines = content.toString('utf8').split('\n'), flagged = [];
  for (let i = 0; i < lines.length; i++) if (POSSIBLE_CREDENTIAL.test(lines[i])) flagged.push(i);
  if (!flagged.length) return;
  // An unchanged standalone BEGIN header could acquire newly submitted key
  // material underneath it. Keep those headers blocked even in trusted files.
  const safe = !flagged.some(i => PRIVATE_KEY_DELIMITER.test(lines[i]));
  check(safe, 'possible-credential','Remove possible private keys or access tokens before submitting.');
  for (const revision of new Set(revisions)) {
    check(await unchangedCredentialLines(repo, revision, index, file, lines, flagged), 'possible-credential','Remove possible private keys or access tokens before submitting.');
  }
}
export async function preparePatch(repo, envelope) {
  validateEnvelope(envelope);
  let trustedHead;
  try {
    trustedHead = (await git(repo, ['rev-parse','HEAD'])).toString().trim();
    check(SHA.test(trustedHead), 'invalid-base', 'Trusted main revision is unavailable.');
    await git(repo, ['cat-file','-e',`${envelope.baseRevision}^{commit}`]);
    await git(repo, ['merge-base','--is-ancestor',envelope.baseRevision,trustedHead]);
  } catch { throw new SubmissionError('invalid-base', 'Base revision is unavailable or is not an ancestor of trusted main. Refresh the public clone.'); }
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scripture-intake-')), index = path.join(tmp, 'index');
  try {
    await git(repo, ['read-tree',envelope.baseRevision], {index});
    try {
      await git(repo, ['apply','--cached','--check','--whitespace=nowarn','-'], {index,input:envelope.patch});
      await git(repo, ['apply','--cached','--whitespace=nowarn','-'], {index,input:envelope.patch});
    } catch { throw new SubmissionError('patch-does-not-apply', 'Patch does not apply cleanly to its base revision.'); }
    const raw = (await git(repo, ['diff','--cached','--raw','-z','--no-renames',envelope.baseRevision], {index})).toString('utf8').split('\0');
    const changes = []; let total = 0;
    for (let i = 0; i < raw.length - 1; i += 2) {
      const fields = /^:(\d{6}) (\d{6}) ([a-f0-9]+) ([a-f0-9]+) ([AMD])$/.exec(raw[i]);
      check(fields, 'unsupported-change', 'Unsupported patch operation.');
      const [, oldMode, mode, , , status] = fields, file = raw[i + 1]; safePath(file);
      check([oldMode,mode].every(m => ['000000','100644','100755'].includes(m)), 'unsupported-mode', 'Only regular text files are accepted; no symlinks or submodules.');
      check(changes.length < MAX_FILES, 'too-many-files', 'Submission changes more than 200 files.');
      if (status === 'D') { changes.push({path:file,mode:oldMode,sha:null}); continue; }
      const sha = (await git(repo, ['rev-parse',`:${file}`], {index})).toString().trim();
      const fileSize = Number((await git(repo, ['cat-file','-s',sha])).toString().trim());
      check(Number.isSafeInteger(fileSize) && fileSize >= 0 && fileSize <= MAX_FILE, 'oversized-file', 'A changed file exceeds 64 KiB.');
      const content = await git(repo, ['cat-file','blob',sha]);
      check(content.length <= MAX_FILE, 'oversized-file', 'A changed file exceeds 64 KiB.'); total += content.length;
      check(total <= MAX_PATCH, 'oversized-content', 'Changed file content exceeds 2 MiB.');
      try { new TextDecoder('utf-8', {fatal:true}).decode(content); } catch { throw new SubmissionError('binary-file','Only UTF-8 text files are supported.'); }
      check(!content.includes(0), 'binary-file','Only UTF-8 text files are supported.');
      await checkCredentials(repo, [envelope.baseRevision,trustedHead], index, file, content);
      changes.push({path:file,mode,sha,content});
    }
    check(changes.length > 0, 'empty-patch', 'Patch has no file changes.');
    const tracked = (await git(repo, ['ls-files','-z'], {index})).toString('utf8').split('\0').filter(Boolean);
    const seen = new Set();
    for (const name of tracked) { const key = name.toLowerCase(); check(!seen.has(key), 'path-collision','Submission results in case-colliding paths.'); seen.add(key); }
    for (const key of seen) { const parts=key.split('/'); parts.pop(); while(parts.length) { check(!seen.has(parts.join('/')), 'path-collision','Submission results in a file/directory path collision.'); parts.pop(); } }
    return {changes, treeSha:(await git(repo, ['write-tree'], {index})).toString().trim(), baseTree:(await git(repo, ['rev-parse',`${envelope.baseRevision}^{tree}`])).toString().trim()};
  } finally { await fs.rm(tmp,{recursive:true,force:true}); }
}
export async function boundedResponse(response, limit) {
  const chunks = []; let length = 0;
  if (!response.body) return Buffer.alloc(0);
  for await (const chunk of response.body) { length += chunk.length; if (length > limit) { await response.body.cancel().catch(() => {}); throw new Error('Remote response exceeded its bound.'); } chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
export async function request(url, {token,method='GET',body,limit=MAX_ENVELOPE,fetchImpl=fetch} = {}) {
  const parsed = new URL(url);
  if (!['https://storage.googleapis.com','https://api.github.com'].includes(parsed.origin)) throw new Error('Unsupported API origin.');
  const headers = {'Accept':parsed.hostname === 'api.github.com' ? 'application/vnd.github+json' : 'application/json'};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
  if (parsed.hostname === 'api.github.com') { headers['X-GitHub-Api-Version']='2022-11-28'; headers['User-Agent']='scripture-google-intake'; }
  const response = await fetchImpl(url,{method,headers,body:body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});
  return {status:response.status,bytes:await boundedResponse(response,limit)};
}
function json(response) { try { return JSON.parse(response.bytes.toString('utf8')); } catch { throw new Error('API returned an invalid JSON response.'); } }
export async function publishPR(envelope, prepared, github, {requestImpl=request} = {}) {
  const repo = envelope.targetRepository, branch = `intake/${envelope.submissionId}`, marker = `Submission ${envelope.submissionId} SHA256 ${github.submissionSha256}`;
  const api = async (route,method='GET',body) => requestImpl(`https://api.github.com/repos/${repo}/${route}`,{token:github.token,method,body});
  let head; const existing = await api(`git/ref/heads/${branch}`);
  if (existing.status === 200) {
    head = json(existing).object.sha; check(SHA.test(head),'invalid-remote','Invalid remote branch.');
    const commit = await api(`git/commits/${head}`); if (commit.status !== 200) throw new Error('Cannot inspect existing intake commit.');
    const data = json(commit);
    check(data.tree.sha === prepared.treeSha && data.parents.length === 1 && data.parents[0].sha === envelope.baseRevision && data.message.endsWith(marker), 'branch-collision','Submission branch already contains different work.');
  } else {
    if (existing.status !== 404) throw new Error('Cannot inspect intake branch.');
    const entries = [];
    for (const change of prepared.changes) {
      let sha = null;
      if (change.content) {
        const blob = await api('git/blobs','POST',{content:change.content.toString('base64'),encoding:'base64'});
        if (blob.status !== 201) throw new Error('Cannot publish intake blob.'); sha = json(blob).sha;
        check(sha === change.sha,'invalid-remote','Published content hash differs.');
      }
      entries.push({path:change.path,mode:change.mode,type:'blob',sha});
    }
    const tree = await api('git/trees','POST',{base_tree:prepared.baseTree,tree:entries});
    if (tree.status !== 201) throw new Error('Cannot publish intake tree.');
    check(json(tree).sha === prepared.treeSha,'invalid-remote','Published tree differs from validated patch.');
    const commit = await api('git/commits','POST',{message:`${envelope.title}\n\n${marker}`,tree:prepared.treeSha,parents:[envelope.baseRevision]});
    if (commit.status !== 201) throw new Error('Cannot publish intake commit.'); head = json(commit).sha;
    check(SHA.test(head),'invalid-remote','Invalid published commit.');
    const ref = await api('git/refs','POST',{ref:`refs/heads/${branch}`,sha:head});
    if (ref.status !== 201) throw new Error('Cannot create intake branch.');
  }
  const pulls = await api(`pulls?state=all&head=${encodeURIComponent(`yvlabs:${branch}`)}&base=main&per_page=10`);
  if (pulls.status !== 200) throw new Error('Cannot inspect intake pull request.');
  let pr = json(pulls).find(p => p.head?.ref === branch);
  if (!pr) {
    // Escaped JSON keeps contributor statements as quoted data rather than workflow instructions.
    const facts = JSON.stringify({submissionId:envelope.submissionId,submissionSha256:github.submissionSha256,baseRevision:envelope.baseRevision,summary:envelope.summary,contributor:envelope.contributor,rights:envelope.rights,testResults:envelope.testResults},null,2).replace(/[<>`]/g,c => `\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`);
    const body = `Received through the anonymous Google upload POC. Contributor identity and test results are self-reported. Trusted intake validated the patch format and file bounds; it did not execute candidate files or test commands. Maintainer review is required.\n\n\`\`\`json\n${facts}\n\`\`\`\n`;
    const created = await api('pulls','POST',{title:`Google submission: ${envelope.title}`,head:branch,base:'main',body});
    if (created.status !== 201) throw new Error('Cannot create intake pull request.'); pr = json(created);
  }
  check(Number.isSafeInteger(pr.number) && pr.number > 0,'invalid-remote','Invalid pull request number.');
  return {pullRequestNumber:pr.number,pullRequestURL:`https://github.com/${repo}/pull/${pr.number}`,headRevision:head};
}
function gcsObjectURL(bucket,name,media=false) { return `https://storage.googleapis.com/storage/v1/b/${bucketName(bucket)}/o/${encodeURIComponent(name)}${media ? '?alt=media' : ''}`; }
export async function collect({repo,repository, intakeBucket,receiptsBucket,googleToken,githubToken,limit=10}, {requestImpl=request} = {}) {
  targetSlug(repository); bucketName(intakeBucket); bucketName(receiptsBucket);
  check(Number.isInteger(limit) && limit > 0 && limit <= 10,'invalid-configuration','Collector limit must be 1–10.');
  if (!googleToken || !githubToken) throw new Error('Collector credentials are unavailable.');
  const prefix = `incoming/${targetSlug(repository)}/`, results = [], stateName = `state/${targetSlug(repository)}.json`;
  let pageToken, inspected = 0, startingName, lastName, stopped = false, stateGeneration='0';
  const stateMeta = await requestImpl(gcsObjectURL(receiptsBucket,stateName),{token:googleToken,limit:65536});
  if (stateMeta.status === 200) {
    stateGeneration = json(stateMeta).generation;
    if (typeof stateGeneration !== 'string' || !/^\d+$/.test(stateGeneration)) throw new Error('Invalid collector state generation.');
    const stateBody = await requestImpl(`${gcsObjectURL(receiptsBucket,stateName,true)}&generation=${stateGeneration}`,{token:googleToken,limit:65536});
    if (stateBody.status !== 200) throw new Error('Cannot read collector state.');
    const state = json(stateBody);
    if (state.formatVersion !== 1 || (state.lastInspected !== null && (typeof state.lastInspected !== 'string' || state.lastInspected.length > 1024 || !state.lastInspected.startsWith(prefix)))) throw new Error('Invalid collector state.');
    startingName=state.lastInspected || undefined;
  } else if (stateMeta.status !== 404) throw new Error('Cannot inspect collector state.');
  do {
    const url = new URL(`https://storage.googleapis.com/storage/v1/b/${intakeBucket}/o`);
    url.searchParams.set('prefix',prefix); url.searchParams.set('maxResults','100'); if(startingName) url.searchParams.set('startOffset',startingName); if (pageToken) url.searchParams.set('pageToken',pageToken);
    const listing = await requestImpl(url.href,{token:googleToken}); if (listing.status !== 200) throw new Error('Cannot list Google intake objects.');
    const data = json(listing);
    for (const item of data.items || []) {
      if (inspected >= 1000 || results.length >= limit) { stopped=true; break; }
      const name = item.name; if (typeof name !== 'string' || !name.startsWith(prefix) || name === startingName) continue;
      inspected++; lastName=name;
      const id = name.slice(prefix.length,-5); if (!name.endsWith('.json') || !UUID.test(id) || objectName(id,repository) !== name) continue;
      const statusName = objectName(id,repository,'receipts');
      const prior = await requestImpl(gcsObjectURL(receiptsBucket,statusName),{token:googleToken,limit:65536});
      if (prior.status === 200) continue; if (prior.status !== 404) throw new Error('Cannot inspect submission receipt.');
      let status;
      try {
        check(/^\d+$/.test(String(item.size)) && Number(item.size) <= MAX_ENVELOPE,'oversized-envelope','Submission exceeds 4 MiB.');
        const downloaded = await requestImpl(gcsObjectURL(intakeBucket,name,true),{token:googleToken,limit:MAX_ENVELOPE});
        if (downloaded.status !== 200) throw new Error('Cannot download Google submission.');
        const envelope = decodeEnvelope(downloaded.bytes);
        check(envelope.submissionId === id && envelope.targetRepository === repository,'object-mismatch','Submission metadata does not match its object path.');
        const prepared = await preparePatch(repo,envelope);
        const published = await publishPR(envelope,prepared,{token:githubToken,submissionSha256:digest(downloaded.bytes)},{requestImpl});
        status = {formatVersion:1,submissionId:id,targetRepository:repository,status:'imported',submissionSha256:digest(downloaded.bytes),...published,processedAt:new Date().toISOString(),message:'A pull request was created. Candidate code and contributor test commands were not executed. Follow the public pull request for review feedback.'};
      } catch (error) {
        if (!(error instanceof SubmissionError)) throw error;
        status = {formatVersion:1,submissionId:id,targetRepository:repository,status:'rejected',code:error.code,message:error.message,processedAt:new Date().toISOString()};
      }
      const receipt = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${receiptsBucket}/o`);
      receipt.searchParams.set('uploadType','media'); receipt.searchParams.set('name',statusName); receipt.searchParams.set('ifGenerationMatch','0');
      const saved = await requestImpl(receipt.href,{token:googleToken,method:'POST',body:status,limit:65536});
      if (![200,201,412].includes(saved.status)) throw new Error('Cannot save Google submission receipt.');
      results.push({submissionId:id,status:status.status,...(status.pullRequestURL ? {pullRequestURL:status.pullRequestURL} : {code:status.code})});
    }
    pageToken = data.nextPageToken;
  } while (pageToken && inspected < 1000 && results.length < limit);
  const state = {formatVersion:1,lastInspected:stopped || pageToken ? lastName || startingName || null : null,updatedAt:new Date().toISOString()};
  const stateURL = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${receiptsBucket}/o`);
  stateURL.searchParams.set('uploadType','media'); stateURL.searchParams.set('name',stateName); stateURL.searchParams.set('ifGenerationMatch',stateGeneration);
  const written = await requestImpl(stateURL.href,{token:googleToken,method:'POST',body:state,limit:65536});
  if (![200,201].includes(written.status)) throw new Error('Cannot update collector state; retry without advancing unprocessed work.');
  return results;
}
async function main() {
  if (process.argv[2] !== 'collect') throw new Error('Usage: google-intake.mjs collect');
  const results = await collect({repo:process.cwd(),repository:process.env.GITHUB_REPOSITORY,intakeBucket:process.env.GCS_INTAKE_BUCKET,receiptsBucket:process.env.GCS_RECEIPTS_BUCKET,googleToken:process.env.GOOGLE_ACCESS_TOKEN,githubToken:process.env.GITHUB_TOKEN});
  console.log(JSON.stringify({processed:results.length,results}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => { console.error('Google intake failed. No candidate commands were executed; check trusted configuration and service access.'); process.exitCode=1; });
