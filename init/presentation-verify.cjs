// Contrôle API du jeu de présentation, sans créer de réservation ou paiement.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const api='https://tfe-meetspace-production.up.railway.app',repo=path.resolve(__dirname,'..');
const password=process.env.PRESENTATION_PASSWORD||fs.readFileSync(path.join(repo,'README.md'),'utf8').match(/set E2E_ADMIN_PASSWORD=([^\r\n]+)/)?.[1];
if(!password)throw Error('Mot de passe de démonstration requis.');
async function call(route,token,body,expected=200) {
  const start=Date.now();
  const r=await fetch(api+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
  assert.equal(r.status,expected,route.replace(/pi_[^/]+/,'[paiement]')+' : statut inattendu');
  console.log(r.status+' '+route.replace(/pi_[^/]+/,'[paiement]')+' ('+(Date.now()-start)+' ms)');
  return r.status===200?await r.json():null;
}
async function login(email) {
  const value=await call('/api/auth/login',null,{email,password});
  assert(value.token);return value.token;
}
async function main() {
  const list=await call('/api/public/events'),added=list.filter(e=>e.id>=16000&&e.id<16100);
  const {catalog}=require('./presentation-catalog.cjs');
  // Le serveur Railway utilise UTC ; les créneaux passés quittent le catalogue public.
  const now=new Date().toISOString().slice(0,19).replace('T',' ');
  const expectedIds=catalog().filter(e=>e.status==='PUBLISHED'&&e.start>now).map(e=>e.id).sort((a,b)=>a-b);
  assert.deepEqual(added.map(e=>e.id).sort((a,b)=>a-b),expectedIds,'Événements publics conformes au calendrier actuel');
  assert(added.every(e=>e.registeredCount<=e.capacity&&e.parkingAvailableSpaces>=0&&e.physicalParkingCapacity===150));
  const detail=await call('/api/public/events/16001');
  assert.equal(detail.availablePlaces,0,'Atelier complet');
  await call('/api/public/events/16038',null,null,404);
  const parking=await call('/api/public/parking/sessions');assert(Array.isArray(parking));
  const client=await login('amelie.mertens@gmail.com');
  const tickets=await call('/api/public/events/registrations/me',client);
  assert(tickets.some(r=>r.id>=200000&&r.ticketToken?.length>=24));
  const vehicles=await call('/api/public/parking/reservations/me',client);
  assert(vehicles.some(r=>r.accessPasses?.length===r.reservedSpaces));
  await call('/api/admin/events',client,null,403);
  const organizer=await login('clemence.delaunay@outlook.com');
  const my=await call('/api/organizer/events/my',organizer);assert(my.some(e=>e.id>=16000));
  await call('/api/organizer/events/my/16001/attendees',organizer);
  await call('/api/organizer/events/my/16000/attendees',organizer,null,403);
  const admin=await login('nora.jacquet@hotmail.com');
  const pending=await call('/api/admin/events/pending',admin);
  assert.equal(pending.filter(e=>e.id>=16000&&e.id<16100).length,3);
  const cache=path.join(repo,'tools/backups/presentation-sept-nov-2026-v1');
  const record=fs.readdirSync(cache).filter(f=>/^payment-\d+\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(cache,f),'utf8'))).find(p=>p.user===12000&&!p.refunded);
  assert(record);const verified=await call('/api/payments/verify/'+record.intent,client);
  assert(verified.success);assert.equal(verified.amount,record.amount);
  console.log('VERIFICATION_API_OK '+JSON.stringify({futureEvents:added.length,clientTickets:tickets.length,clientParking:vehicles.length,organizerEvents:my.length,pendingExamples:3}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
