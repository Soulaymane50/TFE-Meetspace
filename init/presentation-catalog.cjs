// Catalogue de présentation 2026 : personnes fictives et créneaux distincts.
const dates = ['09-08','09-15','09-22','09-29','10-06','10-13','10-20','10-27','11-03','11-10','11-17','11-24'];
const topics = [
  ['Rencontres numériques de la rentrée','Concevoir des interfaces accessibles','Apéro des équipes produit'],
  ['Cybersécurité des PME bruxelloises','Protéger les données de son association','Rencontres des indépendants'],
  ['Forum de la mobilité durable','Cartographier un parcours client','Communautés tech de Bruxelles'],
  ['Journée des métiers de la donnée','Tableaux de bord : passer à la pratique','Premiers pas dans le logiciel libre'],
  ['Entreprendre à Bruxelles en 2026','Préparer son premier budget','Rencontres des créateurs de projets'],
  ['Intelligence artificielle : usages concrets','Écrire des consignes utiles pour une IA','Café numérique ouvert à tous'],
  ['Travailler ensemble autrement','Animer une réunion participative','Rencontres des responsables RH'],
  ['Numérique responsable en entreprise','Réduire le poids de son site web','Retours de terrain des développeurs'],
  ['Commerce local et services numériques','Améliorer son catalogue en ligne','Rencontres des commerces bruxellois'],
  ['Sécurité et confiance dans les services','Construire un plan de continuité','Communauté des équipes support'],
  ['Piloter un projet sans se disperser','Prioriser une feuille de route','Échanges entre chefs de projet'],
  ['Forum des initiatives bruxelloises','Préparer une présentation convaincante','Rencontres de clôture de novembre'],
];
const descriptions = [
  'Une matinée de retours d’expérience, suivie de démonstrations concrètes et d’un échange avec les intervenants. Accueil dès 8 h 45 ; deux pauses sont prévues. Destiné aux professionnels, associations et porteurs de projets.',
  'Un atelier en petit groupe alternant exercices guidés et échanges. Apportez votre ordinateur ; les supports seront disponibles sur place. Aucun matériel spécialisé n’est nécessaire.',
  'Une rencontre de fin de journée avec de courtes présentations, des échanges libres et un temps de questions. Ouvert aux curieux, aux étudiants majeurs et aux professionnels. Boissons non comprises.',
];
function catalog() {
  const events = [];
  dates.forEach((date, week) => {
    const conferenceRoom = [1,2,8,3][week % 4];
    const workshopRoom = week % 2 ? 5 : 6;
    [0,1,2].forEach(format => {
      const room = format === 0 ? conferenceRoom : format === 1 ? workshopRoom : conferenceRoom;
      const capacity = format === 0 ? [320,180,140,85][week % 4] : format === 1 ? (room === 5 ? 18 : 28) : 60;
      const participants = format === 0 ? [142,96,78,58][week % 4] : format === 1 ? ([0,4,8].includes(week) ? capacity : capacity-3) : 24+week*2;
      events.push({id:16000+week*3+format,title:topics[week][format],description:descriptions[format],
        start:`2026-${date} ${format === 0 ? '09:00' : format === 1 ? '10:00' : '18:00'}:00`,
        end:`2026-${date} ${format === 0 ? '16:00' : format === 1 ? '13:00' : '21:00'}:00`,
        room,capacity,participants,price:format === 0 ? [65,55,49,45][week%4] : format === 1 ? 55 : (week % 3 === 0 ? 0 : 18),
        owner:format === 0 ? 1112 : format === 1 ? [12200,9010,9012][week%3] : [12201,9011,9014][week%3],
        status:'PUBLISHED', paidBalance:week % 4 === 1, format,
      });
    });
  });
  events.push(
    {id:16036,title:'Bilan de rentrée des équipes numériques',description:'Rencontre passée conservée pour présenter les présences et un règlement de salle terminé.',start:'2026-09-01 09:00:00',end:'2026-09-01 13:00:00',room:3,capacity:80,participants:62,price:38,owner:1112,status:'PUBLISHED',paidBalance:true,format:0},
    {id:16037,title:'Atelier méthodes agiles : retour de terrain',description:'Atelier passé : les inscriptions et présences permettent de présenter le calcul du reversement après l’échéance du solde.',start:'2026-09-02 09:00:00',end:'2026-09-02 13:00:00',room:7,capacity:50,participants:44,price:45,owner:1112,status:'PUBLISHED',paidBalance:false,format:1},
    {id:16038,title:'Novembre : rencontre des associations',description:'Proposition complète à examiner : échanges sur les outils numériques associatifs, présentation de projets et questions du public.',start:'2026-11-30 09:00:00',end:'2026-11-30 13:00:00',room:3,capacity:70,participants:0,price:32,owner:1112,status:'PENDING_APPROVAL',format:0},
    {id:16039,title:'Atelier communication des petites structures',description:'Proposition d’atelier à valider par l’administration, avec exercices pratiques et partage de supports.',start:'2026-11-30 14:00:00',end:'2026-11-30 17:00:00',room:4,capacity:35,participants:0,price:35,owner:12200,status:'PENDING_APPROVAL',format:1},
    {id:16040,title:'Séminaire des partenaires MeetSpace',description:'Proposition de séminaire pour les partenaires : présentations, échanges et ateliers. Dossier en attente de validation administrative.',start:'2026-11-30 09:00:00',end:'2026-11-30 17:00:00',room:2,capacity:160,participants:0,price:65,owner:1112,status:'PENDING_APPROVAL',format:0},
    {id:16041,title:'Atelier réseau professionnel : dossier à compléter',description:'Proposition non retenue dans son état actuel. L’organisateur peut préciser le programme et soumettre une nouvelle version.',start:'2026-11-30 18:00:00',end:'2026-11-30 21:00:00',room:6,capacity:25,participants:0,price:25,owner:1112,status:'REJECTED',format:1}
  );
  return events;
}
function clients() {
  const first = ['Amélie','Sofiane','Célia','Gabriel','Salma','Adrien','Aïcha','Valentin','Lucie','Ilyes','Océane','Baptiste','Hana','Florian','Mélissa','Dylan','Yara','Axel','Anaïs','Idriss','Maëlle','Raphaël','Léonie','Nassim','Élodie','Quentin','Sana','Théo','Inaya','Martin'];
  const last = ['Delcourt','Bensaïd','Verhaegen','Diallo','Lemaire','Piret'];
  return Array.from({length:180},(_,i) => ({id:12000+i,first_name:first[i%30],last_name:last[Math.floor(i/30)],email:`client.${String(i+1).padStart(3,'0')}@presentation.meetspace.test`,role:'MEMBER'})).concat([
    {id:12200,first_name:'Clémence',last_name:'Delaunay',email:'clemence.delaunay@presentation.meetspace.test',role:'ORGANIZER'},
    {id:12201,first_name:'Nabil',last_name:'Azzouzi',email:'nabil.azzouzi@presentation.meetspace.test',role:'ORGANIZER'},
  ]);
}
module.exports = { catalog, clients };
