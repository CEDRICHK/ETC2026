window.ETC_QUESTIONS = [
  {
    id: "q1",
    slide: 4,
    block: "Introduction",
    title: "Un Z’ supérieur à 0,5 suffit-il pour valider une plaque ?",
    context: "Z’ = 0,89",
    options: [
      { key: "A", label: "Oui", detail: "Le seuil est franchi." },
      { key: "B", label: "Non", detail: "Pas à lui seul." },
      { key: "C", label: "Je ne sais pas encore", detail: "Il me manque un diagnostic." }
    ],
    correct: "B",
    explanation: "Z’ mesure la séparation des contrôles ; il ne teste pas la structure spatiale des puits tests."
  },
  {
    id: "q2",
    slide: 11,
    block: "Bloc 1 · Qualité des données",
    title: "Que faire avant de sélectionner les hits ?",
    context: "La heatmap montre un gradient bord–centre.",
    options: [
      { key: "A", label: "Sélectionner", detail: "Les puits bleus du centre." },
      { key: "B", label: "Appliquer", detail: "Directement un z-score." },
      { key: "C", label: "Suspendre", detail: "La sélection et diagnostiquer la position." }
    ],
    correct: "C",
    explanation: "Il faut démontrer et comprendre le biais spatial avant de corriger, normaliser ou sélectionner."
  },
  {
    id: "q3",
    slide: 26,
    block: "Bloc 2 · Normalisation et sélection",
    title: "Que conclure devant ces deux listes ?",
    context: "Même plaque, seuil ≤ −3 : z-score = 0 candidat ; médiane/MAD = 61 candidats.",
    options: [
      { key: "A", label: "Le z-score est préférable", detail: "Il utilise moyenne et écart-type." },
      { key: "B", label: "Le score robuste dit vrai", detail: "Il retient davantage de candidats." },
      { key: "C", label: "Le fond est contaminé", detail: "Changer de référence, comparer puis confirmer." }
    ],
    correct: "C",
    explanation: "Quand de nombreux puits tests sont actifs, la population utilisée comme fond déplace les deux règles."
  },
  {
    id: "q4",
    slide: 40,
    block: "Bloc 3 · Spécificités du HCS",
    title: "Quels objets conserver pour calculer les mesures par cellule ?",
    context: "Exemples B, C, D et E de Hill et al. (2007).",
    options: [
      { key: "A", label: "B et C uniquement", detail: "Objets suffisamment complets." },
      { key: "B", label: "D et E uniquement", detail: "Objets tronqués ou fragmentés." },
      { key: "C", label: "Les quatre", detail: "Tous les objets détectés." },
      { key: "D", label: "Aucun", detail: "Aucun objet n’est exploitable." }
    ],
    correct: "A",
    explanation: "B et C représentent des cellules suffisamment complètes ; D est tronquée et E est un fragment."
  },
  {
    id: "q5",
    slide: 44,
    block: "Conclusion",
    title: "Un Z’ supérieur à 0,5 suffit-il pour valider une plaque ?",
    context: "Retour au cas initial : Z’ = 0,89.",
    options: [
      { key: "A", label: "Oui", detail: "Le seuil est franchi." },
      { key: "B", label: "Non", detail: "Pas à lui seul." },
      { key: "C", label: "Ça dépend", detail: "Je demande à voir la plaque." }
    ],
    correct: "B",
    explanation: "La réponse reste non : visualiser la plaque est nécessaire précisément parce que Z’ ne suffit pas."
  }
];
