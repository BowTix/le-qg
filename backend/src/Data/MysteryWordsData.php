<?php
namespace App\Data;

class MysteryWordsData {
    /**
     * Common French 5-letter words (Targets / Solutions)
     * All uppercase, non-accented (A-Z)
     */
    private static array $targets = [
        "ABRIC", "ACCES", "ACIER", "ACTIF", "ADIEU", "ADMET", "ADORE", "AGENT", "AGILE", "AIDER",
        "AIGLE", "AIMER", "AINEE", "AINSI", "ALBUM", "ALLER", "ALORS", "AMBRE", "AMOUR", "AMPLE",
        "AMUSE", "ANCRE", "ANGEL", "ANGLE", "ANIME", "ANNEE", "APPEL", "APRES", "ARBRE", "ARENE",
        "ARGOT", "ARRET", "AROME", "ASIEZ", "ASILE", "ASTRE", "ATLAS", "ATOME", "AUCUN", "AUDIO",
        "AUDIT", "AUTEL", "AUTRE", "AVANT", "AVARE", "AVENI", "AVION", "AVOIR", "AVOUÉ", "AVRIL",
        "AZOTE", "BAGUE", "BAINS", "BALAI", "BALLE", "BANAL", "BANCO", "BANDE", "BARBE", "BARON",
        "BARRE", "BASSE", "BATIR", "BATON", "BATTU", "BAVAR", "BEAUT", "BERGE", "BETON", "BIBLE",
        "BIERE", "BIJOU", "BILAN", "BILIS", "BILLE", "BIQUE", "BISON", "BLANC", "BLOND", "BLOUS",
        "BOIRE", "BOITE", "BOMBE", "BONTE", "BORDE", "BOTTE", "BOULE", "BOURG", "BOUTE", "BRAVE",
        "BRIEF", "BRISE", "BRODE", "BRUIT", "BRULE", "BRUME", "BRUTE", "BUCHE", "BUDGET", "BULLE",
        "BUREL", "BUTIN", "CABLE", "CACAH", "CACHE", "CADRE", "CAFES", "CAGOT", "CALME", "CAMEL",
        "CAMIN", "CANAL", "CANAP", "CANIF", "CANOT", "CAPOT", "CARAT", "CARPE", "CARRE", "CARTE",
        "CASSE", "CATHO", "CAUSE", "CAVAL", "CEDRE", "CELLE", "CELUI", "CENSE", "CERCE", "CERF",
        "CESAR", "CHAIR", "CHAMP", "CHANT", "CHAOS", "CHAUD", "CHAUX", "CHEF", "CHENE", "CHERE",
        "CHERI", "CHIEN", "CHINE", "CHIPS", "CHOC", "CHOIX", "CHOSE", "CHUTE", "CIBLE", "CIDRE",
        "CIEUX", "CIGAL", "CINMA", "CIRER", "CIRQUE", "CITER", "CIVIL", "CLAIR", "CLAME", "CLART",
        "CLASSE", "CLEFS", "CLERC", "CLICH", "CLONE", "CLOPE", "CLORE", "CLOUX", "CLOWN", "COBRA",
        "COCON", "COEUR", "COFFR", "COLIS", "COLLE", "COLON", "COMAT", "COMTE", "CONTE", "COPAI",
        "COPIE", "CORDE", "CORNE", "CORPS", "CORSE", "COTON", "COUDE", "COULE", "COUPE", "COURT",
        "COURS", "COUSU", "COUTE", "CRANE", "CRASH", "CREDO", "CREME", "CREPE", "CREUX", "CRIBL",
        "CRIER", "CRIME", "CRISE", "CROIX", "CRUOR", "CUBES", "CUIRE", "CUITE", "CUIVR", "CULTE",
        "CYGNE", "CYCLE", "DALLE", "DAMAS", "DANSE", "DARDS", "DATER", "DEBAT", "DEBIT", "DEBUT",
        "DECOR", "DELAI", "DELTA", "DEMIE", "DEMON", "DENSE", "DENTS", "DEPOT", "DETTE", "DEUIL",
        "DEVIN", "DEVIS", "DEVOT", "DIABLE", "DIGNE", "DIGUE", "DINER", "DISPO", "DIVAN", "DIVIN",
        "DOIGT", "DONNE", "DORER", "DORMI", "DOUTE", "DOUCE", "DOYEN", "DRAME", "DRAPE", "DROLE",
        "DUCHE", "DURCI", "DURER", "ECHEC", "ECHOS", "ECLAT", "ECOLE", "ECRAN", "ECRIT", "ECROU",
        "ECUME", "EDITE", "EFFET", "ELAN", "ELEVE", "ELITE", "ELOGE", "EMAIL", "EMBAR", "EMBRU",
        "EMPAN", "ENCRE", "ENFER", "ENGIN", "ENJEU", "ENNOI", "ENVOI", "EPAIS", "EPICE", "EPINE",
        "EPOUX", "EQUIP", "ERIGE", "ESSAI", "ESSOR", "ETAGE", "ETAIN", "ETANG", "ETAPE", "ETATS",
        "ETUDE", "EVITE", "EXACT", "EXCES", "EXIGE", "EXILE", "EXODE", "EXPAT", "EXTRA", "FABLE",
        "FACHE", "FACON", "FAGOT", "FAIRE", "FAITE", "FALOT", "FARCE", "FARDE", "FATAL", "FAUVE",
        "FAUX", "FAVOR", "FEMME", "FENTE", "FERAL", "FERME", "FETER", "FIBRE", "FICHE", "FIEFS",
        "FIERE", "FIEVR", "FIGUE", "FILLE", "FILMS", "FINAL", "FIXER", "FLAIR", "FLAMB", "FLAMME",
        "FLEAU", "FLEUR", "FLIC", "FLOTT", "FLUID", "FOIRE", "FOLIE", "FORCE", "FORGE", "FORME",
        "FORTE", "FOSSE", "FOUET", "FOULE", "FOURS", "FOYER", "FRAIS", "FRANC", "FREIN", "FRERE",
        "FROID", "FRONT", "FRUIT", "FUMEE", "FUMER", "FURET", "FURIE", "FUSIL", "FUTUR", "GAFFE",
        "GAGNE", "GAINE", "GALET", "GAMME", "GANTS", "GARDE", "GARES", "GELER", "GEMME", "GENIE",
        "GENOU", "GENRE", "GERME", "GEST", "GESTE", "GIBET", "GIFLE", "GILET", "GLACE", "GLOIRE",
        "GOMME", "GORGE", "GOUFF", "GOURD", "GOUT", "GOUTE", "GRACE", "GRADE", "GRAIN", "GRAND",
        "GRAVE", "GREVE", "GRIFE", "GRILL", "GROS", "GROUPE", "GUERE", "GUIDE", "GUIVE", "HAINE",
        "HALLE", "HAMAC", "HANTE", "HARPE", "HASTE", "HAUTE", "HAVRE", "HERBE", "HERON", "HEROS",
        "HEURE", "HIBOU", "HIVRE", "HOMME", "HONTE", "HORDE", "HOTEL", "HOULE", "HUILE", "HUMAIN",
        "HUMBE", "HUMOR", "HURLE", "HYMNE", "ICONE", "IDEAL", "IDEES", "IDIOT", "IMAGE", "IMPACT",
        "INDEX", "INDOU", "INOUÏ", "INTRO", "INVIT", "ISLAM", "ISSUE", "IVOIRE", "JADIS", "JALON",
        "JAMBE", "JANTE", "JAPON", "JARDIN", "JAUNE", "JETON", "JEUNE", "JOIE", "JOUER", "JOUET",
        "JOURS", "JOYAU", "JUGEE", "JUGER", "JUIFS", "JUIN", "JULES", "JUPE", "JUPON", "JURYS",
        "JUSTE", "KAPOK", "KARMA", "KAYAK", "KEPIS", "KILOS", "KRAFT", "KRILL", "LABEL", "LACET",
        "LAINE", "LAÏQUE", "LAMPE", "LANCE", "LAPIN", "LARGE", "LARME", "LASER", "LATIN", "LAVAL",
        "LECON", "LEGAT", "LEGER", "LEMME", "LENTE", "LEPRE", "LESTE", "LEUR", "LEVEE", "LEVER",
        "LIANE", "LIBRE", "LIENS", "LIGNE", "LILAS", "LIMES", "LINCE", "LINGE", "LIONS", "LIRES",
        "LISSE", "LISTE", "LITRE", "LIVRE", "LOCAL", "LOGIS", "LOIRE", "LONGE", "LOTUS", "LOUER",
        "LOURD", "LOYAL", "LOYER", "LUEUR", "LUNES", "LUTIN", "LUTTE", "LYCEE", "MAIRE", "MAJOR",
        "MALIN", "MALLE", "MANGE", "MANIE", "MANTE", "MAREE", "MARGE", "MARIE", "MARIN", "MARNE",
        "MAROC", "MARTE", "MASSE", "MATCH", "MATIN", "MATTE", "MAUVE", "MECHE", "MEDIA", "MEDOC",
        "MELON", "MENER", "MENTE", "MERCI", "MERLE", "MESSE", "METAL", "METEO", "METRE", "METTE",
        "MICRO", "MIEUX", "MILAN", "MILLE", "MINCE", "MINOU", "MIRET", "MIROIR", "MISER", "MIXTE",
        "MOBILE", "MOCHE", "MODEM", "MOINE", "MOINS", "MOISI", "MOITE", "MOLLE", "MOMIE", "MONDE",
        "MONTE", "MOQUE", "MORAL", "MORCE", "MORTE", "MOTEL", "MOTIF", "MOTO", "MOULE", "MOUSSE",
        "MOYEN", "MULET", "MURET", "MUSEE", "MUTIN", "MYTHE", "NACRE", "NAGER", "NAINE", "NAPPE",
        "NATAL", "NATIF", "NATTE", "NAVAL", "NAVET", "NAZIS", "NEANT", "NEIGE", "NERFS", "NETTE",
        "NEUVE", "NEVEU", "NICHE", "NID", "NIVEAU", "NOBLE", "NOIRE", "NOCES", "NOEUD", "NOMBR",
        "NOIRES", "NORME", "NOTRE", "NOUER", "NOYAU", "NUAGE", "NUIRE", "NUITS", "OBEIR", "OBJET",
        "OBLIG", "OCULI", "ODEUR", "OFFRE", "OISEAU", "OLIVE", "OMBRE", "ONCLE", "ONGLE", "OPERA",
        "OPINE", "ORAGE", "ORBIT", "ORDRE", "ORGUE", "ORVAL", "ORVET", "OSCAR", "OTAGE", "OUCHE",
        "OUEST", "OURS", "OUTIL", "OUTRE", "OVALE", "OVULE", "OXYDE", "PACIF", "PACTE", "PAGE",
        "PAIEN", "PAILLE", "PAIRE", "PALES", "PALME", "PANEL", "PANER", "PANNE", "PAPI", "PAQUE",
        "PARCS", "PARDI", "PARIS", "PARLE", "PAROI", "PARTE", "PARTI", "PASSE", "PATER", "PATIO",
        "PATTE", "PAUME", "PAUSE", "PAYER", "PEAGE", "PECHE", "PEDAL", "PEINE", "PEINT", "PELLE",
        "PENAL", "PENCH", "PENTE", "PERCE", "PERDU", "PERLE", "PERTE", "PESER", "PESTE", "PETIT",
        "PETRI", "PEURS", "PHARE", "PHASE", "PHOTO", "PIANO", "PIECE", "PIEGE", "PIERRE", "PIETE",
        "PILOT", "PINCE", "PINTE", "PIQUE", "PIRAT", "PISTE", "PITIE", "PITON", "PIVOT", "PIZZA",
        "PLACE", "PLAGE", "PLAID", "PLAIE", "PLAIN", "PLAIS", "PLANE", "PLANT", "PLATE", "PLEIN",
        "PLEUR", "PLOMB", "PLUIE", "PLUME", "PNEUS", "POCHE", "POEME", "POESIE", "POIDS", "POING",
        "POINT", "POIRE", "POLAR", "POLIE", "POMME", "POMPE", "PONEY", "PONTE", "PORTS", "POSER",
        "POSTE", "POTIN", "POUCE", "POULE", "POULS", "POURR", "PREAU", "PRETE", "PRETS", "PRIER",
        "PRIME", "PRISE", "PRIVE", "PROBA", "PROIE", "PROLO", "PROSE", "PROUT", "PUCES", "PUITS",
        "PULPE", "PURGE", "QUAIS", "QUAND", "QUANT", "QUART", "QUASI", "QUELS", "QUETE", "QUEUE",
        "QUOTA", "RABBI", "RABOT", "RACER", "RADAR", "RADIA", "RADIO", "RADIS", "RAFLE", "RAGE",
        "RAIDE", "RAILS", "RAIS", "RAISON", "RAMPE", "RANGS", "RAPID", "RATER", "RAYON", "REAGI",
        "REBUT", "RECIF", "RECIT", "REGLE", "REGNE", "REINE", "REJET", "RELAX", "RELIE", "REMAR",
        "REMET", "REMIS", "REPAS", "REPIT", "REPOS", "RESTA", "RESTE", "REVUE", "RHUME", "RICHE",
        "RIDE", "RIDER", "RIGOL", "RINCE", "RIVAL", "ROBOT", "ROCHE", "ROLES", "ROMAN", "RONDE",
        "ROUGE", "ROUIR", "ROULE", "ROUTE", "RUBAN", "RUBIS", "RUCHE", "RUINE", "SABLE", "SABOT",
        "SABRE", "SACHA", "SACRE", "SAGES", "SAINE", "SAINT", "SAISI", "SALES", "SALLE", "SALON",
        "SALSA", "SALUE", "SANTE", "SAPIN", "SAUCE", "SAULE", "SAUTE", "SAUVE", "SAVON", "SCEAU",
        "SCENE", "SCORE", "SCOUT", "SEDUI", "SEIZE", "SELLE", "SEMIS", "SENAT", "SENSE", "SERGE",
        "SERIE", "SERRE", "SERUM", "SEUIL", "SIEGE", "SIEST", "SIGNE", "SIMIL", "SINGE", "SIROP",
        "SITUE", "SNOB", "SOBRE", "SOCLE", "SOEUR", "SOLAR", "SOLDE", "SOMME", "SONDE", "SONGE",
        "SORTE", "SORTI", "SOUCI", "SOUPE", "SOURD", "SOURS", "SOUS", "SOUTE", "SPORT", "STAGE",
        "STAND", "STARS", "STYLE", "SUCRE", "SUEDE", "SUEUR", "SUFFI", "SUITE", "SUJET", "SUPER",
        "TABLE", "TABOU", "TACHE", "TALON", "TALUS", "TAMIS", "TANGO", "TAPIS", "TARDE", "TARIF",
        "TASSE", "TAUX", "TAXIS", "TELYS", "TEMPO", "TEMPS", "TENIR", "TENTE", "TENUE", "TERME",
        "TERNE", "TERRE", "TEXTE", "THEME", "THESE", "TIEDE", "TIENS", "TIERS", "TIGRE", "TITRE",
        "TOILE", "TOITS", "TOMBE", "TONNE", "TOPIC", "TORCH", "TORSE", "TOTAL", "TOUCH", "TOUR",
        "TOURS", "TRACE", "TRACT", "TRAIN", "TRAIT", "TRAME", "TRAPE", "TREVE", "TRIBU", "TROMB",
        "TRONC", "TROPE", "TROUS", "TRUC", "TUBES", "TUEUR", "TULIP", "TYRAN", "UNION", "UNITE",
        "URBAN", "USINE", "USUEL", "USURE", "UTILE", "VAGUE", "VAINE", "VALET", "VALSE", "VALUE",
        "VANNE", "VAPEUR", "VASTE", "VELOS", "VEINE", "VENDE", "VENIR", "VENTE", "VENTS", "VENUS",
        "VERBE", "VERRE", "VERSO", "VERTI", "VERVE", "VESTE", "VETIR", "VEUFS", "VICIE", "VIDEO",
        "VIDER", "VIGIE", "VIGNE", "VILLE", "VINGT", "VIRAL", "VIRUS", "VISER", "VITAL", "VITRE",
        "VIVRE", "VOILE", "VOIRE", "VOLE", "VOLER", "VOLTS", "VOTER", "VOUER", "VOULU", "VOYOU",
        "VRAIE", "WAGON", "YACHT", "ZEBRE", "ZELEE", "ZEROS"
    ];

    private static ?array $dictionary = null;

    /**
     * Remove accents and normalize to uppercase A-Z
     */
    public static function normalizeWord(string $str): string {
        $str = mb_strtolower(trim($str), 'UTF-8');
        $unwanted = [
            'à'=>'a', 'á'=>'a', 'â'=>'a', 'ã'=>'a', 'ä'=>'a', 'å'=>'a', 'æ'=>'ae',
            'ç'=>'c',
            'è'=>'e', 'é'=>'e', 'ê'=>'e', 'ë'=>'e',
            'ì'=>'i', 'í'=>'i', 'î'=>'i', 'ï'=>'i',
            'ñ'=>'n',
            'ò'=>'o', 'ó'=>'o', 'ô'=>'o', 'õ'=>'o', 'ö'=>'o', 'ø'=>'o', 'œ'=>'oe',
            'ù'=>'u', 'ú'=>'u', 'û'=>'u', 'ü'=>'u',
            'ý'=>'y', 'ÿ'=>'y'
        ];
        $str = strtr($str, $unwanted);
        return strtoupper(preg_replace('/[^a-z]/i', '', $str));
    }

    /**
     * Load the comprehensive French 5-letter dictionary
     */
    private static function loadDictionary(): array {
        if (self::$dictionary === null) {
            $path = __DIR__ . '/french_5_letter_words.json';
            if (file_exists($path)) {
                $content = file_get_contents($path);
                self::$dictionary = json_decode($content, true) ?: [];
            } else {
                self::$dictionary = [];
            }
        }
        return self::$dictionary;
    }

    /**
     * Filter list of strictly 5 letters, uppercase A-Z
     */
    private static function sanitizeWordList(array $list): array {
        $clean = [];
        foreach ($list as $w) {
            $w = self::normalizeWord($w);
            if (strlen($w) === 5 && preg_match('/^[A-Z]{5}$/', $w)) {
                $clean[] = $w;
            }
        }
        return array_values(array_unique($clean));
    }

    /**
     * Get the deterministic daily word for a given Y-m-d date
     */
    public static function getDailyWord(?string $date = null): string {
        $targets = self::sanitizeWordList(self::$targets);
        $date = $date ?: date('Y-m-d');
        
        // Salted hash ensures unpredictable order
        $salt = 'le_qg_mystery_word_salt_2026';
        $hash = crc32($date . $salt);
        $index = abs($hash) % count($targets);
        return $targets[$index];
    }

    /**
     * Verify if a guess is in either the target words or full French dictionary
     */
    public static function isValidWord(string $guess): bool {
        $guess = self::normalizeWord($guess);
        if (strlen($guess) !== 5 || !preg_match('/^[A-Z]{5}$/', $guess)) {
            return false;
        }

        $dict = self::loadDictionary();
        if (isset($dict[$guess])) {
            return true;
        }

        // Fallback to targets list
        $targets = self::sanitizeWordList(self::$targets);
        return in_array($guess, $targets, true);
    }

    /**
     * Evaluate a guess against target using the official 2-pass Wordle algorithm
     * Returns:
     * [
     *   ['letter' => 'P', 'status' => 'correct'|'present'|'absent'],
     *   ...
     * ]
     */
    public static function evaluateGuess(string $guess, string $target): array {
        $guess = strtoupper(trim($guess));
        $target = strtoupper(trim($target));

        $guessArr = str_split($guess);
        $targetArr = str_split($target);
        $feedback = array_fill(0, 5, 'absent');

        // Letter counts in the target word
        $targetCounts = [];
        foreach ($targetArr as $char) {
            $targetCounts[$char] = ($targetCounts[$char] ?? 0) + 1;
        }

        // Pass 1: find exact matches (correct / green)
        for ($i = 0; $i < 5; $i++) {
            if ($guessArr[$i] === $targetArr[$i]) {
                $feedback[$i] = 'correct';
                $targetCounts[$guessArr[$i]]--;
            }
        }

        // Pass 2: find partial matches (present / yellow) for remaining letters
        for ($i = 0; $i < 5; $i++) {
            if ($feedback[$i] !== 'correct') {
                $char = $guessArr[$i];
                if (!empty($targetCounts[$char]) && $targetCounts[$char] > 0) {
                    $feedback[$i] = 'present';
                    $targetCounts[$char]--;
                }
            }
        }

        $result = [];
        for ($i = 0; $i < 5; $i++) {
            $result[] = [
                'letter' => $guessArr[$i],
                'status' => $feedback[$i]
            ];
        }

        return $result;
    }
}
