import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { MAX_ENVELOPE, validateEnvelope, readEnvelope, bucketName, objectName, receiptURL, request, digest, targetSlug } from './google-intake.mjs';

export async function pack(metadataFile,patchFile,outputFile) {
  for (const [file,max] of [[metadataFile,65536],[patchFile,2*1024*1024]]) {
    const stat = await fs.lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > max) throw new Error('Metadata and patch must be bounded regular files.');
  }
  const metadata = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await fs.readFile(metadataFile)));
  const patch = new TextDecoder('utf-8',{fatal:true}).decode(await fs.readFile(patchFile));
  const envelope = validateEnvelope({...metadata,formatVersion:1,submissionId:randomUUID(),patch});
  const body = JSON.stringify(envelope,null,2)+'\n'; if (Buffer.byteLength(body) > MAX_ENVELOPE) throw new Error('Envelope exceeds 4 MiB.');
  await fs.writeFile(outputFile,body,{flag:'wx',mode:0o600}); return {submissionId:envelope.submissionId,targetRepository:envelope.targetRepository,sha256:digest(body)};
}
export async function upload(file,intakeBucket,receiptsBucket,{requestImpl=request} = {}) {
  bucketName(intakeBucket); bucketName(receiptsBucket);
  const envelope = await readEnvelope(file), bytes = await fs.readFile(file);
  const url = new URL(`https://storage.googleapis.com/upload/storage/v1/b/${intakeBucket}/o`);
  url.searchParams.set('uploadType','media'); url.searchParams.set('name',objectName(envelope.submissionId,envelope.targetRepository)); url.searchParams.set('ifGenerationMatch','0');
  const response = await requestImpl(url.href,{method:'POST',body:bytes.toString('utf8'),limit:65536});
  if (response.status === 412) throw new Error('Submission object already exists. Check its receipt; use a new UUID for new work.');
  if (![200,201].includes(response.status)) throw new Error(`Google upload failed (HTTP ${response.status}).`);
  return {submissionId:envelope.submissionId,status:'received',submissionSha256:digest(bytes),receiptURL:receiptURL(receiptsBucket,envelope.submissionId,envelope.targetRepository),message:'Upload accepted. Receipt may return 404 while awaiting collection. No GitHub connection was used.'};
}
export async function status(id,target,receiptsBucket,{requestImpl=request} = {}) {
  const url = receiptURL(receiptsBucket,id,target), response = await requestImpl(url,{limit:65536});
  if (response.status === 404) return {submissionId:id,status:'pending',receiptURL:url,message:'No processed receipt yet. If upload succeeded, await the next collector run.'};
  if (response.status !== 200) throw new Error(`Cannot read receipt (HTTP ${response.status}).`);
  return JSON.parse(response.bytes.toString('utf8'));
}
export async function configuration(file = path.join(process.cwd(),'submission-config.json')) {
  const value = JSON.parse(await fs.readFile(file,'utf8'));
  const keys = ['formatVersion','intakeBucket','receiptsBucket','targetRepository','pollIntervalMinutes'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value,key)) || value.formatVersion !== 1 || value.pollIntervalMinutes !== 15) throw new Error('Invalid submission configuration.');
  bucketName(value.intakeBucket); bucketName(value.receiptsBucket); targetSlug(value.targetRepository); return value;
}
async function main() {
  const [command,...args] = process.argv.slice(2);
  if (command === 'pack' && args.length === 3) console.log(JSON.stringify(await pack(...args),null,2));
  else if (command === 'upload' && [1,3].includes(args.length)) {
    const config = args.length === 1 ? await configuration() : null;
    console.log(JSON.stringify(await upload(args[0],config?.intakeBucket || args[1],config?.receiptsBucket || args[2]),null,2));
  }
  else if (command === 'status' && [1,3].includes(args.length)) {
    const config = args.length === 1 ? await configuration() : null;
    console.log(JSON.stringify(await status(args[0],config?.targetRepository || args[1],config?.receiptsBucket || args[2]),null,2));
  }
  else throw new Error('Usage: submit.mjs pack METADATA.json PATCH.diff OUTPUT.json | upload PACKAGE.json [INTAKE_BUCKET RECEIPTS_BUCKET] | status UUID [TARGET_REPOSITORY RECEIPTS_BUCKET]');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode=1; });
