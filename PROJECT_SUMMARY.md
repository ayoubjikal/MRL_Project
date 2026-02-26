# 📋 Résumé Complet du Projet — MRL Compliance Platform

## 🎯 Idée générale

Le projet est une **plateforme de conformité réglementaire** dans le domaine de l'agroalimentaire.
Elle permet à des agriculteurs, exportateurs, et laboratoires de **vérifier automatiquement
si les produits agricoles respectent les Limites Maximales de Résidus (LMR/MRL)** fixées
par la réglementation européenne avant l'exportation — notamment vers l'Union Européenne.

---

## 🌍 Contexte et problème résolu

Lorsqu'un producteur (ex: au Maroc, Turquie, Amérique du Sud) exporte des fruits ou légumes
vers l'UE, ses produits sont contrôlés aux frontières. Si un pesticide est détecté en
concentration supérieure à la LMR officielle, **le chargement entier est rejeté à la frontière**
— ce qui entraîne des pertes financières considérables.

**Le problème :** Les agriculteurs et exportateurs reçoivent des rapports d'analyse de
laboratoire (PDF) contenant les concentrations de pesticides détectées. Ils doivent
manuellement comparer ces valeurs avec les LMR officielles publiées par la Commission
Européenne — un processus lent, manuel, et source d'erreurs.

**La solution :** Notre plateforme automatise entièrement ce processus :
1. L'utilisateur upload son rapport de laboratoire (PDF)
2. Le système extrait automatiquement les données via OCR
3. Le système interroge en temps réel la base officielle EU
4. Un score de conformité est calculé instantanément pour chaque substance
5. Un rapport de conformité est généré avec recommandations

---

## 📊 Source de données officielle

**EU Pesticides Database API — V3.0**
```
Base URL : https://api.datalake.sante.service.ec.europa.eu/sante/pesticides
api-version : v3.0  (OBLIGATOIRE — les versions V1 et V2 sont mortes, HTTP 410 Gone)
```

Cette API est publiée par la **Direction Générale de la Santé et de la Sécurité Alimentaire
de la Commission Européenne** (DG SANTE). Elle expose les mêmes données que la base
officielle : https://food.ec.europa.eu/plants/pesticides/eu-pesticides-database_en

Les données sont mises à jour **quotidiennement** par Bruxelles.

### Endpoints utilisés (machine-to-machine) :

| Endpoint | URL (V3.0) | Rôle |
|---|---|---|
| Résidus pesticides | `pesticide-residues` | Trouver l'ID officiel d'un résidu |
| Produits alimentaires | `pesticide-residues-products` | Trouver l'ID d'un produit |
| Valeurs MRL | `pesticide-residues-mrls` | Obtenir la LMR pour résidu + produit |
| Tous les MRL d'un produit | `product-current-mrl-all-residues` | Vue complète d'un produit |

### Règles importantes de l'API :
- `pesticide-residues` : **pas de paramètre `language`** — les noms sont toujours en latin/anglais
- `pesticide-residues-products` : accepte `language` (EN, FR, ES, DE, IT, PT...)
- `pesticide-residues-mrls` : paramètres `pesticide_residue_id` + `product_id`
- Le champ `applicability` dans les MRL : `1` = actuel, `0` = futur, `2` = passé
- Si aucune LMR trouvée → **LMR par défaut = 0.01 mg/kg** (Article 18(1)(b) Règlement CE 396/2005)

### Flow API en 3 étapes (obligatoire) :
```
Étape 1 : GET pesticide-residues?pesticide_residue_name=Glyphosate
          → retourne pesticide_residue_id (ex: 1045)

Étape 2 : GET pesticide-residues-products?language=EN&product_code=0231010
          → retourne product_id (ex: 388)

Étape 3 : GET pesticide-residues-mrls?pesticide_residue_id=1045&product_id=388
          → retourne les valeurs MRL (current/future/past)
```

---

## 🔬 Module OCR — Extraction automatique des rapports labo

### Objectif
Permettre à l'utilisateur d'**uploader un rapport PDF de laboratoire** et que le système
extrait automatiquement tous les champs nécessaires pour lancer la comparaison MRL,
**sans saisie manuelle**.

### Ce que le rapport PDF contient (typiquement) :
```
Rapport d'Analyse — Laboratoire AgriTest
Produit : Tomates fraîches        Date prélèvement : 15/01/2025
Lot : MAR-2025-0412               Pays d'origine : Maroc

Substance             Résultat      LOQ          Unité
─────────────────────────────────────────────────────
Glyphosate            0.03          0.01         mg/kg
Imidacloprid          < LOQ         0.005        mg/kg
Pyraclostrobin        0.12          0.01         mg/kg
Chlorpyrifos          < LOQ         0.01         mg/kg
```

### Ce que l'OCR doit extraire :
```json
{
  "product_name": "Tomates fraîches",
  "sampling_date": "15/01/2025",
  "batch_id": "MAR-2025-0412",
  "country_of_origin": "Maroc",
  "results": [
    {"substance": "Glyphosate",      "detected": 0.03,  "loq": 0.01,  "unit": "mg/kg"},
    {"substance": "Imidacloprid",    "detected": null,  "loq": 0.005, "unit": "mg/kg", "below_loq": true},
    {"substance": "Pyraclostrobin",  "detected": 0.12,  "loq": 0.01,  "unit": "mg/kg"},
    {"substance": "Chlorpyrifos",    "detected": null,  "loq": 0.01,  "unit": "mg/kg", "below_loq": true}
  ]
}
```

### Stratégie technique OCR :
- **PDF numérique** (texte sélectionnable) → `pdfplumber` ou `PyMuPDF` — extraction directe
- **PDF scanné** (image) → `Tesseract OCR` + `pdf2image` — reconnaissance optique
- Après extraction : parsing par **expressions régulières (regex)** pour identifier
  les substances, valeurs numériques, unités, et cas spéciaux (< LOQ, *, nd)
- **Score de confiance** par champ extrait → si confiance < 95%, proposer validation manuelle

---

## 🧮 Moteur de conformité (Rule Engine)

### Logique de scoring :

```
Pour chaque substance détectée :

1. Chercher la LMR officielle via l'API EU (3 étapes)
2. Convertir la valeur détectée en mg/kg
3. Appliquer les règles :

   SI substance non approuvée (banned) :
       → HARD FAIL — score = 0 — CRITIQUE

   SI valeur détectée > LMR :
       → HARD FAIL — score = 0 — CRITIQUE

   SI LOQ > LMR (méthode analytique pas assez sensible) :
       → HARD FAIL — score = 0 — CRITIQUE

   SINON :
       ratio = détecté / LMR
       score = 100 × (1 - ratio)

       score > 80 ET ratio < 0.5  → SAFE (vert)
       score entre 40 et 80       → VIGILANCE (orange)
       score < 40                 → CRITIQUE (rouge)
```

### Conversion d'unités :
```
mg/kg = 1.0    (référence)
ppm   = 1.0
ppb   = 0.001
µg/kg = 0.001
µg/g  = 1.0
ng/g  = 0.001
```

### LMR par défaut :
Si aucune LMR spécifique trouvée dans la base EU →
**0.01 mg/kg** appliqué automatiquement (Article 18(1)(b), Règlement CE 396/2005)

---

## 🏗️ Architecture globale du projet

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                    React (partner)                               │
│  - Upload PDF rapport labo                                       │
│  - Formulaire de saisie manuelle (si pas de PDF)                 │
│  - Affichage des résultats / score                               │
│  - Dashboard historique des analyses                             │
│  - Export rapport PDF de conformité                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP REST
┌──────────────────────────────▼──────────────────────────────────┐
│                         BACKEND                                  │
│                     Flask (partner)                              │
│                                                                  │
│  POST /api/analyse          → reçoit PDF ou données manuelles    │
│  GET  /api/substances       → liste des substances               │
│  GET  /api/products         → liste des produits                 │
│  GET  /api/history          → historique des analyses            │
│  GET  /api/report/{id}      → rapport PDF généré                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MODULE OCR                                               │   │
│  │  pdfplumber (PDF numérique)                              │   │
│  │  Tesseract  (PDF scanné)                                 │   │
│  │  Parser regex → JSON structuré                           │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │  RULE ENGINE (Moteur de conformité)                       │   │
│  │  - Appel API EU V3.0 (3 étapes par substance)            │   │
│  │  - Conversion d'unités                                    │   │
│  │  - Calcul score 0-100                                    │   │
│  │  - Classification SAFE / VIGILANCE / CRITIQUE            │   │
│  │  - Hard fail detection                                    │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │  BASE DE DONNÉES (PostgreSQL)                            │   │
│  │  - Historique des analyses                               │   │
│  │  - Résultats labo                                        │   │
│  │  - Scores de conformité                                  │   │
│  │  - Piste d'audit complète                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────────┐
│              EU Pesticides Database API V3.0                     │
│   api.datalake.sante.service.ec.europa.eu                        │
│   Règlement (CE) n° 396/2005                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👥 Répartition des rôles dans l'équipe

| Rôle | Responsabilité |
|---|---|
| **Data Lead (toi)** | Module OCR, appels API EU, Rule Engine, base de données, scoring |
| **Partner** | Frontend React, Backend Flask, API REST interne, authentification |

---

## 📦 Technologies

| Composant | Technologie | Statut |
|---|---|---|
| Frontend | React | Partner |
| Backend API | Flask (Python) | Partner |
| Base de données | PostgreSQL | À implémenter |
| Module OCR | pdfplumber + Tesseract | **À développer (toi)** |
| Appels API EU | Python requests | ✅ Fonctionnel (testé) |
| Rule Engine scoring | Python | ✅ Logique validée |
| Tests / prototypage | Streamlit | ✅ Prototype fonctionnel |

> **Note :** Le prototype Streamlit n'est qu'un outil de validation.
> La version production sera Flask (backend) + React (frontend).

---

## ✅ Ce qui est déjà validé (prototype Streamlit)

1. **Connexion API EU V3.0** — les 4 endpoints fonctionnent correctement
2. **Flow 3 étapes** — résidu → produit → MRL — testé et validé
3. **Rule Engine** — calcul de score, hard fails, conversion d'unités — validé
4. **LMR par défaut** — 0.01 mg/kg appliqué si aucune LMR trouvée — validé
5. **Endpoint §3.6** — `product-current-mrl-all-residues` — tous les MRL d'un produit en 1 appel

---

## 🔜 Prochaine étape : Module OCR

**Objectif immédiat :** Construire le module qui lit un rapport PDF de laboratoire
et en extrait automatiquement les substances, valeurs détectées, LOQ, unités, et
métadonnées (produit, date, lot) pour pré-remplir les champs avant la comparaison MRL.

**Questions à résoudre :**
- Tes rapports PDF sont-ils numériques (texte sélectionnable) ou scannés (image) ?
- Ont-ils tous la même structure / même laboratoire ? Ou formats variables ?
- Le texte est-il en français, anglais, ou autre langue ?

---

## 📝 Notes importantes pour l'API EU V3.0

```
⚠️  IMPORTANT — erreurs des versions précédentes :

❌  V1.0 et V2.0 sont MORTES (HTTP 410 Gone) — toutes les URLs avec underscores
    ex: pesticide_residues → 410 Gone
    ex: active_substances  → 410 Gone

✅  V3.0 UNIQUEMENT — URLs avec tirets
    ex: pesticide-residues
    ex: pesticide-residues-products
    ex: pesticide-residues-mrls
    ex: product-current-mrl-all-residues  (nouveau §3.6)

⚠️  L'endpoint pesticide-residues N'ACCEPTE PAS de paramètre language
    Les noms de résidus sont toujours en latin/anglais (ISO)
    ex: "Glyphosate", "Pyraclostrobin", "Imidacloprid"

⚠️  Les substances actives (active-substances) sont disponibles
    uniquement via le endpoint DOWNLOAD — pas de recherche par nom en V3.0
```
