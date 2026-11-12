# School Helping AI - backend

Backend Node.js/Express sécurisé pour Firebase Authentication, Firestore et Supabase Storage. Aucun moteur IA n’est configuré pendant cette étape de migration.

## Installation et configuration

Depuis la racine du dépôt :

```powershell
npm install
New-Item -ItemType Directory -Force private_files/secrets
Copy-Item backend/.env.example private_files/secrets/backend.env
npm run dev
```

Complète `private_files/secrets/backend.env` :

| Variable | Valeur |
| --- | --- |
| `FIREBASE_PROJECT_ID` | ID du projet Firebase (`school-helping-ai`). |
| `FIREBASE_CLIENT_EMAIL` | Adresse `client_email` du compte de service Firebase Admin. |
| `FIREBASE_PRIVATE_KEY` | Clé `private_key` du compte de service Firebase Admin. Garde-la uniquement dans les secrets du serveur. |
| `SUPABASE_URL` | URL du projet lié au bucket `student-files`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur Supabase. Ne jamais la copier dans `public/` ou dans Git. |
| `PORT` | Port HTTP, par défaut `3000`. |
| `FRONTEND_URL` | Origines autorisées, séparées par des virgules. En local : `http://localhost:5500,http://127.0.0.1:5500`; les ports locaux HTTP sont acceptés quel que soit leur numéro. |
| `MAX_CONTEXT_MESSAGES` | Nombre maximal de messages historiques envoyés au modèle; défaut `15`. |
| `ASSISTANT_MAX_CONTEXT_MESSAGES` | Limite dédiée à l’historique Assistant AI; défaut `12`. |
| `ASSISTANT_MAX_CONTEXT_TOKENS` | Budget approximatif du prompt et du contexte Assistant; défaut `12000`. |
| `ASSISTANT_MAX_OUTPUT_TOKENS` | Plafond absolu des tokens de génération Assistant; défaut `8000`, avec budgets adaptés au type de demande. |
| `ASSISTANT_SIMPLE_MAX_OUTPUT_TOKENS` | Budget des demandes simples; défaut `3000`. |
| `ASSISTANT_EXPLANATION_MAX_OUTPUT_TOKENS` | Budget des explications; défaut `5000`. |
| `ASSISTANT_EXERCISE_MAX_OUTPUT_TOKENS` / `ASSISTANT_CONTROL_MAX_OUTPUT_TOKENS` | Budgets exercice et contrôle; défaut `4500` chacun. |
| `ASSISTANT_SUMMARY_MAX_OUTPUT_TOKENS` | Budget des résumés; défaut `4000`. |
| `ASSISTANT_COMPLEX_MAX_OUTPUT_TOKENS` | Budget des mathématiques et demandes complexes; défaut `6500`. |
| `ASSISTANT_PROGRAMMING_MAX_OUTPUT_TOKENS` | Budget du code et de la programmation; défaut `7000`. |
| `MAX_REQUEST_SIZE` | Taille JSON maximale; défaut `128kb`. |
| `MAX_ATTACHMENT_BYTES` | Limite de lecture/analyse d’un fichier; défaut 10 MB (maximum serveur 20 MB). |

Firebase Admin utilise `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` et `FIREBASE_PRIVATE_KEY`. Garde la clé privée uniquement dans `private_files/secrets/backend.env` en local ou dans les secrets du serveur; ne la copie pas dans `public/` ni dans Git.

Les budgets de contexte et de sortie restent configurés pour le prochain moteur. Pendant cette étape, les endpoints de génération répondent avec `503 AI_ENGINE_UNAVAILABLE`.

## Services

- **Firebase** : crée un compte de service depuis Firebase Console > Paramètres du projet > Comptes de service. Attribue les accès minimaux requis à Firebase Authentication (vérification des ID tokens) et Cloud Firestore (lecture/écriture). Les règles Firestore publiques existantes continuent de protéger les accès directs du frontend; Firebase Admin contourne les règles et le backend construit ses chemins exclusivement à partir de `req.user.uid`.
- **Supabase** : vérifie que le bucket privé `student-files` et l’Edge Function d’upload déjà présents sont déployés. Renseigne l’URL racine du projet (sans `/rest/v1`) et la clé service role uniquement dans `private_files/secrets/backend.env`. Toute pièce jointe est limitée à `{uid}/{conversationId}/...`, vérifiée contre le jeton Firebase, et aux formats PDF/JPEG/PNG/WEBP. Les PDF textuels sont extraits via `pdf-parse`; les PDF image-only peuvent demander un OCR.
- **Moteur IA** : aucun fournisseur n’est appelé. Les routes de génération Assistant AI, Goal AI et d’analyse documentaire répondent temporairement avec une erreur `503 AI_ENGINE_UNAVAILABLE`.

Ne partage ni clé privée, ni clé de service Supabase, ni `.env`. `private_files/` et les fichiers de comptes de service sont ignorés par Git.

## Lancer et vérifier

Lance le backend et Vite dans deux terminaux séparés :

```powershell
npm run dev
```

```powershell
npm run dev:frontend
```

Ouvre ensuite `http://127.0.0.1:5173/assistant.html` ou `http://127.0.0.1:5173/ai-test.html`. Pour les pages qui importent Transformers.js depuis npm, ne les ouvre pas avec `file://` et ne les sers pas directement avec Live Server : seul Vite résout le module `@huggingface/transformers`. Vérifie le backend avec `GET http://localhost:3000/api/health`.

## API

Les routes privées exigent `Authorization: Bearer <Firebase ID token>`. Les erreurs ont le format `{ "success": false, "error": { "code": "...", "message": "..." } }`.

Assistant AI utilise un prompt de tuteur dédié aux modes résumé, explication, exercice et contrôle. Il limite la sortie selon la complexité, reprend le sujet après un message bref d’incompréhension, filtre la mémoire par sujet, sélectionne les passages documentaires utiles et retire les messages les plus anciens si le budget de contexte est atteint. Ces consignes et plafonds s’appliquent uniquement à Assistant AI; les prompts et réglages Goal AI restent distincts.

| Méthode et chemin | Accès | Fonction |
| --- | --- | --- |
| `GET /api/health` | Public | État du processus. |
| `GET /api/health/ai` | Public | Indique que le moteur IA n’est pas configuré (`503`). |
| `POST /api/assistant/chat` | Auth | Route conservée ; répond temporairement `503 AI_ENGINE_UNAVAILABLE`. |
| `POST /api/ai/analyze-document` | Auth | Route conservée ; répond temporairement `503 AI_ENGINE_UNAVAILABLE`. |
| `POST /api/goal/generate` | Auth | Valide la requête ; répond temporairement `503 AI_ENGINE_UNAVAILABLE`. |
| `GET /api/goal/current` | Auth | Lit l’objectif existant `users/{uid}/goals/default`. |
| `PUT /api/goal/current` | Auth | Valide et enregistre l’objectif existant. |
| `POST /api/goal/chat` | Auth | Vérifie l’objectif ; répond temporairement `503 AI_ENGINE_UNAVAILABLE`. |

Exemple chat :

```powershell
$token = "FIREBASE_ID_TOKEN"
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
Invoke-RestMethod http://localhost:3000/api/assistant/chat -Method Post -Headers $headers -Body '{"conversationId":"conversation123","message":"Explique-moi les lois de Newton","mode":"explication"}'
```

Modes Assistant : `resume`, `explication`, `exercice`, `controle`. Exemple d’objectif examen conforme au formulaire :

```json
{"type":"exam","duration":{"value":15,"unit":"days"},"chapters":[{"name":"Génétique","difficulty":"hard"},{"name":"Écologie","difficulty":"medium"},{"name":"Cellule","difficulty":"easy"}]}
```

Appelle `POST /api/goal/generate` avec ce JSON pour générer le programme. L’interface Goal transmet désormais ses objectifs et affiche le programme; le chat Goal AI utilise aussi l’API.

## Architecture

`backend/src/routes` expose les routes; `controllers` orchestre les requêtes; `services` s’occupe de Firebase, Supabase, contexte et mémoire; `config` initialise les clients; `middleware` gère ID tokens et erreurs; `utils` porte validation, prompts et progression. `public/` contient les pages HTML, leurs feuilles de style dans `css/`, les modules dans `js/` et les images dans `images/`. `public/js/assistant.js` et `public/js/goal.js` envoient l’ID token sans exposer les clés privées. Les opérations existantes de profil, historique, affichage et suppression côté navigateur sont conservées.

## Tests et déploiement

La vérification effectuée pour cette livraison est rapportée dans le message de livraison. Pour l’intégration réelle, renseigne les secrets, démarre le serveur et ouvre `/api/health`; connecte un compte de test puis essaie le chat et la génération depuis les pages. En production, déploie Node sur un service HTTPS (Cloud Run ou hébergeur Node), configure les mêmes variables comme secrets de service, définis l’origine frontend HTTPS exacte et définis `window.__API_BASE_URL__` à l’URL publique de ce backend. Un serveur Firebase Hosting statique ne lance pas à lui seul ce processus Node.
