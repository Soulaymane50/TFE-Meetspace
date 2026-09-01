-- Repair demo descriptions that were imported with replacement question marks.
-- Restrict the update to the known demo identifiers so user-authored content is untouched.
UPDATE event
SET description = CASE id
    WHEN 9528 THEN 'Atelier pratique consacré aux composants, aux règles d interface et à la collaboration produit.'
    WHEN 9529 THEN 'Échanges en petit comité sur la qualité, la responsabilité et le pilotage des données.'
    WHEN 9530 THEN 'Laboratoire gratuit pour tester des parcours numériques plus accessibles.'
    WHEN 9531 THEN 'Cas pratiques sur l alignement marketing, ventes, données et prévisions.'
    WHEN 9532 THEN 'Questions juridiques et opérationnelles autour des systèmes d intelligence artificielle.'
    WHEN 9533 THEN 'Rencontre de fin de journée pour recruteurs, responsables techniques et candidats.'
    WHEN 9534 THEN 'Méthodes concrètes pour suivre l adoption, la satisfaction et la fidélisation.'
    WHEN 9535 THEN 'Contributions, maintenance et modèles économiques autour des logiciels libres.'
    ELSE description
END
WHERE id IN (9528, 9529, 9530, 9531, 9532, 9533, 9534, 9535)
  AND description LIKE '%?%';
