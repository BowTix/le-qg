# Audit des performances — Base de données et temps réel

Date : 27 juillet 2026

## Conclusion

La lenteur globale ne vient pas du volume de données. Les tables sont petites et les
index principaux existent. Elle vient surtout de l'accumulation d'allers-retours vers
la base Aiven distante, auxquels s'ajoutent un serveur de développement mono-processus
et des publications Pusher synchrones.

Les quatre causes prioritaires sont :

1. Le `RateLimiter` exécute trois requêtes Aiven avant **chaque** endpoint.
2. Une requête SQL, même triviale, coûte entre 40 et 80 ms depuis l'environnement local.
3. Le backend local utilise `php -S` avec un seul worker.
4. Le frontend déclenche plusieurs appels redondants et utilise encore certains
   événements WebSocket comme de simples demandes de rechargement HTTP.

## Mesures

Mesures effectuées depuis l'environnement de développement vers Aiven Amsterdam :

| Opération | Mesure |
|---|---:|
| Ouverture PDO + TLS | 246 ms |
| `SELECT 1`, moyenne de 12 essais | 79,9 ms |
| Recherche indexée d'un salon, moyenne de 8 essais | 39,8 ms |
| Transaction vide avec un `SELECT 1` | 159 ms |
| Publication Pusher EU | 186 ms |

Les tables sont très petites : 4 utilisateurs, 69 salons, 131 joueurs de salon,
783 questions, 100 cartes et 10 réponses Chrono-Bomb au moment de l'audit. Un
`COUNT(*)` prend pourtant environ 70 ms sur presque toutes ces tables. Le temps est
donc dominé par le réseau et le proxy Aiven, pas par le travail SQL.

La connexion MySQL utilise bien TLS. Les index importants existent sur
`lobbies.room_code`, `lobby_players(lobby_id,user_id)`,
`chrono_bomb_answers(lobby_id,round_number,normalized_answer)`, les échanges et les
tentatives quotidiennes.

## Cause P0 — Rate limiter distant sur chaque requête

`backend/src/Middleware/RateLimiter.php` est exécuté avant le routeur et lance :

1. un `DELETE` des entrées anciennes ;
2. un `SELECT COUNT(*)` ;
3. un `INSERT`.

Chaque appel API paie donc trois allers-retours Aiven avant son traitement réel, soit
environ 200 à 250 ms mesurés. La purge utilise uniquement `timestamp`, alors que
l'index existant est `(ip, timestamp)` : son premier segment ne correspond pas au
filtre de purge.

### Recommandation

- Désactiver ce limiteur SQL en développement.
- En production, utiliser Redis avec `INCR` + expiration, la limitation de la
  plateforme, ou au minimum un compteur SQL atomique en une seule requête.
- Effectuer le nettoyage hors du chemin HTTP, par échantillonnage ou tâche planifiée.

## Cause P0 — Serveur local mono-processus

Le processus observé est :

```text
php -S 127.0.0.1:8000 -t public/
PHP_CLI_SERVER_WORKERS=unset
```

Le serveur intégré PHP ne traite qu'une requête à la fois. Les appels lancés en
parallèle par React sont donc mis en file d'attente. Une publication Pusher ou une
requête Aiven lente bloque tout le site local.

### Recommandation

- Utiliser Apache/Docker localement, comme sur Render ; ou
- démarrer plusieurs workers sous WSL avec `PHP_CLI_SERVER_WORKERS` ;
- idéalement utiliser une base MySQL locale pour le développement et une commande
  explicite pour tester contre Aiven.

## Cause P0 — Tempête de requêtes au chargement

Au montage de l'application, le shell et le tableau de bord déclenchent :

- `/auth/profile` ;
- `/quiz/daily/status` ;
- `/shop/collection` ;
- `/quests` ;
- `/trades` ;
- `/friends`.

`/quiz/daily/status` peut repartir après la mise à jour de l'objet utilisateur et est
également lancé lors de navigations hors du tableau de bord. Les notifications
relancent `/trades` et `/friends` toutes les 30 secondes.

En régime normal, ce chargement représente environ 34 à 40 échanges SQL en comptant
le limiteur global. Avec le serveur PHP mono-processus, les appels sont sérialisés.

### Recommandation

- Créer `/dashboard/bootstrap` avec uniquement les données nécessaires au premier
  rendu.
- Ne charger le statut quotidien que sur `/dashboard`.
- Ne plus modifier la progression de quête « login » à chaque lecture du profil.
- Charger les notifications à l'ouverture ou les maintenir avec un événement Pusher,
  sans double polling.
- Mettre en cache les catalogues statiques `cards`, `cosmetics` et `quests`.

## Parcours des salons

### Création

`POST /lobby/create` :

- 3 requêtes du limiteur ;
- recherche d'un code disponible ;
- insertion du salon ;
- insertion du joueur hôte.

La navigation déclenche ensuite `/lobby/status`, qui ajoute le limiteur et deux
requêtes. Une création complète représente donc environ 11 allers-retours SQL.

### Rejoindre

`POST /lobby/join` :

- limiteur global ;
- lecture du salon ;
- recherche du joueur ;
- insertion ou réinitialisation ;
- reconstruction de l'état complet pour le broadcast ;
- publication Pusher synchrone ;
- nouveau `/lobby/status` après navigation.

Estimation : environ 13 échanges SQL, plus la publication Pusher.

### Lancement Chrono-Bomb

Pour deux joueurs, le clic « lancer » provoque approximativement :

- limiteur + lecture du salon ;
- lecture et mise à jour de l'état Chrono-Bomb ;
- transaction et mises à jour joueur par joueur ;
- publication `lobby_refresh` ;
- un `fetchStatus()` explicite dans le gestionnaire du bouton ;
- un second `fetchStatus()` déclenché par `lobby_refresh`.

Chaque statut Chrono-Bomb démarre en outre une transaction avec `SELECT ... FOR
UPDATE`, même lorsque la mèche n'a pas expiré, puis effectue trois requêtes de
décoration. Le clic peut dépasser 30 échanges réseau SQL cumulés.

### Recommandation

- Supprimer le double rafraîchissement après `start`.
- Envoyer l'état de démarrage directement dans la réponse et dans un événement
  Pusher.
- Tester l'heure d'expiration avant d'ouvrir la transaction de transition.
- Mettre à jour tous les joueurs en une requête au lieu d'une boucle.
- Réutiliser les données déjà lues au lieu de reconstruire immédiatement l'état.

## Audit WebSocket / Pusher

### Points positifs

- Un seul client Pusher est créé dans l'arène.
- Le polling de statut s'arrête quand Pusher est connecté.
- Les passes Chrono-Bomb utilisent maintenant un delta minimal
  `chrono_bomb_passed`.
- Les appels REST Pusher utilisent désormais HTTPS.

### Problèmes restants

- `triggerAsync()` est synchrone : il exécute un appel cURL dans la requête PHP.
- `finishResponse()` ne libère pas le worker sous `php -S` et n'apporte pas le
  comportement FastCGI décrit par son commentaire.
- Plusieurs événements Pusher (`lobby_refresh`, échanges) déclenchent ensuite une
  nouvelle requête HTTP et de nouvelles lectures SQL.
- De nombreuses actions multijoueurs reconstruisent et publient l'état complet du
  salon.
- Les notifications globales font du polling même si des événements existent déjà.
- Les canaux de salon et d'utilisateur sont publics ; ce point relève surtout de la
  sécurité, mais mérite une migration vers des canaux privés.

### Recommandation

- Publier des événements métier compacts et autoritaires.
- Réserver les snapshots complets à la connexion et à la reconnexion.
- Sortir les publications Pusher du chemin critique avec une file ou un worker.
- À court terme, ne pas faire suivre un événement Pusher d'un GET si son payload
  contient déjà la modification.

## Autres motifs coûteux

- `ShopController::getCollection()` exécute six requêtes séquentielles et recharge
  deux catalogues statiques à chaque appel.
- `FriendsController::getFriends()` exécute trois requêtes qui peuvent être regroupées.
- Le mode Imposteur contient un N+1 : une requête d'état par joueur pendant la
  construction du snapshot.
- Les transitions Tribunal peuvent exécuter des insertions et mises à jour dans des
  boucles, puis reconstruire immédiatement un snapshot complet.
- Plusieurs parcours de fin de partie mettent à jour les joueurs un par un.
- `broadcastLobbyState()` relit systématiquement le salon et les joueurs. Sa jointure
  vers `packs` est interne alors que Chrono-Bomb utilise `pack_id = NULL`.
- Le client API n'a ni déduplication, ni cache HTTP, ni annulation des requêtes
  devenues obsolètes.

## Plan recommandé

### Phase 1 — gain immédiat

1. Retirer le rate limiter SQL du développement et le réduire à une opération en
   production.
2. Remplacer `php -S` mono-processus par Apache/Docker ou plusieurs workers.
3. Supprimer les doubles `fetchStatus` et les événements Pusher suivis d'un GET.
4. Ajouter `Server-Timing` aux endpoints pour suivre connexion, SQL, broadcast et
   durée totale.

### Phase 2 — réduire les allers-retours

1. Créer un bootstrap de tableau de bord.
2. Mettre en cache les catalogues statiques.
3. Regrouper les requêtes des amis, quêtes et états de salon.
4. Remplacer les mises à jour joueur par joueur par des opérations ensemblistes.
5. Éliminer les motifs N+1.

### Phase 3 — architecture temps réel

1. Utiliser Pusher pour transporter les deltas, pas uniquement invalider un cache.
2. Déporter les publications dans un worker/file.
3. Ajouter une base locale de développement.
4. Envisager Redis pour l'état éphémère, les limites de débit et les timers si le
   nombre de parties augmente.

## Limite de l'audit

La tentative de capture du waterfall dans le navigateur intégré n'a pas pu être
réalisée à cause d'une erreur technique de connexion au navigateur. Les conclusions
reposent sur les mesures directes Aiven/Pusher, les processus locaux observés et la
cartographie complète des appels frontend et backend.
