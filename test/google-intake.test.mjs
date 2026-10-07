import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { RIGHTS, MAX_ENVELOPE, validateEnvelope, decodeEnvelope, safePath, preparePatch, publishPR, collect, request, receiptURL, digest } from '../scripts/google-intake.mjs';
import { pack, upload, status, configuration } from '../scripts/submit.mjs';
const id='a61b044d-265c-4e90-a891-cb64e3b90f6e', target='yvlabs/scripture-workshop';
const git=(repo,args) => execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const envelope = (patch='diff --git a/README.md b/README.md\n',base='a'.repeat(40)) => ({formatVersion:1,submissionId:id,targetRepository:target,baseRevision:base,title:'Synthetic contribution',summary:'Synthetic test fixture; contains no Scripture.',contributor:{name:'Synthetic contributor',contact:'https://example.com/contributor'},rights:RIGHTS,testResults:[{command:'Synthetic fixture',result:'not-run',notes:'No contributor tests were run.'}],patch});
const response = (value,status=200) => ({status,bytes:Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))});
async function fixture(t) {
  const repo=await fs.mkdtemp(path.join(os.tmpdir(),'intake-test-')); t.after(()=>fs.rm(repo,{recursive:true,force:true}));
  git(repo,['init','-b','main']); git(repo,['config','user.name','Synthetic fixture']); git(repo,['config','user.email','fixture@example.com']);
  await fs.writeFile(path.join(repo,'README.md'),'before\n'); await fs.writeFile(path.join(repo,'notes.md'),'synthetic\n');
  git(repo,['add','.']); git(repo,['commit','-m','Synthetic baseline']); const base=git(repo,['rev-parse','HEAD']).trim();
  return {repo,base,patch:()=>git(repo,['diff','--cached','--binary',base])};
}
test('envelope requires exact fields, supported target and public contributor metadata',()=>{
  assert.equal(validateEnvelope(envelope()).submissionId,id);
  for (const value of [{...envelope(),extra:true},{...envelope(),targetRepository:'other/repo'},{...envelope(),rights:'No declaration'},{...envelope(),submissionId:'not-a-uuid'},{...envelope(),baseRevision:'HEAD'},{...envelope(),title:'bad\nmetadata'},{...envelope(),testResults:[]},{...envelope(),contributor:{name:'name',contact:'not-public'}},{...envelope(),patch:'GIT binary patch\n'}]) assert.throws(()=>validateEnvelope(value));
});
test('decode rejects oversized, non-UTF8 and malformed JSON without exposing candidate content',()=>{
  assert.throws(()=>decodeEnvelope(Buffer.alloc(MAX_ENVELOPE+1)),/4 MiB/);
  assert.throws(()=>decodeEnvelope(Buffer.from([0xff])),/UTF-8 JSON/);
  assert.throws(()=>decodeEnvelope(Buffer.from('private-content')),/UTF-8 JSON/);
});
test('paths prohibit traversal, workflows, reserved names and dependency directories',()=>{
  for(const file of ['../x','/x','x\\y','.git/config','.github/workflows/job.yml','nested/.Git/x','node_modules/x','a..','CON.txt','a b','a/'.repeat(9)+'x']) assert.throws(()=>safePath(file));
  for(const file of ['README.md','projects/synthetic/.gitignore','guides/google-submissions.md']) assert.doesNotThrow(()=>safePath(file));
});
test('isolated index validates regular add/update/delete without altering worktree or main index',async t=>{
  const f=await fixture(t); await fs.writeFile(path.join(f.repo,'README.md'),'after\n'); await fs.writeFile(path.join(f.repo,'new.txt'),'new\n'); await fs.unlink(path.join(f.repo,'notes.md')); git(f.repo,['add','.']);
  const beforeIndex=await fs.readFile(path.join(f.repo,'.git/index')), head=git(f.repo,['rev-parse','HEAD']);
  const prepared=await preparePatch(f.repo,envelope(f.patch(),f.base));
  assert.equal(prepared.changes.length,3); assert.equal(prepared.changes.find(c=>c.path==='new.txt').content.toString(),'new\n'); assert.equal(prepared.changes.find(c=>c.path==='notes.md').sha,null);
  assert.deepEqual(await fs.readFile(path.join(f.repo,'.git/index')),beforeIndex); assert.equal(git(f.repo,['rev-parse','HEAD']),head); assert.equal(await fs.readFile(path.join(f.repo,'README.md'),'utf8'),'after\n');
});
test('stale ancestor is accepted; unknown or non-ancestor base is rejected',async t=>{
  const f=await fixture(t); await fs.writeFile(path.join(f.repo,'README.md'),'after\n'); git(f.repo,['add','.']); const diff=f.patch(); git(f.repo,['commit','-m','Trusted next baseline']);
  assert.equal((await preparePatch(f.repo,envelope(diff,f.base))).changes.length,1);
  await assert.rejects(preparePatch(f.repo,envelope(diff,'f'.repeat(40))),e=>e.code==='invalid-base');
});
test('workflow changes, symlinks, gitlinks, binary and overlarge changed files are rejected',async t=>{
  for (const kind of ['workflow','symlink','gitlink','binary','oversize','case']) {
    const f=await fixture(t);
    if(kind==='workflow'){await fs.mkdir(path.join(f.repo,'.github'));await fs.writeFile(path.join(f.repo,'.github/test.md'),'synthetic\n');git(f.repo,['add','.']);}
    if(kind==='symlink'){await fs.symlink('README.md',path.join(f.repo,'link'));git(f.repo,['add','.']);}
    if(kind==='gitlink')git(f.repo,['update-index','--add','--cacheinfo',`160000,${f.base},module`]);
    if(kind==='binary'){await fs.writeFile(path.join(f.repo,'data.bin'),Buffer.from([0,1,2]));git(f.repo,['add','.']);}
    if(kind==='oversize'){await fs.writeFile(path.join(f.repo,'big.txt'),'x'.repeat(65537));git(f.repo,['add','.']);}
    if(kind==='case'){const blob=git(f.repo,['rev-parse',`${f.base}:README.md`]).trim();git(f.repo,['update-index','--add','--cacheinfo',`100644,${blob},readme.md`]);}
    await assert.rejects(preparePatch(f.repo,envelope(f.patch(),f.base)),e=>e.name==='SubmissionError',kind);
  }
});
test('bad patch has a bounded rejection and candidate commands or hooks are never executed',async t=>{
  const f=await fixture(t), marker=path.join(f.repo,'executed');
  await fs.writeFile(path.join(f.repo,'.git/hooks/post-applypatch'),`#!/bin/sh\ntouch '${marker}'\n`,{mode:0o755});
  await fs.writeFile(path.join(f.repo,'candidate.sh'),`#!/bin/sh\ntouch '${marker}'\n`); git(f.repo,['add','.']);
  await preparePatch(f.repo,envelope(f.patch(),f.base)); await assert.rejects(fs.stat(marker));
  await assert.rejects(preparePatch(f.repo,envelope('private-content-invalid-patch',f.base)),e=>e.code==='patch-does-not-apply'&&!e.message.includes('private-content'));
});
test('publisher creates Git objects and a credited PR but never invokes candidate code',async t=>{
  const f=await fixture(t);await fs.writeFile(path.join(f.repo,'README.md'),'after\n');git(f.repo,['add','.']); const e=envelope(f.patch(),f.base), prepared=await preparePatch(f.repo,e), calls=[];
  const fake=async(url,options)=>{
    const route=new URL(url).pathname.replace(`/repos/${target}/`,'');calls.push({route,...options});
    if(route.startsWith('git/ref/'))return response({},404);
    if(route==='git/blobs')return response({sha:prepared.changes[0].sha},201);
    if(route==='git/trees'){assert.equal(options.body.base_tree,prepared.baseTree);return response({sha:prepared.treeSha},201);}
    if(route==='git/commits')return response({sha:'b'.repeat(40)},201);
    if(route==='git/refs')return response({},201);
    if(route==='pulls'&&options.method==='GET')return response([]);
    if(route==='pulls'&&options.method==='POST'){assert.match(options.body.body,/self-reported/);assert.match(options.body.body,/not execute/);return response({number:12},201);}
    throw new Error('Unexpected mock call');
  };
  const result=await publishPR(e,prepared,{token:'synthetic-token',submissionSha256:'c'.repeat(64)},{requestImpl:fake});
  assert.equal(result.pullRequestURL,`https://github.com/${target}/pull/12`); assert.equal(calls.filter(c=>c.route==='git/refs').length,1);
});
test('publisher retry reuses matching branch and PR without recreating objects',async t=>{
  const f=await fixture(t);await fs.writeFile(path.join(f.repo,'README.md'),'after\n');git(f.repo,['add','.']); const e=envelope(f.patch(),f.base), prepared=await preparePatch(f.repo,e), hash='c'.repeat(64); let calls=0;
  const fake=async(url,options)=>{calls++;assert.equal(options.method,'GET');const route=new URL(url).pathname;
    if(route.includes('/git/ref/'))return response({object:{sha:'b'.repeat(40)}});
    if(route.includes('/git/commits/'))return response({tree:{sha:prepared.treeSha},parents:[{sha:f.base}],message:`title\n\nSubmission ${id} SHA256 ${hash}`});
    return response([{number:12,head:{ref:`intake/${id}`}}]);};
  assert.equal((await publishPR(e,prepared,{token:'x',submissionSha256:hash},{requestImpl:fake})).pullRequestNumber,12);assert.equal(calls,3);
});
test('collector records invalid submission once and skips its existing receipt',async t=>{
  const f=await fixture(t);let saved,passes=0;
  const fake=async(url,options)=>{
    const u=new URL(url);
    if(u.pathname.endsWith('/o')){if(options.method==='POST'){if(!u.searchParams.get('name').startsWith('state/'))saved=options.body;return response({},200);}return response({items:[{name:`incoming/scripture-workshop/${id}.json`,size:'20'}]});}
    if(u.pathname.includes('/state%2F'))return response({},404);
    if(u.pathname.includes('/receipts%2F'))return response({},passes?200:404);
    if(u.searchParams.has('alt'))return response('invalid-private-content');
    throw new Error('Unexpected mock call');
  };
  const opts={repo:f.repo,repository:target,intakeBucket:'synthetic-intake',receiptsBucket:'synthetic-receipts',googleToken:'x',githubToken:'y'};
  assert.equal((await collect(opts,{requestImpl:fake}))[0].status,'rejected');assert.equal(saved.code,'invalid-envelope');assert.ok(!saved.message.includes('private-content'));
  passes++;assert.deepEqual(await collect(opts,{requestImpl:fake}),[]);
});
test('pack writes exclusive JSON, anonymous uploader has no token and status distinguishes pending',async t=>{
  const f=await fixture(t), m=envelope();const metadata={...m};for(const key of ['formatVersion','submissionId','patch'])delete metadata[key];
  const meta=path.join(f.repo,'metadata.json'),diff=path.join(f.repo,'patch.diff'),out=path.join(f.repo,'envelope.json');await fs.writeFile(meta,JSON.stringify(metadata));await fs.writeFile(diff,m.patch);
  const packed=await pack(meta,diff,out);assert.equal(packed.sha256,digest(await fs.readFile(out)));await assert.rejects(pack(meta,diff,out),/EEXIST/);
  const received=await upload(out,'synthetic-intake','synthetic-receipts',{requestImpl:async(url,options)=>{assert.equal(options.token,undefined);assert.equal(new URL(url).searchParams.get('ifGenerationMatch'),'0');return response({},200);}});
  assert.equal(received.status,'received');assert.equal(received.receiptURL,receiptURL('synthetic-receipts',packed.submissionId,target));
  assert.equal((await status(id,target,'synthetic-receipts',{requestImpl:async()=>response({},404)})).status,'pending');
});
test('configuration validates the exact public bucket schema',async t=>{
  const f=await fixture(t),file=path.join(f.repo,'submission-config.json'),value={formatVersion:1,intakeBucket:'synthetic-intake',receiptsBucket:'synthetic-receipts',targetRepository:target,pollIntervalMinutes:15};
  await fs.writeFile(file,JSON.stringify(value));assert.deepEqual(await configuration(file),value);
  await fs.writeFile(file,JSON.stringify({...value,extra:1}));await assert.rejects(configuration(file));
});
test('HTTP helper restricts credential destinations and refuses redirects',async()=>{
  await assert.rejects(request('https://example.com/steal',{token:'not-real'}),/origin/);
  const result=await request('https://storage.googleapis.com/synthetic',{token:'not-real',fetchImpl:async(url,options)=>{assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);assert.equal(options.headers.Authorization,'Bearer not-real');return new Response('{}',{status:200});}});assert.equal(result.status,200);
});

test('HTTP response bounds reject a remote oversized body',async()=>{
  await assert.rejects(request('https://storage.googleapis.com/synthetic',{limit:8,fetchImpl:async()=>new Response('123456789')}),/bound/);
});
test('collector cursor advances past completed pages and eventually wraps',async t=>{
  const f=await fixture(t), ids=Array.from({length:1001},(_,i)=>`${i.toString(16).padStart(8,'0')}-265c-4e90-a891-cb64e3b90f6e`), items=ids.map(x=>({name:`incoming/scripture-workshop/${x}.json`,size:'10'}));
  let state=null,generation=0;
  const fake=async(url,options)=>{
    const u=new URL(url),name=u.searchParams.get('name');
    if(u.pathname.endsWith('/o')){
      if(options.method==='POST'){assert.ok(name.startsWith('state/'));assert.equal(u.searchParams.get('ifGenerationMatch'),String(generation));state=options.body;generation++;return response({},200);}
      let start=u.searchParams.get('startOffset'),filtered=items.filter(x=>!start||x.name>=start),offset=Number(u.searchParams.get('pageToken')||0),page=filtered.slice(offset,offset+100);
      return response({items:page,...(offset+100<filtered.length?{nextPageToken:String(offset+100)}:{})});
    }
    if(u.pathname.includes('/state%2F'))return state ? (u.searchParams.has('alt')?response(state):response({generation:String(generation)})) : response({},404);
    if(u.pathname.includes('/receipts%2F'))return response({},200);
    throw new Error('Unexpected mock call');
  };
  const options={repo:f.repo,repository:target,intakeBucket:'synthetic-intake',receiptsBucket:'synthetic-receipts',googleToken:'x',githubToken:'y'};
  await collect(options,{requestImpl:fake});assert.equal(state.lastInspected,items[999].name);
  await collect(options,{requestImpl:fake});assert.equal(state.lastInspected,null);
});
test('possible credentials in changed content are rejected before publication',async t=>{
  const f=await fixture(t);await fs.writeFile(path.join(f.repo,'credential.txt'),'-----BEGIN PRIVATE KEY-----\nsynthetic\n');git(f.repo,['add','.']);
  await assert.rejects(preparePatch(f.repo,envelope(f.patch(),f.base)),e=>e.code==='possible-credential');
});

test('small patch to an existing blob larger than the envelope bound receives an oversized-file rejection',async t=>{
  const f=await fixture(t), tail='synthetic text\n'.repeat(350000), filename=path.join(f.repo,'large.txt');
  assert.ok(Buffer.byteLength(tail)>MAX_ENVELOPE);
  await fs.writeFile(filename,'before\n'+tail);git(f.repo,['add','.']);git(f.repo,['commit','-m','Trusted existing large text fixture']);const base=git(f.repo,['rev-parse','HEAD']).trim();
  await fs.writeFile(filename,'after\n'+tail);git(f.repo,['add','.']);const diff=git(f.repo,['diff','--cached',base]);assert.ok(Buffer.byteLength(diff)<1000);
  await assert.rejects(preparePatch(f.repo,envelope(diff,base)),error=>error.name==='SubmissionError'&&error.code==='oversized-file');
});
