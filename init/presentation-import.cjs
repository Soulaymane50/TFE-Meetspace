// Import ponctuel de présentation. Aucun seed automatique ni changement de schéma.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {build,overlap}=require('./presentation-build.cjs');
const repo=path.resolve(__dirname,'..'),batch='presentation-sept-nov-2026-v1';
const cache=path.join(repo,'tools/backups',batch),mode=process.argv[2]||'plan';
const db=new URL((process.env.DB_URL||'').replace(/^jdbc:/,''));
if(!process.env.DB_USERNAME||!process.env.DB_PASSWORD)throw Error('Configuration de base requise.');
const mysql=path.join(repo,'tools/mysql-8.0.45-winx64/bin/mysql.exe');
const args=['--protocol=TCP','--host='+db.hostname,'--port='+(db.port||3306),'--user='+process.env.DB_USERNAME];
const env={...process.env,MYSQL_PWD:process.env.DB_PASSWORD};
function sql(text) {
  const r=spawnSync(mysql,[...args,'--database='+db.pathname.slice(1),'--default-character-set=utf8mb4','--batch','--raw','--skip-column-names'],{input:text,encoding:'utf8',maxBuffer:32*1024*1024,env});
  if(r.status!==0)throw Error((r.stderr||'Échec MySQL').replaceAll(process.env.DB_PASSWORD,'[masqué]'));
  return r.stdout.trim();
}
const q=v=>v===null||v===undefined?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll('\\','\\\\').replaceAll("'","''")+"'";
function rows(table,columns,where='1=1') {
  const out=sql('SELECT JSON_OBJECT('+columns.flatMap(c=>[q(c),c]).join(',')+') FROM '+table+' WHERE '+where+';');
  return out?out.split(/\r?\n/).map(JSON.parse):[];
}
function snapshot() {
  return {rooms:rows('espace',['id','name','type','capacity','base_price','status']),
    events:rows('event',['id','space_id','start_date_time','end_date_time','status'],"start_date_time>='2026-09-01' AND start_date_time<'2026-12-01'"),
    roomsBooked:rows('espace_reservation',['id','espace_id','start_date_time','end_date_time','status'],"start_date_time>='2026-09-01' AND start_date_time<'2026-12-01'"),
    parking:rows('parking_slot',['id','session_date','start_time','end_time','capacity','status'],"session_date>='2026-09-01' AND session_date<'2026-12-01'")};
}
function validate(data,s) {
  const blocks=s.events.filter(e=>!['REJECTED','CANCELLED'].includes(e.status)).map(e=>({id:'event:'+e.id,room:e.space_id,start:e.start_date_time.replace('T',' ').slice(0,19),end:e.end_date_time.replace('T',' ').slice(0,19)}))
    .concat(s.roomsBooked.filter(e=>!['REJECTED','CANCELLED'].includes(e.status)).map(e=>({id:'room:'+e.id,room:e.espace_id,start:e.start_date_time.replace('T',' ').slice(0,19),end:e.end_date_time.replace('T',' ').slice(0,19)})));
  for(const e of data.tables.event.concat(data.tables.espace_reservation).filter(e=>!['REJECTED','CANCELLED'].includes(e.status))) {
    const block={id:e.id,room:e.space_id||e.espace_id,start:e.start_date_time,end:e.end_date_time};
    const conflict=blocks.find(b=>b.room===block.room&&overlap(b,block));if(conflict)throw Error('Conflit de salle '+e.id+' / '+conflict.id);
    blocks.push(block);
  }
  for(const [table,list] of Object.entries(data.tables)) {
    if(!list.length)continue;
    if(Number(sql('SELECT COUNT(*) FROM '+table+' WHERE id IN ('+list.map(r=>r.id).join(',')+');')))throw Error('Identifiants déjà utilisés : '+table);
  }
  for(const e of data.tables.event) {
    const count=data.tables.event_registration.filter(r=>r.event_id===e.id&&r.status==='CONFIRMED').reduce((n,r)=>n+r.number_of_participants,0);
    if(count>e.capacity||(count&&e.status!=='PUBLISHED'))throw Error('Capacité ou publication invalide.');
  }
  if(Number(sql('SELECT capacity FROM parking_inventory WHERE id=1'))!==150)throw Error('Inventaire parking différent de 150.');
  if(Number(sql("SELECT COUNT(*) FROM utilisateur WHERE id IN (9001,1112,1113,9101,9010,9011,9012,9014) AND status='ACTIVE'"))!==8)throw Error('Compte de présentation indisponible.');
}
function key() {
  const k=process.env.STRIPE_SECRET_KEY||process.env.STRIPE_API_KEY;
  if(!k||!/^(sk|rk)_test_/.test(k))throw Error('Stripe TEST obligatoire : les clés LIVE sont refusées.');
  return k;
}
async function stripe(route,body,idempotency) {
  for(let attempt=0;attempt<4;attempt++) {
    let response;
    try {
      response=await fetch('https://api.stripe.com/v1/'+route,{method:'POST',headers:{Authorization:'Bearer '+key(),'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':idempotency},body:new URLSearchParams(body),signal:AbortSignal.timeout(30000)});
    } catch {
      if(attempt===3)throw Error('Connexion Stripe interrompue ; reprise possible avec le cache existant.');
      await new Promise(r=>setTimeout(r,2000*(attempt+1)));continue;
    }
    const value=await response.json();
    if(response.ok)return value;
    if((response.status===429||response.status>=500)&&attempt<3){await new Promise(r=>setTimeout(r,1000*(attempt+1)));continue;}
    throw Error('Stripe '+response.status+' : '+(value.error?.code||value.error?.type||'requête refusée'));
  }
}
async function prepare(data) {
  key();fs.mkdirSync(cache,{recursive:true});const ids={},queue=[...data.payments];let done=0;
  async function worker() {
    while(queue.length) {
      const p=queue.shift(),file=path.join(cache,'payment-'+p.id+'.json');
      let record=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
      if(record&&(record.amount!==p.amount||record.user!==p.user||record.resource!==p.resource||record.type!==p.type))throw Error('Cache de paiement incompatible.');
      if(!record) {
        const result=await stripe('payment_intents',{amount:String(p.amount),currency:'eur',confirm:'true',payment_method:'pm_card_visa','payment_method_types[]':'card',description:'MeetSpace — présentation fictive — '+p.type,'metadata[presentation_batch]':batch,'metadata[userId]':String(p.user),'metadata[reservationType]':p.type,'metadata[resourceId]':String(p.resource)},batch+'-'+p.id+'-'+p.amount);
        if(result.livemode!==false||result.status!=='succeeded'||result.amount!==p.amount)throw Error('Paiement test non confirmé.');
        record={...p,intent:result.id,refundDone:false};fs.writeFileSync(file,JSON.stringify(record),'utf8');
      }
      if(p.refunded&&!record.refundDone) {
        const refund=await stripe('refunds',{payment_intent:record.intent,amount:String(p.amount)},batch+'-refund-'+p.id);
        if(refund.status!=='succeeded')throw Error('Remboursement test non confirmé.');
        record.refundDone=true;fs.writeFileSync(file,JSON.stringify(record),'utf8');
      }
      ids[p.id]=record.intent;if(++done%100===0)console.log('Stripe TEST : '+done+'/'+data.payments.length+' paiements préparés.');
    }
  }
  await Promise.all(Array.from({length:4},worker));return ids;
}
function backup() {
  fs.mkdirSync(cache,{recursive:true});const file=path.join(cache,'before-import-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sql');
  const r=spawnSync(path.join(path.dirname(mysql),'mysqldump.exe'),[...args,'--single-transaction','--no-tablespaces','--set-gtid-purged=OFF','--column-statistics=0',db.pathname.slice(1)],{encoding:'utf8',maxBuffer:64*1024*1024,env});
  if(r.status!==0)throw Error('Sauvegarde impossible : import interrompu.');
  fs.writeFileSync(file,r.stdout,'utf8');console.log('Sauvegarde avant import enregistrée hors Git.');
}
const insert=(table,list)=>list.length?'INSERT INTO '+table+' ('+Object.keys(list[0]).join(',')+') VALUES\n'+list.map(row=>'('+Object.values(row).map(q).join(',')+')').join(',\n')+';\n':'';
function commitSql(data,ids) {
  const checks=[
    "SELECT IF(COUNT(*)=0,1,0) FROM event a JOIN event b ON a.id<b.id AND a.space_id=b.space_id AND a.start_date_time<b.end_date_time AND b.start_date_time<a.end_date_time WHERE (a.id BETWEEN 16000 AND 16099 OR b.id BETWEEN 16000 AND 16099) AND a.status NOT IN ('REJECTED','CANCELLED') AND b.status NOT IN ('REJECTED','CANCELLED')",
    "SELECT IF(COUNT(*)=0,1,0) FROM event e JOIN espace_reservation r ON e.space_id=r.espace_id AND e.start_date_time<r.end_date_time AND r.start_date_time<e.end_date_time WHERE (e.id BETWEEN 16000 AND 16099 OR r.id BETWEEN 300000 AND 300099) AND e.status NOT IN ('REJECTED','CANCELLED') AND r.status NOT IN ('REJECTED','CANCELLED')",
    "SELECT IF(COUNT(*)=0,1,0) FROM espace_reservation a JOIN espace_reservation b ON a.id<b.id AND a.espace_id=b.espace_id AND a.start_date_time<b.end_date_time AND b.start_date_time<a.end_date_time WHERE (a.id BETWEEN 300000 AND 300099 OR b.id BETWEEN 300000 AND 300099) AND a.status NOT IN ('REJECTED','CANCELLED') AND b.status NOT IN ('REJECTED','CANCELLED')",
    "SELECT IF(COUNT(*)=0,1,0) FROM (SELECT p.id,SUM(r.reserved_spaces) occupied FROM parking_slot p JOIN parking_slot s ON p.session_date=s.session_date AND p.start_time<s.end_time AND s.start_time<p.end_time JOIN parking_reservation r ON r.parking_slot_id=s.id AND r.status='CONFIRMED' WHERE p.session_date IN (SELECT DATE(start_date_time) FROM event WHERE id BETWEEN 16000 AND 16099) AND p.status='OPEN' AND s.status='OPEN' GROUP BY p.id HAVING occupied>150) excess",
    "SELECT IF(COUNT(*)=0,1,0) FROM (SELECT e.id FROM event e JOIN event_registration r ON r.event_id=e.id AND r.status='CONFIRMED' WHERE e.id BETWEEN 16000 AND 16099 GROUP BY e.id,e.capacity HAVING SUM(r.number_of_participants)>e.capacity) excess",
  ];
  let query="SET NAMES utf8mb4; START TRANSACTION; SELECT id FROM parking_inventory WHERE id=1 FOR UPDATE; SELECT id FROM espace WHERE id BETWEEN 1 AND 8 ORDER BY id FOR UPDATE; CREATE TEMPORARY TABLE presentation_assertion (ok INT NOT NULL CHECK(ok=1));\n";
  query+="INSERT INTO presentation_assertion SELECT IF(COUNT(*)=1,1,0) FROM utilisateur WHERE id=9001;\n";
  for(const u of data.tables.utilisateur)query+='INSERT INTO utilisateur ('+Object.keys(u).join(',')+',password_hash) SELECT '+Object.values(u).map(q).join(',')+',password_hash FROM utilisateur WHERE id=9001;\n';
  for(const [table,list] of Object.entries(data.tables)) {
    if(table==='utilisateur')continue;
    const resolved=list.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,k.endsWith('payment_intent_id')&&v!==null?ids[v]:v])));
    query+=insert(table,resolved);
  }
  for(const check of checks)query+='INSERT INTO presentation_assertion '+check+';\n';
  return query+"COMMIT; SELECT 'IMPORT_PRESENTATION_OK';";
}
function verify() {
  console.log(sql("SELECT 'clients',COUNT(*) FROM utilisateur WHERE id BETWEEN 12000 AND 12179; SELECT 'events',status,COUNT(*) FROM event WHERE id BETWEEN 16000 AND 16099 GROUP BY status; SELECT 'registrations',status,COUNT(*),SUM(number_of_participants) FROM event_registration WHERE id BETWEEN 200000 AND 299999 GROUP BY status; SELECT 'parking-pass',status,COUNT(*) FROM parking_access_pass WHERE id BETWEEN 500000 AND 599999 GROUP BY status; SELECT 'payments',type,status,COUNT(*) FROM payment_record WHERE id BETWEEN 600000 AND 699999 GROUP BY type,status; SELECT 'room-bookings',status,COUNT(*) FROM espace_reservation WHERE id BETWEEN 300000 AND 300099 GROUP BY status; SELECT 'waitlist',COUNT(*) FROM event_waitlist WHERE id BETWEEN 900000 AND 909999; SELECT 'missing-ticket',COUNT(*) FROM event_registration WHERE id BETWEEN 200000 AND 299999 AND (ticket_token IS NULL OR LENGTH(ticket_token)<24); SELECT 'main-client-tickets',COUNT(*) FROM event_registration WHERE utilisateur_id=1113 AND id BETWEEN 200000 AND 299999;"));
}
async function main() {
  if(mode==='verify'){verify();return;}
  if(!['plan','dry-run','apply'].includes(mode))throw Error('Mode attendu : plan, dry-run, apply ou verify.');
  const existing=Number(sql('SELECT COUNT(*) FROM event WHERE id BETWEEN 16000 AND 16099'));
  if(existing){if(existing!==42)throw Error('Lot partiel détecté : inspection nécessaire.');console.log('Lot déjà présent : aucune réécriture.');verify();return;}
  const state=snapshot(),data=build(state.rooms,state.parking);validate(data,state);
  const report={batch,counts:Object.fromEntries(Object.entries(data.tables).map(([k,v])=>[k,v.length])),calendar:data.tables.event.map(e=>({id:e.id,title:e.title,start:e.start_date_time,end:e.end_date_time,room:e.location,status:e.status,capacity:e.capacity,price:e.price,participants:data.tables.event_registration.filter(r=>r.event_id===e.id&&r.status==='CONFIRMED').reduce((n,r)=>n+r.number_of_participants,0)}))};
  fs.mkdirSync(cache,{recursive:true});fs.writeFileSync(path.join(cache,'plan.json'),JSON.stringify(report,null,2),'utf8');console.log(JSON.stringify(report.counts,null,2));
  if(mode==='plan'){console.log('Stripe test configuré : '+Boolean(process.env.STRIPE_SECRET_KEY&&/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY)));return;}
  if(mode==='dry-run') {
    const ids=Object.fromEntries(data.payments.map(p=>[p.id,'pi_validation_annulee_'+p.id]));
    console.log(sql(commitSql(data,ids).replace("COMMIT; SELECT 'IMPORT_PRESENTATION_OK';", "ROLLBACK; SELECT 'VALIDATION_ANNULEE_OK';")));
    return;
  }
  key();backup();const ids=await prepare(data);validate(data,snapshot());
  const query=commitSql(data,ids);fs.writeFileSync(path.join(cache,'import.sql'),query,'utf8');console.log(sql(query));verify();
}
main().catch(e=>{console.error(e.message.replaceAll(process.env.DB_PASSWORD,'[masqué]'));process.exitCode=1;});
