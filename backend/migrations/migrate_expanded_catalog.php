<?php
/**
 * Database Migration: Seeding the expanded 100-card catalog and cosmetics rewards
 */

require_once __DIR__ . '/../src/Config/Database.php';

use App\Config\Database;

echo "=== STARTING EXPANDED CATALOG SEEDING ===\n";

try {
    $db = Database::getConnection();
    $db->beginTransaction();

    // 1. Clear old entries from cosmetics and cards to allow clean re-seeding
    $db->exec("DELETE FROM cosmetics");
    $db->exec("DELETE FROM cards");

    // 2. Seeding Cosmetics Catalog (including new exclusive rewards)
    echo "-> Seeding cosmetics...\n";
    $cosmeticsData = [
        // Pseudo colors (Buyable)
        ['color_red', 'color', '#ef4444', 'Rouge Flamboyant', 200, 'common', 0],
        ['color_blue', 'color', '#3b82f6', 'Bleu Impérial', 200, 'common', 0],
        ['color_green', 'color', '#10b981', 'Vert Émeraude', 200, 'common', 0],
        ['color_purple', 'color', '#8b5cf6', 'Violet Mystique', 400, 'rare', 0],
        ['color_orange', 'color', '#f97316', 'Orange Électrique', 400, 'rare', 0],
        ['color_pink', 'color', '#ec4899', 'Rose Néon', 600, 'rare', 0],
        ['color_gold', 'color', '#eab308', 'Doré Royal', 1000, 'legendary', 0],
        // Pseudo colors (Set Rewards)
        ['color_rainbow', 'color', 'rainbow', 'Arc-en-ciel (Animé)', null, 'legendary', 1],
        ['color_cyberpunk', 'color', 'cyberpunk', 'Néon Cyberpunk', null, 'legendary', 1],

        // Avatar borders (Buyable)
        ['border_silver', 'border', 'border-silver', 'Bordure Argentée', 300, 'rare', 0],
        ['border_gold', 'border', 'border-gold', 'Bordure Dorée', 800, 'legendary', 0],
        ['border_neon', 'border', 'border-neon', 'Bordure Néon', 1200, 'legendary', 0],
        ['border_fire', 'border', 'border-fire', 'Bordure de Feu', 1500, 'legendary', 0],
        // Avatar borders (Set Rewards)
        ['border_cosmic', 'border', 'border-cosmic', 'Bordure Cosmique (Animée)', null, 'legendary', 1],
        ['border_nebula', 'border', 'border-nebula', 'Bordure Nébuleuse (Animée)', null, 'legendary', 1],
        ['border_crystal', 'border', 'border-crystal', 'Bordure de Cristal (Scintillante)', null, 'legendary', 1],
        ['border_storm', 'border', 'border-storm', 'Bordure Tempête (Électrique)', null, 'legendary', 1],

        // Titles (Buyable)
        ['title_novice', 'title', 'Le Novice', 'Le Novice', 100, 'common', 0],
        ['title_encyclopedia', 'title', 'L\'Encyclopédie', 'L\'Encyclopédie', 450, 'rare', 0],
        ['title_judge', 'title', 'Le Magistrat', 'Le Magistrat', 500, 'rare', 0],
        ['title_imposteur', 'title', 'L\'Imposteur', 'L\'Imposteur', 500, 'rare', 0],
        ['title_invincible', 'title', 'L\'Invincible', 'L\'Invincible', 800, 'legendary', 0],
        ['title_brain', 'title', 'Le Cerveau', 'Le Cerveau', 1000, 'legendary', 0],
        // Titles (Set Rewards)
        ['title_historical', 'title', 'Le Génie Historique', 'Le Génie Historique', null, 'legendary', 1],
        ['title_space', 'title', 'L\'Astronaute Égaré', 'L\'Astronaute Égaré', null, 'legendary', 1],
        ['title_demigod', 'title', 'Le Demi-Dieu', 'Le Demi-Dieu', null, 'legendary', 1],
        ['title_predator', 'title', 'Le Prédateur Alpha', 'Le Prédateur Alpha', null, 'legendary', 1],
        ['title_chef', 'title', 'Le Chef Étoilé', 'Le Chef Étoilé', null, 'legendary', 1]
    ];

    $stmtCos = $db->prepare("
        INSERT INTO cosmetics (id, item_type, item_value, name, price, rarity, is_exclusive) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    foreach ($cosmeticsData as $item) {
        $stmtCos->execute($item);
    }
    echo "✅ Seeded " . count($cosmeticsData) . " cosmetics (catalog + set rewards).\n";

    // 3. Seeding cards catalog (10 sets of 10 cards = 100 cards)
    echo "-> Seeding expanded cards catalog...\n";
    $cardsData = [
        // Set 1: Les Célébrités (10 cards)
        ['card_einstein', 'Albert Einstein', 'epic', 'Les Célébrités', 'Le grand théoricien de la relativité générale.', null],
        ['card_curie', 'Marie Curie', 'legendary', 'Les Célébrités', 'Pionnière de la radioactivité et double lauréate du Prix Nobel.', null],
        ['card_napoleon', 'Napoléon Bonaparte', 'rare', 'Les Célébrités', 'Empereur des Français et grand stratège militaire.', null],
        ['card_cleopatre', 'Cléopâtre', 'epic', 'Les Célébrités', 'La légendaire reine d\'Égypte antique au charisme captivant.', null],
        ['card_soleil', 'Le Roi Soleil', 'rare', 'Les Célébrités', 'Louis XIV, le monarque bâtisseur de Versailles.', null],
        ['card_da_vinci', 'Léonard de Vinci', 'rare', 'Les Célébrités', 'Le génie polymathe italien de la Renaissance.', null],
        ['card_shakespeare', 'William Shakespeare', 'common', 'Les Célébrités', 'Le plus célèbre dramaturge de la langue anglaise.', null],
        ['card_gandhi', 'Mahatma Gandhi', 'common', 'Les Célébrités', 'Le guide spirituel de la résistance non-violente en Inde.', null],
        ['card_mozart', 'Wolfgang Amadeus Mozart', 'common', 'Les Célébrités', 'Le prodige de la musique classique autrichienne.', null],
        ['card_socrates', 'Socrate', 'common', 'Les Célébrités', 'Le père de la philosophie morale occidentale.', null],

        // Set 2: Les Monuments (10 cards)
        ['card_eiffel', 'Tour Eiffel', 'rare', 'Les Monuments', 'La dame de fer qui domine fièrement le ciel de Paris.', null],
        ['card_muraille', 'Grande Muraille', 'rare', 'Les Monuments', 'Une fortification défensive millénaire visible de l\'espace.', null],
        ['card_pyramides', 'Pyramides de Gizeh', 'rare', 'Les Monuments', 'Les tombeaux géants des pharaons de l\'Ancien Empire.', null],
        ['card_liberte', 'Statue de la Liberté', 'epic', 'Les Monuments', 'Symbole universel de liberté érigé dans la baie de New York.', null],
        ['card_colisee', 'Le Colisée', 'epic', 'Les Monuments', 'L\'immense amphithéâtre romain témoin des combats de gladiateurs.', null],
        ['card_taj_mahal', 'Taj Mahal', 'common', 'Les Monuments', 'Le magnifique mausolée de marbre blanc construit en Inde.', null],
        ['card_machu_picchu', 'Machu Picchu', 'legendary', 'Les Monuments', 'L\'ancienne cité inca perchée dans les Andes péruviennes.', null],
        ['card_petra', 'Le Khazneh de Pétra', 'common', 'Les Monuments', 'Le monument sculpté à même la roche dans le désert jordanien.', null],
        ['card_big_ben', 'Big Ben', 'common', 'Les Monuments', 'La fameuse horloge du palais de Westminster à Londres.', null],
        ['card_christ_redempteur', 'Christ Rédempteur', 'common', 'Les Monuments', 'La grande statue qui veille sur la baie de Rio de Janeiro.', null],

        // Set 3: Les Voitures (10 cards)
        ['card_f40', 'Ferrari F40', 'legendary', 'Les Voitures', 'La supercar italienne brute légendaire des années 80.', null],
        ['card_chiron', 'Bugatti Chiron', 'epic', 'Les Voitures', 'Un monstre de puissance moderne atteignant les 400 km/h.', null],
        ['card_911', 'Porsche 911', 'epic', 'Les Voitures', 'La silhouette indémodable de la sportive allemande par excellence.', null],
        ['card_tesla', 'Tesla Roadster', 'rare', 'Les Voitures', 'L\'accélération électrique foudroyante qui défie les lois physiques.', null],
        ['card_mustang', 'Ford Mustang 1969', 'rare', 'Les Voitures', 'L\'archétype de la muscle car américaine vrombissante.', null],
        ['card_beetle', 'Coccinelle VW', 'common', 'Les Voitures', 'La voiture populaire historique la plus vendue au monde.', null],
        ['card_supra', 'Toyota Supra MK4', 'rare', 'Les Voitures', 'La reine du tuning japonais et des courses de rue.', null],
        ['card_db5', 'Aston Martin DB5', 'common', 'Les Voitures', 'L\'élégance britannique équipée de gadgets d\'agent secret.', null],
        ['card_miata', 'Mazda MX-5 Miata', 'common', 'Les Voitures', 'Le petit roadster maniable, synonyme de plaisir de conduite brut.', null],
        ['card_aventador', 'Lamborghini Aventador', 'common', 'Les Voitures', 'Le design agressif et le rugissement du V12 atmosphérique.', null],

        // Set 4: L'Espace et l'Astronomie (10 cards)
        ['card_apollo_11', 'Apollo 11', 'legendary', "L'Espace et l'Astronomie", 'La mission historique qui a déposé le premier homme sur la Lune en 1969.', null],
        ['card_mars', 'Planète Mars', 'epic', "L'Espace et l'Astronomie", 'La planète rouge, cible privilégiée des futures explorations humaines.', null],
        ['card_trou_noir', 'Trou Noir', 'epic', "L'Espace et l'Astronomie", 'Une singularité gravitationnelle de laquelle rien ne peut s\'échapper.', null],
        ['card_curiosity', 'Rover Curiosity', 'rare', "L'Espace et l'Astronomie", 'Le laboratoire robotisé qui arpente le cratère Gale sur Mars.', null],
        ['card_voie_lactee', 'La Voie Lactée', 'rare', "L'Espace et l'Astronomie", 'Notre galaxie spirale barrée contenant des milliards d\'étoiles.', null],
        ['card_supernova', 'Supernova', 'rare', "L'Espace et l'Astronomie", 'L\'explosion gigantesque marquant la mort d\'une étoile massive.', null],
        ['card_iss', 'L\'ISS', 'common', "L'Espace et l'Astronomie", 'La station spatiale internationale en orbite terrestre basse.', null],
        ['card_telescope_hubble', 'Télescope Hubble', 'common', "L'Espace et l'Astronomie", 'L\'observatoire orbital qui a révolutionné notre vision du cosmos.', null],
        ['card_etoile_filante', 'Étoile Filante', 'common', "L'Espace et l'Astronomie", 'Un météoroïde qui s\'enflamme en traversant l\'atmosphère.', null],
        ['card_lune', 'La Lune', 'common', "L'Espace et l'Astronomie", 'Le satellite naturel de la Terre qui orchestre les marées.', null],

        // Set 5: Mythologie et Légendes (10 cards)
        ['card_zeus', 'Zeus', 'legendary', 'Mythologie et Légendes', 'Le roi des dieux de l\'Olympe, maître de la foudre.', null],
        ['card_anubis', 'Anubis', 'epic', 'Mythologie et Légendes', 'Le dieu égyptien à tête de chacal, gardien des nécropoles.', null],
        ['card_odin', 'Odin', 'epic', 'Mythologie et Légendes', 'Le dieu borgne souverain d\'Asgard dans la mythologie nordique.', null],
        ['card_kraken', 'Le Kraken', 'rare', 'Mythologie et Légendes', 'Le monstre marin calmar géant qui brise les navires.', null],
        ['card_phenix', 'Le Phénix', 'rare', 'Mythologie et Légendes', 'L\'oiseau fabuleux capable de renaître de ses propres cendres.', null],
        ['card_minotaure', 'Le Minotaure', 'rare', 'Mythologie et Légendes', 'La créature mi-homme mi-taureau enfermée dans le labyrinthe.', null],
        ['card_satyre', 'Le Satyre', 'common', 'Mythologie et Légendes', 'Une divinité champêtre mi-homme mi-bouc aimant la fête.', null],
        ['card_excalibur', 'Excalibur', 'common', 'Mythologie et Légendes', 'L\'épée mythique du roi Arthur retirée de l\'enclume.', null],
        ['card_mjolnir', 'Le Marteau de Thor', 'common', 'Mythologie et Légendes', 'L\'arme nordique dévastatrice forgée par les nains.', null],
        ['card_pegase', 'Pégase', 'common', 'Mythologie et Légendes', 'Le cheval ailé divin né du sang de la Méduse.', null],

        // Set 6: Animaux et Biodiversité (10 cards)
        ['card_guepard', 'Le Guépard', 'rare', 'Animaux et Biodiversité', 'Le mammifère terrestre le plus rapide du monde.', null],
        ['card_orque', 'L\'Orque', 'epic', 'Animaux et Biodiversité', 'Le super-prédateur des océans, extrêmement intelligent.', null],
        ['card_tardigrade', 'Le Tardigrade', 'epic', 'Animaux et Biodiversité', 'Le microscopique ourson d\'eau résistant aux pires extrêmes.', null],
        ['card_trex', 'T-Rex', 'legendary', 'Animaux et Biodiversité', 'Le roi redoutable des dinosaures du Crétacé.', null],
        ['card_dodo', 'Le Dodo', 'rare', 'Animaux et Biodiversité', 'L\'oiseau disparu de l\'île Maurice, symbole de l\'impact humain.', null],
        ['card_megalodon', 'Le Mégalodon', 'rare', 'Animaux et Biodiversité', 'Le requin géant préhistorique fossile de 18 mètres.', null],
        ['card_tigre_blanc', 'Le Tigre Blanc', 'common', 'Animaux et Biodiversité', 'Le félin majestueux au pelage immaculé du Bengale.', null],
        ['card_chat_gouttiere', 'Le Chat de Gouttière', 'common', 'Animaux et Biodiversité', 'Le compagnon agile du quotidien, maître des ruelles.', null],
        ['card_pigeon', 'Le Pigeon', 'common', 'Animaux et Biodiversité', 'Le roi incontesté des places publiques et des parcs urbains.', null],
        ['card_panda', 'Le Panda Géant', 'common', 'Animaux et Biodiversité', 'Le gros mammifère herbivore friand de bambou.', null],

        // Set 7: Gastronomie du Monde (10 cards)
        ['card_pizza', 'Pizza Margherita', 'common', 'Gastronomie du Monde', 'Le classique napolitain aux couleurs de l\'Italie.', null],
        ['card_sushi', 'Sushi', 'common', 'Gastronomie du Monde', 'L\'art de la découpe du poisson et du riz vinaigré au Japon.', null],
        ['card_tacos', 'Tacos', 'common', 'Gastronomie du Monde', 'La tortilla mexicaine garnie de viande et de coriandre.', null],
        ['card_truffe', 'Truffe Blanche', 'legendary', 'Gastronomie du Monde', 'Le champignon souterrain d\'Alba au parfum incomparable.', null],
        ['card_safran', 'Le Safran', 'epic', 'Gastronomie du Monde', 'L\'épice la plus chère du monde issue des pistils de crocus.', null],
        ['card_wagyu', 'Bœuf Wagyu', 'epic', 'Gastronomie du Monde', 'La viande persillée japonaise d\'une tendreté légendaire.', null],
        ['card_caviar', 'Caviar Béluga', 'rare', 'Gastronomie du Monde', 'Les œufs précieux d\'esturgeon synonymes de grand luxe.', null],
        ['card_croissant', 'Croissant Français', 'common', 'Gastronomie du Monde', 'La viennoiserie croustillante au feuilletage pur beurre.', null],
        ['card_chips', 'Paquet de Chips', 'rare', 'Gastronomie du Monde', 'Le compagnon croustillant et salé indispensable de l\'apéro.', null],
        ['card_ramen', 'Ramen', 'rare', 'Gastronomie du Monde', 'Le bol réconfortant de nouilles japonaises dans un bouillon mijoté.', null],

        // Set 8: Cristaux et Minéraux (10 cards)
        ['card_quartz', 'Le Quartz', 'common', 'Cristaux et Minéraux', 'Le minéral le plus commun, aux cristaux prismatiques limpides.', null],
        ['card_amethyste', 'L\'Améthyste', 'common', 'Cristaux et Minéraux', 'La variété de quartz violette prisée en joaillerie.', null],
        ['card_rubis_gem', 'Le Rubis', 'epic', 'Cristaux et Minéraux', 'La pierre précieuse rouge vif de la famille des corindons.', null],
        ['card_diamant', 'Le Diamant Pur', 'legendary', 'Cristaux et Minéraux', 'Le carbone pur cristallisé, matériau le plus dur connu.', null],
        ['card_meteorite', 'La Météorite', 'epic', 'Cristaux et Minéraux', 'Le fragment de roche spatiale rescapé de sa chute sur Terre.', null],
        ['card_emeraude_gem', 'L\'Émeraude', 'rare', 'Cristaux et Minéraux', 'La pierre précieuse verte au teint envoûtant de beryl.', null],
        ['card_obsidienne', 'L\'Obsidienne', 'rare', 'Cristaux et Minéraux', 'Le verre volcanique noir et tranchant comme un rasoir.', null],
        ['card_jade', 'Le Jade', 'rare', 'Cristaux et Minéraux', 'La pierre verte ornementale hautement sacrée en Asie.', null],
        ['card_charbon', 'Le Charbon', 'common', 'Cristaux et Minéraux', 'La roche sédimentaire noire combustible fossile.', null],
        ['card_or_gem', 'Pépite d\'Or', 'common', 'Cristaux et Minéraux', 'Le métal jaune natif inaltérable symbole de richesse.', null],

        // Set 9: Phénomènes Naturels (10 cards)
        ['card_orage', 'L\'Orage', 'common', 'Phénomènes Naturels', 'La décharge électrique lumineuse accompagnée de tonnerre.', null],
        ['card_arc_en_ciel_phenomene', 'L\'Arc-en-Ciel', 'common', 'Phénomènes Naturels', 'La décomposition de la lumière à travers les gouttes d\'eau.', null],
        ['card_tornade', 'La Tornade', 'rare', 'Phénomènes Naturels', 'Le tourbillon de vent violent dévastateur en entonnoir.', null],
        ['card_tsunami', 'Le Tsunami', 'epic', 'Phénomènes Naturels', 'L\'onde océanique géante provoquée par un séisme sous-marin.', null],
        ['card_volcan', 'L\'Éruption Volcanique', 'rare', 'Phénomènes Naturels', 'Le jaillissement de lave incandescente et de cendres.', null],
        ['card_aurore', 'L\'Aurore Boréale', 'legendary', 'Phénomènes Naturels', 'Le rideau de lumière verte ondulant dans les ciels polaires.', null],
        ['card_seisme', 'Le Séisme', 'rare', 'Phénomènes Naturels', 'La secousse brusque provoquant la fracture de la croûte terrestre.', null],
        ['card_eclipse', 'L\'Éclipse Solaire', 'epic', 'Phénomènes Naturels', 'L\'alignement parfait de la Lune qui masque le Soleil.', null],
        ['card_geyser', 'Le Geyser', 'common', 'Phénomènes Naturels', 'La projection intermittente d\'eau chaude et de vapeur sous pression.', null],
        ['card_avalanche', 'L\'Avalanche', 'common', 'Phénomènes Naturels', 'La descente rapide de neige sur un versant montagneux.', null],

        // Set 10: Les Grandes Inventions (10 cards)
        ['card_roue', 'La Roue', 'common', 'Les Grandes Inventions', 'L\'invention fondamentale de la mécanique antique.', null],
        ['card_imprimerie', 'L\'Imprimerie', 'rare', 'Les Grandes Inventions', 'La presse à caractères mobiles inventée par Gutenberg.', null],
        ['card_ampoule', 'L\'Ampoule Électrique', 'common', 'Les Grandes Inventions', 'L\'illumination nocturne domestique par incandescence.', null],
        ['card_avion', 'L\'Avion', 'rare', 'Les Grandes Inventions', 'La conquête des airs par des machines plus lourdes que l\'air.', null],
        ['card_ordinateur', 'Le Premier Ordinateur', 'rare', 'Les Grandes Inventions', 'La machine de calcul automatique programmable de Turing.', null],
        ['card_internet', 'L\'Internet', 'legendary', 'Les Grandes Inventions', 'Le réseau informatique mondial interconnectant l\'humanité.', null],
        ['card_ia', 'L\'Intelligence Artificielle', 'epic', 'Les Grandes Inventions', 'Les systèmes capables de simuler des processus cognitifs humains.', null],
        ['card_feu', 'La Maîtrise du Feu', 'epic', 'Les Grandes Inventions', 'L\'étincelle primitive qui a permis la cuisson et la survie.', null],
        ['card_boussole', 'La Boussole', 'common', 'Les Grandes Inventions', 'L\'aiguille aimantée indiquant le nord magnétique terrestre.', null],
        ['card_telephone', 'Le Téléphone', 'common', 'Les Grandes Inventions', 'La transmission instantanée de la voix humaine à distance.', null]
    ];

    $stmtCard = $db->prepare("
        INSERT INTO cards (id, name, rarity, card_set, description, image_url) 
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    foreach ($cardsData as $card) {
        // Double check escaping strings if any double quotes in future, but prepare handles it
        $stmtCard->execute($card);
    }
    echo "✅ Seeded " . count($cardsData) . " cards successfully.\n";

    $db->commit();
    echo "=== EXPANDED CATALOG SEEDING COMPLETED SUCCESSFULLY ===\n";

} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    echo "❌ Error during seeding: " . $e->getMessage() . "\n";
    exit(1);
}
