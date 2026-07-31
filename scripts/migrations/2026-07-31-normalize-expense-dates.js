const fs=require('fs');const {createRequire}=require('module');
const breq=createRequire('/Users/gil/Stuff/Projects/sokin/backend/package.json');
const {initializeApp,cert}=breq('firebase-admin/app');
const {getAuth}=breq('firebase-admin/auth');const {getFirestore}=breq('firebase-admin/firestore');
for(const line of fs.readFileSync('/Users/gil/Stuff/Projects/sokin/backend/.env','utf8').split('\n')){
  const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m)process.env[m[1]]=m[2].replace(/^"|"$/g,'');}
initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n'),clientEmail:process.env.FIREBASE_CLIENT_EMAIL}),projectId:process.env.FIREBASE_PROJECT_ID});
const APPLY = process.argv.includes('--apply');
(async()=>{
  const db=getFirestore();
  const snap=await db.collection('expenses').get();
  const plan=[];
  snap.forEach(doc=>{
    const x=doc.data(); const v=x.date;
    if(typeof v==='string' && v.length>10) return;            // already canonical ISO
    let iso=null, kind=null;
    if(v && typeof v==='object' && typeof v.toDate==='function'){ iso=v.toDate().toISOString(); kind='Timestamp'; }
    else if(typeof v==='string' && v.length===10){ iso=new Date(`${v}T12:00:00.000Z`).toISOString(); kind='date-only'; }
    else { plan.push({id:doc.id,kind:'UNHANDLED:'+typeof v,from:String(v),to:null}); return; }
    plan.push({id:doc.id,userId:x.userId,kind,from:(kind==='Timestamp'?v.toDate().toISOString():v),to:iso,name:x.name});
  });
  const bad=plan.filter(p=>!p.to);
  console.log(`docs scanned: ${snap.size}`);
  console.log(`docs to rewrite: ${plan.length - bad.length}   unhandled: ${bad.length}`);
  const byKind={}; plan.forEach(p=>byKind[p.kind]=(byKind[p.kind]||0)+1);
  console.log('by kind:',byKind);
  console.log('--- sample (first 5) ---');
  plan.slice(0,5).forEach(p=>console.log(`  ${p.kind.padEnd(10)} ${String(p.name).slice(0,22).padEnd(24)} ${p.from}  ->  ${p.to}`));
  if(bad.length){ console.log('UNHANDLED SHAPES PRESENT - aborting'); process.exit(1); }
  if(!APPLY){ console.log('\nDRY RUN. No writes performed. Re-run with --apply to write.'); process.exit(0); }
  const backupPath='/private/tmp/claude-501/-Users-gil-Stuff-Projects-sokin/63133a44-ec5d-4c6b-807f-3b0714d4b964/scratchpad/date-backup.json';
  fs.writeFileSync(backupPath, JSON.stringify(plan,null,1));
  console.log('rollback record written:',backupPath);
  let n=0;
  for(let i=0;i<plan.length;i+=400){
    const batch=db.batch();
    plan.slice(i,i+400).forEach(p=>batch.update(db.collection('expenses').doc(p.id),{date:p.to}));
    await batch.commit(); n+=Math.min(400,plan.length-i);
  }
  console.log(`APPLIED: ${n} documents rewritten`);
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
