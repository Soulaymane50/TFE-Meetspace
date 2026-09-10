const {randomBytes} = require('node:crypto');
const {catalog,clients}=require('./presentation-catalog.cjs');
const stamp=d=>d.toISOString().slice(0,19).replace('T',' ');
const shift=(d,h)=>stamp(new Date(new Date(d.replace(' ','T')+'Z').getTime()+h*3600000));
const overlap=(a,b)=>a.start<b.end&&b.start<a.end;
function build(rooms,existingSlots,now=stamp(new Date())) {
  const t=Object.fromEntries(['utilisateur','event','parking_slot','event_registration','parking_reservation','parking_access_pass','espace_reservation','booking_hold','payment_record','event_waitlist','user_notification','audit_log'].map(k=>[k,[]]));
  const payments=[],events=catalog(),roomMap=new Map(rooms.map(r=>[r.id,r]));
  let rid=200000,prid=400000,pid=600000,passid=500000,nid=910000;
  t.utilisateur=clients().map(u=>({...u,status:'ACTIVE',created_at:'2026-07-01 09:00:00',token_version:0}));
  function payment(type,user,amount,resource,entity,created,refunded=false,quantity=1,secondary=null,secondaryQty=0,start=null,end=null) {
    if(!amount)return null;
    const id=pid++;
    payments.push({id,type,user,amount,resource,refunded});
    t.booking_hold.push({id:id+200000,token:randomBytes(24).toString('hex'),user_id:user,type,resource_id:resource,secondary_resource_id:secondary,quantity,secondary_quantity:secondaryQty,start_at:start,end_at:end,amount_cents:amount,status:'CONSUMED',expires_at:shift(created,1),created_at:created,version:0});
    t.payment_record.push({id,payment_intent_id:id,user_id:user,type,amount_cents:amount,currency:'eur',status:refunded?'REFUNDED':'CONSUMED',resource_id:resource,booking_hold_id:id+200000,booking_entity_id:entity,refunded_amount_cents:refunded?amount:0,created_at:created,updated_at:refunded?shift(created,24):created,consumed_at:created,refunded_at:refunded?shift(created,24):null,version:0});
    return id;
  }
  function park(e,user,quantity,registration,paymentId,created,complimentary=false,used=false) {
    const id=prid++;
    t.parking_reservation.push({id,user_id:user,parking_slot_id:e.id,event_registration_id:registration,reserved_spaces:quantity,total_price:complimentary?0:quantity*e.parkingRate,status:'CONFIRMED',version:0,payment_intent_id:paymentId,created_at:created,complimentary:complimentary?1:0});
    for(let i=0;i<quantity;i++)t.parking_access_pass.push({id:passid++,parking_reservation_id:id,token:randomBytes(24).toString('hex'),status:used?'USED':'ACTIVE',checked_in_at:used?e.start:null,checked_in_by:used?9001:null,created_at:created,version:0});
  }
  for(const e of events) {
    const room=roomMap.get(e.room);
    if(!room||room.status!=='AVAILABLE'||e.capacity>room.capacity)throw Error('Salle incompatible : '+e.id);
    e.hours=(Date.parse(e.end.replace(' ','T')+'Z')-Date.parse(e.start.replace(' ','T')+'Z'))/3600000;
    e.parkingRate=e.hours>=7&&room.capacity>=300?15:e.hours>=4||room.capacity>=300?12:8;
    e.created=e.id>=16038?now:shift('2026-08-01 09:00:00',(e.id%12)*24);
    const approved=['PUBLISHED','AWAITING_DEPOSIT'].includes(e.status);
    const approvedAt=approved?(e.status==='AWAITING_DEPOSIT'?now:shift(e.created,20)):null;
    const cost=approved?Math.round(room.base_price*e.hours*(e.hours>=8?.85:e.hours>=4?.92:1)*100):0,deposit=Math.round(cost*.3),balance=cost-deposit;
    e.depositAt=e.status==='PUBLISHED'?shift(approvedAt,1):null;
    const balanceAt=e.paidBalance?shift(e.depositAt,24):null;
    const depositPay=e.depositAt?payment('EVENT_DEPOSIT',e.owner,deposit,e.id,null,e.depositAt):null;
    const balancePay=balanceAt?payment('EVENT_BALANCE',e.owner,balance,e.id,null,balanceAt):null;
    if(e.price===0)e.description+=' Participation gratuite, financée par l’organisateur.';
    t.event.push({id:e.id,title:e.title,description:e.description,start_date_time:e.start,end_date_time:e.end,location:room.name,location_type:'EXISTING_SPACE',space_id:e.room,capacity:e.capacity,price:e.price,status:e.status,version:0,created_by:e.owner,created_at:e.created,approved_at:approvedAt,approved_by:approved?9001:null,rejection_reason:e.status==='REJECTED'?'Programme et modalités d’accueil à préciser.':null,parking_required:1,room_cost_cents:cost,deposit_amount_cents:deposit,deposit_payment_intent_id:depositPay,deposit_due_at:approved?shift(approvedAt,48):null,deposit_paid_at:e.depositAt,balance_due_cents:balance,balance_payment_intent_id:balancePay,balance_paid_at:balanceAt,settlement_due_at:approved?shift(e.end,48):null,late_fee_cents:0,payout_amount_cents:0,settlement_status:e.status==='PUBLISHED'?(balanceAt?'BALANCE_PAID':'HOLDING_REVENUE'):e.status==='AWAITING_DEPOSIT'?'AWAITING_DEPOSIT':'NOT_APPLICABLE'});
    t.parking_slot.push({id:e.id,title:'Parking — '+e.title,description:'Parking MeetSpace partagé automatiquement selon les événements qui se chevauchent.',session_date:e.start.slice(0,10),start_time:e.start.slice(11),end_time:e.end.slice(11),capacity:Math.min(150,e.capacity),parking_rate:e.parkingRate,status:e.status==='PUBLISHED'?'OPEN':'CANCELLED',version:0,created_at:e.created,event_id:e.id});
    t.audit_log.push({id:920000+e.id-16000,user_id:e.owner,action:'EVENT_CREATE',entity_type:'Event',entity_id:e.id,details:'Import de présentation fictif septembre–novembre 2026. Paiements exclusivement Stripe TEST.',timestamp:now});
  }
  const allSlots=existingSlots.concat(t.parking_slot).filter(s=>s.status==='OPEN').map(s=>({id:s.id,start:s.session_date+' '+s.start_time,end:s.session_date+' '+s.end_time,weight:Math.min(150,s.capacity)}));
  function allocation(e) {
    const slots=allSlots.filter(s=>overlap(s,e)),sum=slots.reduce((n,s)=>n+s.weight,0);
    if(sum<=150)return Math.min(e.capacity,slots.length===1?100:150);
    const shares=slots.map(s=>({id:s.id,n:Math.floor(150*s.weight/sum),fraction:150*s.weight/sum%1})).sort((a,b)=>b.fraction-a.fraction||a.id-b.id);
    let left=150-shares.reduce((n,s)=>n+s.n,0);shares.forEach(s=>{if(left-->0)s.n++;});
    return shares.find(s=>s.id===e.id).n;
  }
  const occupied=[];let cursor=0;
  for(const e of events.filter(e=>e.status==='PUBLISHED')) {
    const past=e.end<now;park(e,e.owner,1,null,null,e.depositAt,true,past);
    let remaining=e.participants,ordinal=0,parkingLeft=Math.max(0,Math.min(Math.floor(allocation(e)*.65)-1,Math.floor(e.participants*.3)));
    const users=new Set();
    while(remaining>0) {
      let user;
      if(ordinal===0&&e.format===0)user=1113;
      else if(ordinal===0&&e.format===2)user=9101;
      else {let attempts=0;do{user=12000+cursor++%180;if(++attempts>360)throw Error('Pas assez de clients sans chevauchement.');}while(users.has(user)||occupied.some(o=>o.user===user&&overlap(o,e)));}
      if(occupied.some(o=>o.user===user&&overlap(o,e)))throw Error('Chevauchement client '+user);
      users.add(user);occupied.push({...e,user});
      const qty=Math.min(remaining,ordinal%3===0?3:1),vehicles=parkingLeft>0&&(ordinal%3===0||user===1113)?Math.min(qty,parkingLeft):0;
      parkingLeft-=vehicles;
      const id=rid++,created=[shift(e.depositAt,48+(ordinal%12)*24),shift(e.start,-24),shift(now,-24)].sort()[0];
      if(created<e.depositAt)throw Error('Chronologie invalide.');
      const pay=payment('EVENT',user,Math.round((qty*e.price+vehicles*e.parkingRate)*100),e.id,id,created,false,qty,vehicles?e.id:null,vehicles,e.start,e.end);
      t.event_registration.push({id,utilisateur_id:user,event_id:e.id,number_of_participants:qty,total_price:qty*e.price,status:'CONFIRMED',version:0,payment_intent_id:pay,created_at:created,ticket_token:randomBytes(24).toString('hex'),checked_in_at:past&&ordinal%8!==0?e.start:null,checked_in_by:past&&ordinal%8!==0?e.owner:null});
      if(vehicles)park(e,user,vehicles,id,pay,created,false,past&&ordinal%8!==0);
      if([1113,9101].includes(user))t.user_notification.push({id:nid++,user_id:user,tone:'SUCCESS',title:'Inscription confirmée',message:e.title+' : '+qty+' participant(s)'+(vehicles?' et parking réservé.':'.'),path:'/my-reservations?tab=events',source_type:'EventRegistration',source_id:id,created_at:created,read_at:null});
      remaining-=qty;ordinal++;
    }
    if(e.id%3===0&&!past) {
      const user=clients().find(u=>u.role==='MEMBER'&&!users.has(u.id)).id,id=rid++,created=shift(e.depositAt,24);
      const pay=payment('EVENT',user,e.price*100,e.id,id,created,true);
      t.event_registration.push({id,utilisateur_id:user,event_id:e.id,number_of_participants:1,total_price:e.price,status:'CANCELLED',version:0,payment_intent_id:pay,created_at:created,ticket_token:randomBytes(24).toString('hex'),checked_in_at:null,checked_in_by:null});
    }
    if(e.participants===e.capacity)[1113,9101,12178].filter(id=>!users.has(id)).forEach(user=>t.event_waitlist.push({id:900000+t.event_waitlist.length,event_id:e.id,user_id:user,participant_count:1,status:'WAITING',created_at:shift(e.depositAt,16*24),updated_at:shift(e.depositAt,16*24)}));
  }
  const requests=[
    [3,'09-18','09:00','12:00','CONFIRMED',1113,'Réunion de préparation du projet associatif, 12 personnes. Présentation et travail en groupe.'],
    [5,'09-21','14:00','17:00','PENDING_APPROVAL',1113,'Comité de pilotage, 10 adultes. Écran requis ; réunion privée sans billetterie.'],
    [8,'11-23','09:00','13:00','APPROVED',1113,'Assemblée des partenaires, 100 adultes. Présentation, bilan puis questions.'],
    [6,'10-09','10:00','12:00','REJECTED',1113,'Demande à compléter : préciser le programme et le nombre de participants.'],
    [4,'10-02','14:00','17:00','CONFIRMED',12010,'Réunion mensuelle de coordination, 20 personnes, avec projection.'],
    [7,'10-16','09:00','13:00','PENDING_APPROVAL',12020,'Formation interne de 32 personnes ; exercices et support informatique.'],
    [5,'11-06','14:00','17:00','CONFIRMED',9101,'Conseil de direction de 12 personnes ; réunion confidentielle.'],
    [6,'11-20','14:00','17:00','CANCELLED',12030,'Réunion annulée à la demande du client, conservée pour le suivi.'],
  ];
  requests.forEach(([room,date,start,end,status,user,justification],i)=>{
    const r=roomMap.get(room),hours=Number(end.slice(0,2))-Number(start.slice(0,2)),cost=Math.round(r.base_price*hours*(hours>=4?.92:1)*100),id=300000+i,created=shift(now,-48);
    const pay=['CONFIRMED','CANCELLED'].includes(status)?payment(r.type==='PREMIUM_ROOM'?'PREMIUM_ROOM':'SPACE',user,cost,r.type==='PREMIUM_ROOM'?id:room,id,created,status==='CANCELLED',1,null,0,'2026-'+date+' '+start+':00','2026-'+date+' '+end+':00'):null;
    t.espace_reservation.push({id,utilisateur_id:user,espace_id:room,start_date_time:'2026-'+date+' '+start+':00',end_date_time:'2026-'+date+' '+end+':00',total_price:cost/100,status,version:0,payment_intent_id:pay,justification,rejection_reason:status==='REJECTED'?'Programme et effectif à préciser.':null,approved_by:['APPROVED','CONFIRMED'].includes(status)?9001:null,approved_at:['APPROVED','CONFIRMED'].includes(status)?created:null,payment_due_at:status==='APPROVED'?shift(now,48):null,created_at:created});
  });
  t.user_notification.push({id:nid++,user_id:1112,tone:'INFO',title:'Dossier en attente',message:'Le séminaire des partenaires est en attente de validation administrative.',path:'/organizer/events',source_type:'Event',source_id:16040,created_at:now,read_at:null});
  // Présenter un règlement terminé et un solde déduit après 48 h, avec la pénalité existante de 5 %.
  t.event.filter(e=>e.status==='PUBLISHED'&&e.settlement_due_at<now).forEach(e=>{
    const gross=Math.round(e.price*t.event_registration.filter(r=>r.event_id===e.id&&r.status==='CONFIRMED').reduce((n,r)=>n+r.number_of_participants,0)*100);
    const unpaid=e.balance_paid_at?0:e.balance_due_cents;
    e.late_fee_cents=Math.round(unpaid*.05);e.payout_amount_cents=Math.max(0,gross-Math.round(gross*.1)-unpaid-e.late_fee_cents);e.settlement_status='READY_FOR_PAYOUT';
  });
  return {tables:t,payments,now};
}
module.exports={build,overlap,stamp};
