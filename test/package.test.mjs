import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {pack, readPackage, validatePackage, stage, hash, safePath} from '../scripts/package.mjs';
const root = new URL('../', import.meta.url);
const meta = JSON.parse(await fs.readFile(new URL('examples/submission-metadata.json', root), 'utf8'));
const fixture = await pack(fileURLToPath(new URL('templates/project/', root)), meta);
const copy = () => structuredClone(fixture);
async function temp(t) { const p = await fs.mkdtemp(path.join(os.tmpdir(), 'workshop-test-')); t.after(() => fs.rm(p,{recursive:true,force:true})); return p; }
test('portable JSON round trip stages exact content without executing it', async t => {
  const d = await temp(t), p = copy();
  p.files.push({path:'malicious.mjs',content:'throw new Error("must never run");',sha256:hash('throw new Error("must never run");')});
  await fs.writeFile(path.join(d,'input.json'),JSON.stringify(p));
  await stage(await readPackage(path.join(d,'input.json')),path.join(d,'review'));
  for (const f of p.files) assert.equal(await fs.readFile(path.join(d,'review',f.path),'utf8'),f.content);
  await assert.rejects(stage(p,path.join(d,'review')), /EEXIST/);
});
for (const name of ['../escape','/tmp/escape','x/../../escape','x\\escape','.github/workflows/x.yml','.env','x//y','CON.txt','src/a.','node_modules/a','vendor/a','x/./y']) {
  test(`reject unsafe path ${name}`, () => assert.throws(() => safePath(name)));
}
test('reject tampered contents',()=>{const p=copy();p.files[0].content+='tampered';assert.throws(()=>validatePackage(p),/hash/);});
test('reject case collisions',()=>{const p=copy();p.files.push({...p.files[0],path:p.files[0].path.toLowerCase()});assert.throws(()=>validatePackage(p),/colliding/);});
test('reject file/directory collisions',()=>{const p=copy();p.files.push({path:'README.md/child',content:'x',sha256:hash('x')});assert.throws(()=>validatePackage(p),/collision/);});
test('reject missing required file',()=>{const p=copy();p.files=p.files.filter(f=>f.path!=='LICENSE');assert.throws(()=>validatePackage(p),/LICENSE/);});
test('reject project ID mismatch',()=>{const p=copy();p.projectId='different';assert.throws(()=>validatePackage(p),/mismatch/);});
test('reject invalid base',()=>{const p=copy();p.baseRevision='main';assert.throws(()=>validatePackage(p),/baseRevision/);});
test('reject malformed text',()=>{const p=copy();p.files[0].content='\ud800';assert.throws(()=>validatePackage(p),/UTF-8/);});
test('reject oversized content',()=>{const p=copy();p.files[0].content='a'.repeat(65537);assert.throws(()=>validatePackage(p),/large/);});
test('reject too many files',()=>{const p=copy();p.files=Array(201).fill(p.files[0]);assert.throws(()=>validatePackage(p),/200/);});
test('reject extra executable instruction fields',()=>{const p=copy();p.postImport='run me';assert.throws(()=>validatePackage(p),/exactly/);});
test('reject missing rights',()=>{const p=copy();p.rights='unknown';assert.throws(()=>validatePackage(p),/rights/);});
test('packer rejects symlinks',async t=>{const d=await temp(t);await fs.symlink('/etc/passwd',path.join(d,'external'));await assert.rejects(pack(d,meta),/Symlinks/);});
test('input rejects oversized serialized package',async t=>{const d=await temp(t),p=path.join(d,'huge');await fs.writeFile(p,' '.repeat(4194305));await assert.rejects(readPackage(p),/bounded/);});
test('obvious private keys rejected',()=>{const p=copy(),content='-----BEGIN PRIVATE KEY-----';p.files.push({path:'key.txt',content,sha256:hash(content)});assert.throws(()=>validatePackage(p),/credential/);});
