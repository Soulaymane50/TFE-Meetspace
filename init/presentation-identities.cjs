const firstNames = ['Amélie','Sofiane','Célia','Gabriel','Salma','Adrien','Aïcha','Valentin','Lucie','Ilyes','Océane','Baptiste','Hana','Florian','Mélissa','Dylan','Yara','Axel','Anaïs','Idriss','Maëlle','Raphaël','Léonie','Nassim','Élodie','Quentin','Sana','Théo','Inaya','Martin'];
const familyNames = [
 'Mertens','Jacquet','Van den Broeck','De Smet','Boulanger','Vermeulen','Renard','Peeters','Simon','Laurent',
 'Bailly','Lacroix','Aerts','De Clercq','Lefebvre','Marchal','Dumont','Moreau','Willems','Petit',
 'Jacobs','De Vos','Fontaine','Claes','Dupont','Bertrand','Van Damme','Devaux','Maes','Frère',
 'Verstraete','Masson','Leclercq','Van Acker','Denis','Rousseau','Leroy','Léonard','Berger','Goossens',
 'Colin','Philippe','Vandenbroucke','Stevens','Renaud','Dewaele','Meunier','Bodart','Dufour','Paquet',
 'Lemaître','Van Hove','Gérard','Lejeune','Dierckx','Delaunay','Legrand','Beaumont','Hermans','Huynh',
 'Nguyen','Ndiaye','Benali','Saïdi','El Mansouri','Azzouzi','Bennani','Rahmani','Amrani','Haddad',
 'Diop','Mensah','Traoré','Camara','Ba','Sow','Diallo','Koné','Ouattara','Lopes',
 'Da Silva','Ferreira','Ribeiro','Martins','Pereira','Costa','Rossi','Romano','Moretti','Ricci',
 'Conti','Marino','De Luca','Caruso','Greco','Rizzo','Ferrara','Esposito','Barbieri','Fontana',
 'Martin','Lambert','Dubois','Delvaux','Leplat','Wouters','Deschamps','Pirotte','Dujardin','Boucher',
 'Leroux','Desmet','Janssens','Michiels','Coppens','De Backer','Bosmans','Van Laer','Hendrickx','De Meyer',
 'Vrancken','Vervaet','Van de Velde','Verbruggen','Van Hecke','Ceulemans','De Winter','Lenaerts','Smets','Verhoeven',
 'Dumoulin','Hansen','Durand','Daneels','Devos','Engels','Demaerel','De Wilde','Verhaeghe','François',
 'Toussaint','Legros','Lecomte','Brunet','Lecocq','Wilmotte','Gillet','Noël','Picard','Remy',
];
const domains = ['gmail.com','hotmail.com','outlook.com','hotmail.fr','outlook.fr','outlook.be'];
function slug(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,''); }
function emailFor(id, firstName, lastName) { return `${slug(firstName)}.${slug(lastName)}@${domains[id % domains.length]}`; }
function clientIdentity(index) {
 const id=12000+index, firstName=firstNames[(index+Math.floor(index/familyNames.length)*7)%firstNames.length], lastName=familyNames[(index*37)%familyNames.length];
 return {id,first_name:firstName,last_name:lastName,email:emailFor(id,firstName,lastName),email_delivery_disabled:1,role:'MEMBER'};
}
module.exports={firstNames,familyNames,emailFor,clientIdentity};
