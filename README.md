# ETC 2026 — Atelier HTS / HCS

Page publique regroupant la bibliographie de l’atelier et son système de QCM
interactifs anonymes.

## Pages publiques

- Bibliographie : https://cedrichk.github.io/ETC2026/
- Présentation : https://cedrichk.github.io/ETC2026/presntation.html
- Vote anonyme : https://cedrichk.github.io/ETC2026/vote.html
- Tableau de bord formateur : https://cedrichk.github.io/ETC2026/admin.html

## Fonctionnement des QCM

Le tableau de bord génère un code aléatoire de séance. Les participants
scannent toujours le même QR code puis saisissent ce code. Le bouton
`Nouvelle séance` génère un nouveau canal et remet les résultats à zéro sans
réutiliser les réponses du groupe précédent.

Les QCM ne sont jamais lancés tous ensemble. À chaque diapositive, le
formateur sélectionne uniquement la question correspondante, clique sur
`Ouvrir le vote`, puis sur `Fermer` et `Révéler`. Les participants gardent la
même page ouverte : la question active apparaît automatiquement et les
questions suivantes restent invisibles jusqu’à leur sélection.

Pour la seconde séance d’une heure, cliquer sur `Nouvelle séance` : un nouveau
code et de nouveaux canaux sont créés, tandis que la première séance reste
consultable dans l’historique et exportable en CSV.

Les messages échangés ne contiennent ni nom ni courriel. Un identifiant
aléatoire conservé dans le navigateur permet de compter la dernière réponse
de chaque téléphone pour une question donnée. Le transport utilise les topics
publics et éphémères de deux instances communautaires de `ntfy`
(`ntfy.tedomum.fr` et `ntfy.hostux.net`) utilisées en redondance ; il ne
convient donc pas à des données personnelles ou sensibles.
