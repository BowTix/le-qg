# 📊 Spécifications de l'Économie Globale — Le QG

Ce document définit les règles d'équilibrage, le barème des récompenses, les flux de ressources et le fonctionnement de la collection pour le portail de jeux **Le QG**.

## 1. Principes & Piliers Fondamentaux

1. **Obtention par le mérite (Anti-Idle) :** Les récompenses sont directement indexées sur les victoires, la réflexion et la complétion d'objectifs, sans génération passive par simple minuteur.

2. **Dualité Quotidien / Infini :** Les modes quotidiens limités offrent l'essentiel des revenus pour récompenser la régularité, tandis que les modes d'entraînement illimités permettent de jouer sans briser la courbe d'acquisition.

3. **Rythme de Saison (Calibrage à 1 mois et demi) :** Une collection de $100\text{ cartes}$ complétable en **6 à 7 semaines (**$\approx 45\text{ jours}$**)** pour un joueur assidu. Ce délai maintient l'engagement sur la durée et laisse le temps de préparer l'arrivée de la Saison 2.

4. **Protection Anti-Frustration (Système de Pity) :** La conversion des doublons en monnaie de craft garantit que les dernières cartes manquantes s'obtiennent par persévérance et non par chance pure.

## 2. Monnaies & Ressources

| 

| **Ressource** | **Rôle & Utilité** | **Source Principale** | 
| **Pièces (Coins)** | Monnaie transactionnelle universelle servant à acheter des boosters dans la boutique. | Victoires de modes, quêtes quotidiennes/hebdomadaires, doublons. | 
| **Points d'XP** | Progression du niveau de compte, déblocage de cosmétiques et réputation dans les classements. | Fins de parties, validation de quêtes. | 
| **Étoiles de Recyclage** | Monnaie de sécurité pour fabriquer directement une carte manquante ciblée. | Recyclage automatique des doublons. | 

## 3. Système de Boosters & Raretés

### 3.1 Caractéristiques du Booster

* **Prix d'achat :** $250\text{ coins}$ *(aligné sur l'interface actuelle)*

* **Contenu :** $3\text{ cartes}$ par booster (coût moyen : $\approx 83\text{ coins}$ par carte)

### 3.2 Répartition des 100 Cartes de la Saison 1

La collection est composée de **10 thèmes de 10 cartes**, chacun suivant rigoureusement la même structure :

* **Communes :** $40\text{ cartes}$ ($40\%$) — $4\text{ cartes par thème}$

* **Rares :** $30\text{ cartes}$ ($30\%$) — $3\text{ cartes par thème}$

* **Épiques :** $20\text{ cartes}$ ($20\%$) — $2\text{ cartes par thème}$

* **Légendaires :** $10\text{ cartes}$ ($10\%$) — $1\text{ carte par thème}$

### 3.3 Taux de Drop Pondérés par Slot

Le troisième emplacement garantit une valeur minimale afin de valoriser chaque ouverture :

* **Emplacements 1 et 2 (Slots Standards) :**

  * Commune : $75\%$

  * Rare : $20\%$

  * Épique : $4\%$

  * Légendaire : $1\%$

* **Emplacement 3 (Slot Rare+ Garanti) :**

  * Rare : $70\%$

  * Épique : $22\%$

  * Légendaire : $8\%$

> **Fréquence statistique :** En moyenne, un booster offre une probabilité cumulée de $1\% + 1\% + 8\% = 10\%$ de tirer une Légendaire (soit $1\text{ Légendaire tous les 10 boosters}$). Sur une saison d'environ $80\text{ boosters}$ ouverts, un joueur obtiendra naturellement $\approx 8\text{ Légendaires}$, les 2 dernières pouvant être fabriquées grâce aux Étoiles de recyclage ou obtenues par échange.

## 4. Grille Complète des Récompenses par Mode

Afin d'étaler la complétion sur $\approx 45\text{ jours}$, l'injection quotidienne de pièces permet l'ouverture d'environ $1{,}8\text{ booster par jour}$ en moyenne.

### 4.1 Modes Solo & Passe-Temps (Offline First)

| **Mode** | **Format** | **Récompense Pièces** | **Récompense XP** | **Fréquence** | 
| **Quiz du Jour** | 3 questions communes | $90\text{ coins}$ *(sans-faute)*  $45\text{ coins}$ *(1 erreur)* | $40\text{ XP}$ | 1 fois / jour | 
| **Mot Mystère (Wordle)** | 6 essais, mot unique | $70\text{ coins}$ | $30\text{ XP}$ | 1 fois / jour | 
| **Grille du Jour (Daily)**  *(Sudoku / Queens / Shikaku)* | 1 grille officielle / jour par type | $60\text{ coins}$ / grille | $25\text{ XP}$ | 1 fois / jour par jeu | 
| **Culture Pop (Solo libre)** | Quiz de 10 questions | $1\text{ coins}$ / bonne réponse | $1\text{ XP}$ / bonne réponse | Illimité | 
| **Entraînement Logique libre**  *(Sudoku / Queens / Shikaku)* | Grilles aléatoires d'entraînement | $10\text{ à }15\text{ coins}$ / grille | $8\text{ XP}$ | Illimité | 

### 4.2 L'Arène Multijoueur (Online / PvP)

| **Mode** | **Condition de Fin** | **Récompense Pièces** | **Récompense XP** | 
| **Chrono-Bomb** | Vainqueur de la table | $40\text{ coins}$ | $35\text{ XP}$ | 
| **Chrono-Bomb** | Élimination précoce | $10\text{ coins}$ | $10\text{ XP}$ | 
| **Quiz Flash 1v1** | Victoire | $35\text{ coins}$ | $30\text{ XP}$ | 
| **Quiz Flash 1v1** | Défaite | $10\text{ coins}$ | $10\text{ XP}$ | 

## 5. Système de Missions en Rotation

Pour renouveler l'intérêt sans saturer le joueur, les missions sont tirées aléatoirement chaque période depuis des viviers (pools) thématisés. Chaque joueur actif se voit attribuer **3 quêtes quotidiennes** et **3 quêtes hebdomadaires**.

### 5.1 Missions Quotidiennes (3 tirées chaque jour à 00:00 UTC)

Le système tire chaque nuit **1 quête dans chaque catégorie** (A, B et C) pour garantir la variété sans bloquer les joueurs qui ne font que du solo ou du multijoueur.

* **Total Quotidien Quêtes :** $\approx 200\text{ coins}$ et $+75\text{ XP}$ (répartis sur les 3 quêtes tirées).

#### Pool A — Routine & Collection (1 mission tirée / jour)

| **Intitulé de la Mission** | **Objectif** | **Récompense Pièces** | **Récompense XP** | 
| **Client Mystère** | Ouvrir 1 booster dans la boutique | $+60\text{ coins}$ | $+20\text{ XP}$ | 
| **Recycleur du Jour** | Obtenir ou recycler au moins 2 doublons | $+60\text{ coins}$ | $+20\text{ XP}$ | 
| **Chasseur de Pièces** | Gagner un total de $180\text{ coins}$ sur la journée | $+70\text{ coins}$ | $+25\text{ XP}$ | 
| **Plein d'Expérience** | Engranger au moins $80\text{ XP}$ | $+60\text{ coins}$ | $+20\text{ XP}$ | 

#### Pool B — Solo & Casse-Tête (1 mission tirée / jour)

| **Intitulé de la Mission** | **Objectif** | **Récompense Pièces** | **Récompense XP** | 
| **Rituel Quotidien** | Compléter le Quiz du Jour ET le Mot Mystère | $+75\text{ coins}$ | $+30\text{ XP}$ | 
| **Esprit Logique** | Résoudre 1 grille du jour (Sudoku, Queens ou Shikaku) | $+65\text{ coins}$ | $+25\text{ XP}$ | 
| **Culture Express** | Répondre correctement à 15 questions en Culture Pop | $+70\text{ coins}$ | $+25\text{ XP}$ | 
| **Maître des Mots** | Trouver le Mot Mystère en 4 essais ou moins | $+75\text{ coins}$ | $+30\text{ XP}$ | 
| **Sans-Faute** | Réaliser un $3/3$ parfait sur le Quiz du Jour | $+75\text{ coins}$ | $+30\text{ XP}$ | 

#### Pool C — Multijoueur & Défi Libre (1 mission tirée / jour)

| **Intitulé de la Mission** | **Objectif** | **Récompense Pièces** | **Récompense XP** | 
| **Baptême du Feu** | Participer à 2 parties dans l'Arène (Chrono-Bomb ou Quiz Flash) | $+70\text{ coins}$ | $+25\text{ XP}$ | 
| **Duel au Sommet** | Remporter 1 duel en Quiz Flash 1v1 | $+75\text{ coins}$ | $+30\text{ XP}$ | 
| **Sang-Froid** | Survivre à au moins 4 tours dans une manche de Chrono-Bomb | $+65\text{ coins}$ | $+25\text{ XP}$ | 
| **Entraînement Intensif** *(Alternative 100% Solo)* | Terminer 2 grilles d'entraînement au choix | $+65\text{ coins}$ | $+25\text{ XP}$ | 

### 5.2 Missions Hebdomadaires (3 tirées chaque lundi à 00:00 UTC)

Les objectifs hebdomadaires sont calibrés sur l'économie réelle d'une semaine ($\approx 3\,300\text{ coins}$ gagnés au total) afin d'éviter tout palier mathématiquement impossible.

* **Total Hebdomadaire Quêtes :** $\approx 1\,100\text{ coins}$ et $+750\text{ XP}$ ($\approx +160\text{ coins}$ lissés par jour).

#### Pool 1 — Volume & Économie (1 mission tirée / semaine)

| **Intitulé de la Mission** | **Objectif** | **Récompense Pièces** | **Récompense XP** | 
| **Grisbi Hebdomadaire** | Amasser un total cumulé de $2\,000\text{ coins}$ | $+380\text{ coins}$ | $+250\text{ XP}$ | 
| **Fidélité au Poste** | Se connecter et jouer lors de 5 jours distincts | $+360\text{ coins}$ | $+220\text{ XP}$ | 
| **Frénésie d'Ouverture** | Ouvrir 10 boosters au cours de la semaine | $+400\text{ coins}$ | $+260\text{ XP}$ | 

#### Pool 2 — Performance Solo & Réflexion (1 mission tirée / semaine)

| **Intitulé de la Mission** | **Objectif** | **Récompense Pièces** | **Récompense XP** | 
| **Marathonien du Savoir** | Répondre correctement à 100 questions en mode Solo | $+370\text{ coins}$ | $+240\text{ XP}$ | 
| **Grand Maître de la Semaine** | Compléter 5 Quiz du Jour et 5 Mots Mystères | $+400\text{ coins}$ | $+270\text{ XP}$ | 
| **Architecte des Grilles** | Venir à bout de 8 grilles de réflexion (tous modes confondus) | $+350\text{ coins}$ | $+230\text{ XP}$ | 

#### Pool 3 — Arène & Collection Avancée (1 mission tirée / semaine)

| **Intitulé de la Mission** | **Objectif** | **Récompense Pièces** | **Récompense XP** | 
| **Terreur de l'Arène** | Remporter 6 victoires en multijoueur (Quiz Flash ou Chrono-Bomb) | $+400\text{ coins}$ | $+280\text{ XP}$ | 
| **Artisan Émérite** | Fabriquer au moins 1 carte manquante dans l'Atelier d'Étoiles | $+350\text{ coins}$ | $+240\text{ XP}$ | 
| **Grand Tirage** | Obtenir 25 cartes au total (nouvelles ou doublons) | $+360\text{ coins}$ | $+250\text{ XP}$ | 
| **Contributeur du QG** | Proposer 3 questions validées pour la communauté | $+380\text{ coins}$ | $+250\text{ XP}$ | 

> ⚠️ **Règle anti-blocage de fin de saison :** Les quêtes du type *"Débloquer X nouvelles cartes uniques"* ont été remplacées par *"Obtenir X cartes (doublons inclus)"* ou *"Fabriquer 1 carte"*. En fin de saison, quand un joueur possède déjà plus de 90 cartes, exiger 12 nouvelles cartes uniques était mathématiquement irréalisable en 7 jours.

## 6. Boucle Journalière Type & Pacing de Saison (45 Jours)

Pour un joueur régulier réalisant sa session quotidienne ($12\text{ à }15\text{ minutes}$) :

$$
\begin{aligned} \text{Quiz du Jour} &= 90\text{ coins} \\ \text{Mot Mystère} &= 70\text{ coins} \\ \text{1 Grille Logique du Jour} &= 60\text{ coins} \\ \text{Missions Quotidiennes (3)} &\approx 200\text{ coins} \\ \text{Lissage Hebdo / Parties libres} &\approx 50\text{ coins} \\ \hline \mathbf{Total\ Moyen\ Journalier} &\approx \mathbf{470\text{ coins}} \quad (\approx 1{,}88\text{ booster / jour} \approx 5{,}6\text{ cartes / jour}) \end{aligned}
$$

### Courbe prévisionnelle sur 1 mois et demi (45 jours) :

```
Cartes Débloquées
  100 |                                                * (Jour 45-50 : 100/100)
       |                                      * * * * 
   80 |                             * * * * 
       |                    * * * *
   50 |           * * * * 
       |   * * * 
    0 +--------------------------------------------------> Temps
        Semaine 1    Semaine 2-3    Semaine 4-5    Semaine 6-7


```

* **Semaines 1 & 2 (Jours 1 à 14 — Phase Découverte) :**

  * $\approx 26\text{ boosters ouverts}$ ($78\text{ tirages}$).

  * Obtention rapide de $45\text{ à }52\text{ cartes uniques}$. Très peu de doublons, les Communes et Rares se remplissent vite.

* **Semaines 3 & 4 (Jours 15 à 30 — Phase de Croisière) :**

  * Progression vers $72\text{ à }80\text{ cartes uniques}$.

  * Les doublons s'intensifient et alimentent la réserve d'Étoiles de craft.

* **Semaines 5 & 6 (Jours 31 à 42 — Le Sprint Final) :**

  * Progression vers $88\text{ à }94\text{ cartes uniques}$.

  * Le tirage naturel ralentit ; la fabrication ciblée permet de terminer les thèmes presque complets.

* **Semaine 7 (Jours 43 à 48 — La Consécration) :**

  * Complétion des dernières cartes Légendaires et Épiques grâce au stock d'Étoiles.

  * Validation du $100/100$ pile au moment du déploiement de la Saison 2.

## 7. Gestion des Doublons & Artisanat (Anti-Blocage)

Tout doublon est immédiatement recyclé en pièces directes ou en **Étoiles de Craft** :

| **Rareté du Doublon** | **Remboursement Pièces** | **OU Étoiles de Craft** | 
| **Commune** | $+15\text{ coins}$ | $+1\text{ Étoile}$ | 
| **Rare** | $+30\text{ coins}$ | $+3\text{ Étoiles}$ | 
| **Épique** | $+60\text{ coins}$ | $+8\text{ Étoiles}$ | 
| **Légendaire** | $+120\text{ coins}$ | $+20\text{ Étoiles}$ | 

### Atelier de Fabrication (Craft ciblé)

Permet d'acheter précisément la carte manquante pour finir une série :

* **1 Carte Commune au choix :** $15\text{ Étoiles}$

* **1 Carte Rare au choix :** $35\text{ Étoiles}$

* **1 Carte Épique au choix :** $80\text{ Étoiles}$

* **1 Carte Légendaire au choix :** $180\text{ Étoiles}$

## 8. L'Album & Récompenses par Collection Thématique

L'album regroupe **10 séries thématiques de 10 cartes** chacune, composées uniformément de $4\text{ Communes}$, $3\text{ Rares}$, $2\text{ Épiques}$ et $1\text{ Légendaire}$ :

 1. *Personnages Historiques*

 2. *Monuments*

 3. *Voitures*

 4. *Espace & Astronomie*

 5. *Mythologie & Légendes*

 6. *Animaux & Biodiversité*

 7. *Gastronomie du Monde*

 8. *Minéraux & Cristaux*

 9. *Phénomènes Naturels*

10. *L'Ordre des Inventions*

### Récompenses de Complétion de Série ($10/10$ cartes) :

* **Bonus de Ressources :** $+250\text{ coins}$ et $+120\text{ XP}$.

* **Titre Honorifique de Profil :** Affiché sous le pseudo dans les salons multijoueurs (ex. *Pilote d'Élite*, *Chef Étoilé*, *Explorateur Galactique*).

* **Badge de Maître :** Sceau doré apposé sur la bannière de la catégorie dans l'Album.

### Récompense Ultime de Fin de Saison ($100/100$ cartes) :

* **Titre Exclusif :** *« Maître du QG — Saison 1 »*.

* **Cosmétique :** Contour d'avatar holographique animé.

* **Carte Secrète Numérotée :** Carte prestige $101/100$ hors-classement.

## 9. Transition Vers les Futures Saisons

* **Packs Héritage :** Les boosters de la Saison 1 basculent dans un onglet « Archives » pour permettre aux retardataires d'acheter des anciens packs avec leurs pièces.

* **Compteurs Indépendants :** Chaque saison conserve sa propre barre de progression ($X/100$) et ses badges dédiés sans écraser l'historique du joueur.