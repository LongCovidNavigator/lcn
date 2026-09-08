<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Ausschließlich fiktive Testdaten. Diese Datei enthält bewusst keine DB-Abfrage.
$scenario = $_GET['scenario'] ?? 'complete';
if (!in_array($scenario, ['complete', 'research', 'voting', 'hybrid'], true)) {
    $scenario = 'complete';
}

$data = [
    'meta' => [
        'is_dummy' => true,
        'scenario' => $scenario,
        'scenario_labels' => [
            'complete' => 'Recherche und Community-Erfahrungen',
            'research' => 'Nur recherchierte Kerndaten',
            'voting' => 'Nur Abstimmungsdaten, ohne redaktionelle Informationen',
            'hybrid' => 'Nur hybride Angaben aus Recherche und Community',
        ],
    ],
    'treatment' => [
        'name' => 'Niedrig dosiertes Naltrexon',
        'short_name' => 'LDN',
        'type' => 'Medikament',
        'subcategory' => 'Immunmodulierende Therapie',
        'description' => 'Niedrig dosiertes Naltrexon wird off-label eingesetzt. Diskutiert werden mögliche modulierende Effekte auf Schmerzverarbeitung und Immunaktivität; die klinische Bedeutung wird noch erforscht.',
        'access' => 'Ärztliche Verordnung / Rezept erforderlich',
        'approved_for_condition' => false,
        'off_label' => true,
        'research_status' => 'Phase II',
        'costs' => [
            'unit' => 'ca. 18–35 € pro Monat',
            'typical_count' => 'zunächst 3 Monate',
            'total' => 'ca. 54–105 €',
            'ongoing' => 'bei Fortführung monatlich',
        ],
        'reimbursement' => 'Nur Selbstzahler',
        'setting' => 'Selbstständig zu Hause',
        'scope' => [
            'duration' => 'wenige Minuten pro Einnahme',
            'frequency' => '1× täglich, abends',
            'count' => 'täglich',
            'total_duration' => 'Testphase meist 8–12 Wochen',
        ],
        'accessibility' => [
            ['label' => 'Im Liegen durchführbar', 'value' => true],
            ['label' => 'Längeres Sitzen erforderlich', 'value' => false],
            ['label' => 'Längeres Stehen erforderlich', 'value' => false],
            ['label' => 'Körperliche Aktivität erforderlich', 'value' => false],
            ['label' => 'Anstrengung durch die Behandlung', 'value' => false],
        ],
        'aliases' => ['LDN', 'Low-dose naltrexone', 'Naltrexon niedrig dosiert'],
        'application' => 'Oral, meist als Kapsel oder Tropfen',
        'medication' => [
            'active_ingredient' => 'Naltrexon',
            'brand' => 'individuelle Rezeptur (Beispiel)',
            'class' => 'Opioidrezeptor-Antagonist',
            'dosage' => 'einschleichend, beispielhaft 0,5–4,5 mg täglich',
        ],
        'classification' => [
            'atc' => 'N07BB04',
            'ichi' => '1.EA.ZZ – Medikamentöse Behandlung (Dummy-Code)',
        ],
        'symptoms' => ['Fatigue', 'Brain Fog', 'Muskelschmerzen', 'Schlafstörungen', 'allgemeine Schmerzsymptomatik'],
        'relationships' => [
            'related_treatments' => [
                'classification' => 'Immunmodulierende medikamentöse Ansätze',
                'items' => [
                    ['name' => 'Low-dose Aripiprazol (LDA)', 'type' => 'Medikament', 'positive_rating' => 61, 'slug' => 'low-dose-aripiprazol'],
                    ['name' => 'Metformin', 'type' => 'Medikament', 'positive_rating' => 54, 'slug' => 'metformin'],
                    ['name' => 'Rapamycin niedrig dosiert', 'type' => 'Medikament', 'positive_rating' => 49, 'slug' => 'rapamycin-niedrig-dosiert'],
                ],
            ],
            'alternative_products' => [
                ['name' => 'Naltrexon als Kapselrezeptur', 'type' => 'Präparatvariante', 'positive_rating' => 71, 'slug' => 'naltrexon-kapselrezeptur'],
                ['name' => 'Naltrexon als Tropfenrezeptur', 'type' => 'Präparatvariante', 'positive_rating' => 66, 'slug' => 'naltrexon-tropfenrezeptur'],
                ['name' => 'Naltrexon als Flüssigzubereitung', 'type' => 'Präparatvariante', 'positive_rating' => 63, 'slug' => 'naltrexon-fluessigzubereitung'],
            ],
            'alternative_treatments' => [
                ['name' => 'Low-dose Aripiprazol (LDA)', 'relation' => 'Sinnvolle Alternative', 'recommendations' => 24, 'positive_rating' => 61, 'slug' => 'low-dose-aripiprazol'],
                ['name' => 'Pyridostigmin', 'relation' => 'Bei Unverträglichkeit', 'recommendations' => 17, 'positive_rating' => 58, 'slug' => 'pyridostigmin'],
                ['name' => 'H1-/H2-Antihistaminika', 'relation' => 'Sinnvolle Ergänzung', 'recommendations' => 11, 'positive_rating' => 64, 'slug' => 'antihistaminika'],
                ['name' => 'Melatonin niedrig dosiert', 'relation' => 'Günstigere Alternative', 'recommendations' => 8, 'positive_rating' => 46, 'slug' => 'melatonin-niedrig-dosiert'],
            ],
        ],
        'reviewed_at' => '26.08.2026',
        'sources' => [
            ['title' => 'ClinicalTrials.gov – exemplarischer Studieneintrag', 'url' => 'https://clinicaltrials.gov/'],
            ['title' => 'PubMed – Literaturübersicht zu Low-dose Naltrexone', 'url' => 'https://pubmed.ncbi.nlm.nih.gov/'],
        ],
        'experience' => [
            'total' => 126,
            'ratings' => ['positive' => 68, 'neutral' => 18, 'negative' => 14],
            'gamechanger' => 32,
            'pem_risk' => 'Niedrig',
            'onset' => [
                ['label' => 'Tage', 'value' => 12],
                ['label' => 'Wochen', 'value' => 51],
                ['label' => 'Monate', 'value' => 23],
                ['label' => 'Keine Wirkung', 'value' => 14],
            ],
        ],
        'providers' => [
            ['kind' => 'Praxis', 'name' => 'Praxis am Stadtpark', 'location' => 'Berlin', 'postal_code' => '10115', 'detail' => 'Privatpraxis · Telemedizin möglich', 'lat' => 52.532, 'lng' => 13.384, 'pro' => 18, 'neutral' => 4, 'contra' => 2, 'care' => ['PKV / Selbstzahler'], 'contact' => ['Website', 'E-Mail']],
            ['kind' => 'Ärztin', 'name' => 'Dr. med. Lea Beispiel', 'location' => 'Hamburg', 'postal_code' => '20095', 'detail' => 'Allgemeinmedizin · Long-COVID-Sprechstunde', 'lat' => 53.551, 'lng' => 9.993, 'pro' => 27, 'neutral' => 5, 'contra' => 3, 'care' => ['GKV', 'PKV / Selbstzahler'], 'contact' => ['Website', 'Telefon']],
            ['kind' => 'Klinik', 'name' => 'Ambulanz Nord', 'location' => 'Hannover', 'postal_code' => '30159', 'detail' => 'Spezialambulanz · Überweisung erforderlich', 'lat' => 52.375, 'lng' => 9.732, 'pro' => 13, 'neutral' => 6, 'contra' => 4, 'care' => ['GKV', 'PKV / Selbstzahler'], 'contact' => ['Website', 'E-Mail', 'Telefon']],
        ],
    ],
    'provenance' => [
        'access' => 'R', 'approved_for_condition' => 'R', 'off_label' => 'R', 'research_status' => 'R',
        'costs' => 'H', 'reimbursement' => 'H', 'setting' => 'H', 'scope' => 'H', 'accessibility' => 'H',
        'experience' => ['ratings' => 'N', 'gamechanger' => 'N', 'pem_risk' => 'N', 'onset' => 'N'],
        'description' => 'R', 'type' => 'R', 'subcategory' => 'R', 'aliases' => 'R',
        'application' => 'H',
        'medication' => ['active_ingredient' => 'R', 'brand' => 'R', 'class' => 'R', 'dosage' => 'H'],
        'classification' => 'R', 'sources' => 'R', 'reviewed_at' => 'R',
        'symptoms' => 'H', 'relationships' => 'H', 'providers' => 'H',
    ],
];

$fixture = $_GET['fixture'] ?? '';
$ketoBase = [
    'name' => 'Ketogene Ernährung', 'short_name' => 'Keto', 'type' => 'Ernährung und Diät', 'subcategory' => null,
    'access' => 'Frei erhältlich; Umsetzung über die tägliche Lebensmittelauswahl', 'approved_for_condition' => false, 'off_label' => false, 'research_status' => null,
    'aliases' => ['Ketogene Diät', 'Ketogenic diet'], 'application' => 'Tägliche Ernährungsweise',
    'medication' => ['active_ingredient' => null, 'brand' => null, 'class' => null, 'dosage' => null], 'classification' => ['atc' => null, 'ichi' => null],
    'accessibility' => [['label'=>'Behandlung körperlich anstrengend','value'=>true],['label'=>'Längeres Sitzen erforderlich','value'=>false],['label'=>'Längeres Liegen erforderlich','value'=>false],['label'=>'Längeres Stehen erforderlich','value'=>false],['label'=>'Körperliche Aktivität erforderlich','value'=>false]],
    'reviewed_at' => '28.08.2026',
];
$fixtureOverrides = [
    'ldn-research' => [
        'meta' => ['fixture_label' => 'LDN · Recherche-Durchstich vom 26.08.2026', 'scenario_labels' => ['complete' => 'Recherche-Durchstich; Nutzerfelder nicht befüllt']],
        'treatment' => [
            'name' => 'Low-Dose Naltrexone', 'short_name' => 'LDN', 'type' => 'Arzneimittel', 'subcategory' => 'Entzündung und Immunmodulation',
            'description' => 'LDN ist die niedrig dosierte, off-label eingesetzte Form des Opioidantagonisten Naltrexon. Bei Long COVID und ME/CFS wird es als symptomorientierter Therapieversuch diskutiert; die Evidenz ist bislang überwiegend beobachtend und von niedriger Sicherheit.',
            'access' => 'Ärztliche Verordnung / Rezept erforderlich', 'approved_for_condition' => false, 'off_label' => true, 'research_status' => 'Phase II',
            'studies' => [
                ['name' => 'RECOVER-AUTONOMIC – Ivabradin bei Long-COVID-POTS', 'phase' => 'Phase II', 'kind' => 'Randomisierte Long-COVID-POTS-Studie', 'url' => 'https://clinicaltrials.gov/study/NCT06305806'],
                ['name' => 'Ivabradine effects on COVID-19-associated postural orthostatic tachycardia syndrome', 'phase' => null, 'kind' => 'Prospektive Studie', 'url' => 'https://pubmed.ncbi.nlm.nih.gov/37469536/'],
                ['name' => 'Randomized Trial of Ivabradine in Patients With Hyperadrenergic Postural Orthostatic Tachycardia Syndrome', 'phase' => null, 'kind' => 'Randomisierte doppelblinde Crossover-Studie', 'url' => 'https://pubmed.ncbi.nlm.nih.gov/33602468/'],
            ],
            'costs' => ['unit' => '50,86 € / 50 ml oder 83,45 € / 100 ml', 'typical_count' => null, 'total' => null, 'ongoing' => 'langfristig / offen'],
            'reimbursement' => 'GKV: nein · PKV: nein', 'setting' => 'Selbstständig zu Hause',
            'scope' => ['duration' => null, 'frequency' => 'täglich', 'count' => null, 'total_duration' => 'offen / langfristig'],
            'accessibility' => [['label' => 'Behandlung körperlich anstrengend', 'value' => false], ['label' => 'Längeres Sitzen erforderlich', 'value' => false], ['label' => 'Längeres Liegen erforderlich', 'value' => false], ['label' => 'Längeres Stehen erforderlich', 'value' => false], ['label' => 'Körperliche Aktivität erforderlich', 'value' => false]],
            'aliases' => ['LDN', 'Low-Dose Naltrexone', 'Low Dose Naltrexon', 'niedrig dosiertes Naltrexon'], 'application' => 'Kapsel oder Tropfen / Lösung',
            'medication' => ['active_ingredient' => 'Naltrexon', 'brand' => 'kein einheitlicher Markenname; häufig individuelle Rezeptur', 'class' => 'Opioidrezeptor-Antagonist', 'dosage' => 'ca. 1–6 mg/Tag; einschleichend, individuell nach Verträglichkeit'],
            'classification' => ['atc' => 'N07BB04', 'ichi' => null],
            'symptoms' => ['Fatigue', 'Post-Exertional Malaise (PEM)', 'Kognitive Dysfunktion', 'Brain Fog', 'Schmerzen', 'Nicht erholsamer Schlaf', 'Reizüberempfindlichkeit'],
            'reviewed_at' => '26.08.2026',
        ],
    ],
    'ivabradin' => [
        'meta' => ['fixture_label' => 'Ivabradin · Recherche v0.12 vom 27.08.2026', 'scenario_labels' => ['complete' => 'Recherche v0.12; Nutzerfelder nicht befüllt']],
        'treatment' => [
            'name' => 'Ivabradin', 'short_name' => 'IVA', 'type' => 'Arzneimittel', 'subcategory' => 'Herz-Kreislauf und Dysautonomie',
            'description' => 'Ivabradin ist ein verschreibungspflichtiger If-Kanal-Hemmer, der die Herzfrequenz senkt. Im Long-COVID-Kontext wird der Wirkstoff off-label insbesondere bei POTS und belastender Tachykardie untersucht.',
            'access' => 'Ärztliche Verordnung / Rezept erforderlich', 'approved_for_condition' => false, 'off_label' => true, 'research_status' => 'Phase II',
            'studies' => [
                ['name' => 'RECOVER-AUTONOMIC', 'kind' => 'Randomisierte Studie zu Long-COVID-POTS', 'phase' => 'Phase II', 'url' => 'https://clinicaltrials.gov/study/NCT06305806'],
                ['name' => 'Ivabradin bei COVID-19-assoziiertem POTS', 'kind' => 'Klinische Studie', 'phase' => null, 'url' => 'https://pubmed.ncbi.nlm.nih.gov/37469536/'],
                ['name' => 'Ivabradin bei hyperadrenergem POTS', 'kind' => 'Randomisierte klinische Studie', 'phase' => null, 'url' => 'https://pubmed.ncbi.nlm.nih.gov/33602468/'],
            ],
            'costs' => ['unit' => 'ca. 30,23–62,93 € / 56 Filmtabletten à 5 mg', 'typical_count' => 'Wirksamkeitsbeurteilung nach 3 Monaten', 'total' => null, 'ongoing' => 'ca. 30,23–62,93 € je 28 Tage bei 5 mg 2× täglich'],
            'reimbursement' => 'GKV und PKV: unter Voraussetzungen / Einzelfallprüfung',
            'reimbursement_details' => [
                'gkv' => ['status' => 'ja', 'certainty' => 'belegt eindeutig', 'note' => 'Für Erwachsene mit COVID-19-assoziiertem POTS, wenn Betablocker nicht toleriert werden oder nicht geeignet sind. Die Voraussetzungen der jeweils aktuellen Arzneimittel-Richtlinie, Anlage VI Teil A, sind zu beachten.', 'url' => 'https://www.g-ba.de/beschluesse/7765/'],
                'pkv' => ['status' => 'ja', 'certainty' => 'offen oder eingeschränkt belegt', 'note' => 'Eine Off-Label-Erstattung sollte vorab tarif- und einzelfallbezogen geprüft werden. Aus der G-BA-Regelung lässt sich kein allgemeiner Anspruch für alle PKV-Tarife ableiten.', 'url' => 'https://www.pkv.de/wissen/versorgung/arzneimittel/'],
            ],
            'setting' => 'Selbstständig zu Hause',
            'scope' => ['duration' => null, 'frequency' => 'initial 1× täglich; Standard 2× täglich', 'count' => null, 'total_duration' => 'mindestens bis zur Wirksamkeitsbeurteilung nach 3 Monaten'],
            'accessibility' => [['label' => 'Behandlung körperlich anstrengend', 'value' => false], ['label' => 'Längeres Sitzen erforderlich', 'value' => false], ['label' => 'Längeres Liegen erforderlich', 'value' => false], ['label' => 'Längeres Stehen erforderlich', 'value' => false], ['label' => 'Körperliche Aktivität erforderlich', 'value' => false]],
            'aliases' => ['Ivabradine', 'Procoralan', 'Corlentor'], 'application' => 'Tablette',
            'medication' => ['active_ingredient' => 'Ivabradin', 'brand' => 'Procoralan; Corlentor', 'class' => 'Selektiver If-Kanal-Hemmer', 'dosage' => 'Start 2,5 mg morgens; schrittweise bis 5 mg 2× täglich; individuell nach Verträglichkeit'],
            'classification' => ['atc' => 'C01EB17 – Ivabradine', 'ichi' => null],
            'symptoms' => ['Herzrasen (Tachykardie)', 'Herzstolpern (Palpitationen)', 'Belastungsintoleranz', 'Brustschmerzen', 'Beinahe-Ohnmacht (Präsynkope)'],
            'reviewed_at' => '27.08.2026',
            'sources' => [['title' => 'G-BA-Beschluss', 'url' => 'https://www.g-ba.de/beschluesse/7765/'], ['title' => 'RECOVER-AUTONOMIC / ClinicalTrials.gov', 'url' => 'https://clinicaltrials.gov/study/NCT06305806'], ['title' => 'Ivabradine bei COVID-19-assoziiertem POTS', 'url' => 'https://pubmed.ncbi.nlm.nih.gov/37469536/']],
            'providers' => [
                ['kind' => 'Arzt', 'name' => 'Dr. Kai Störring', 'location' => null, 'postal_code' => null, 'detail' => 'Angebot eindeutig belegt · LCN-ID 608', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['LCN-Bestand', 'Belegt eindeutig'], 'contact' => ['Eigene Praxis-Seite']],
                ['kind' => 'Arzt', 'name' => 'Dr. Michael Stingl', 'location' => null, 'postal_code' => null, 'detail' => 'Angebot eindeutig belegt · LCN-ID 627', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['LCN-Bestand', 'Belegt eindeutig'], 'contact' => ['Eigenes Fachpapier']],
                ['kind' => 'Arzt', 'name' => 'Dr. Claus-Hermann Bückendorf', 'location' => null, 'postal_code' => null, 'detail' => 'Angebot eindeutig belegt · LCN-ID 549', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['LCN-Bestand', 'Belegt eindeutig'], 'contact' => ['Praxis-PDF']],
                ['kind' => 'Praxis', 'name' => 'Zillgens / Praganzmed-Praxis', 'location' => null, 'postal_code' => null, 'detail' => 'Angebot eindeutig belegt · LCN-ID 1132', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['LCN-Bestand', 'Belegt eindeutig'], 'contact' => ['Eigene Praxis-Seite']],
                ['kind' => 'Arzt', 'name' => 'Dr. Amir S. Naderi', 'location' => null, 'postal_code' => null, 'detail' => 'Angebot eindeutig belegt · LCN-ID 588', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['LCN-Bestand', 'Belegt eindeutig'], 'contact' => ['Eigene Aussage + Praxis-Seite']],
                ['kind' => 'Ärztin', 'name' => 'Dr. Maja Strasser', 'location' => null, 'postal_code' => null, 'detail' => 'Angebot eindeutig belegt · LCN-ID 581', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['LCN-Bestand', 'Belegt eindeutig'], 'contact' => ['Praxis-Therapieschema']],
                ['kind' => 'Ärztin', 'name' => 'Dr. Beate Jaeger', 'location' => null, 'postal_code' => null, 'detail' => 'Angebot eindeutig belegt · LCN-ID 542', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['LCN-Bestand', 'Belegt eindeutig'], 'contact' => ['Eigene Website + Patientenberichte']],
                ['kind' => 'Arzt', 'name' => 'Dr. Michael Kacik', 'location' => null, 'postal_code' => null, 'detail' => 'Angebot eingeschränkt belegt · LCN-ID 613', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['LCN-Bestand', 'Eingeschränkt belegt'], 'contact' => ['Fachinterview']],
                ['kind' => 'Praxis', 'name' => 'Long Covid Online Klinik / Dr. Corinna Geiger', 'location' => null, 'postal_code' => null, 'detail' => 'Angebot eingeschränkt belegt · neuer LCN-Kandidat', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['Neuer Kandidat', 'Eingeschränkt belegt'], 'contact' => ['Communitybericht + offizielle Klinikseite']],
                ['kind' => 'Klinik', 'name' => 'POTS-Sprechstunde / Herzzentrum der Charité Berlin', 'location' => 'Berlin', 'postal_code' => null, 'detail' => 'Angebot eingeschränkt belegt · neuer LCN-Kandidat', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['Neuer Kandidat', 'Eingeschränkt belegt'], 'contact' => ['Mehrere Communityberichte']],
                ['kind' => 'Klinik', 'name' => 'Neurovegetative Sprechstunde LKH Innsbruck', 'location' => 'Innsbruck', 'postal_code' => null, 'detail' => 'Angebot eingeschränkt belegt · neuer LCN-Kandidat', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['Neuer Kandidat', 'Eingeschränkt belegt'], 'contact' => ['Communitybericht + offizielle Klinikseite']],
            ],
            'relationships' => [
                'current_name' => 'Ivabradin',
                'current_rating' => null,
                'related_treatments' => [
                    'classification' => 'POTS-Therapielandschaft',
                    'items' => [
                        ['name' => 'Midodrin', 'type' => 'Verwandte Behandlung', 'positive_rating' => null, 'slug' => 'midodrin'],
                        ['name' => 'Mestinon', 'type' => 'Verwandte Behandlung', 'positive_rating' => null, 'slug' => 'mestinon'],
                        ['name' => 'Fludrocortison', 'type' => 'Verwandte Behandlung', 'positive_rating' => null, 'slug' => 'fludrocortison'],
                        ['name' => 'Droxidopa', 'type' => 'Verwandte Behandlung', 'positive_rating' => null, 'slug' => 'droxidopa'],
                        ['name' => 'Clonidin', 'type' => 'Verwandte Behandlung', 'positive_rating' => null, 'slug' => 'clonidin'],
                    ],
                ],
                'alternative_products' => [
                    ['name' => 'Propranolol', 'type' => 'Alternatives Präparat', 'positive_rating' => null, 'slug' => 'propranolol'],
                    ['name' => 'Metoprolol', 'type' => 'Alternatives Präparat', 'positive_rating' => null, 'slug' => 'metoprolol'],
                ],
                'alternative_treatments' => [
                    ['name' => 'Kompressionsstrümpfe', 'relation' => 'Alternative Behandlung', 'recommendations' => null, 'positive_rating' => null, 'slug' => 'kompressionsstruempfe'],
                    ['name' => 'Erhöhte Salzaufnahme', 'relation' => 'Alternative Behandlung', 'recommendations' => null, 'positive_rating' => null, 'slug' => 'erhoehte-salzaufnahme'],
                    ['name' => 'Erhöhte Flüssigkeitszufuhr', 'relation' => 'Alternative Behandlung', 'recommendations' => null, 'positive_rating' => null, 'slug' => 'erhoehte-fluessigkeitszufuhr'],
                    ['name' => 'Bauchbinde', 'relation' => 'Alternative Behandlung', 'recommendations' => null, 'positive_rating' => null, 'slug' => 'bauchbinde'],
                ],
            ],
        ],
    ],
    'hbot' => [
        'meta' => ['fixture_label' => 'Hyperbare Sauerstofftherapie (HBO) · Recherche v0.12 vom 28.08.2026', 'scenario_labels' => ['complete' => 'Recherche v0.12; alle Module und Reiter berücksichtigt']],
        'treatment' => [
            'name' => 'Hyperbare Sauerstofftherapie (HBO)', 'short_name' => 'HBO / HBOT', 'type' => 'Medizinische Prozeduren', 'subcategory' => null,
            'description' => 'Klinische hyperbare Sauerstofftherapie ist eine ärztlich überwachte Behandlung in einer medizinischen Druckkammer mit nahezu 100 % medizinischem Sauerstoff unter Überdruck. Bei Long COVID und ME/CFS erfolgt sie off-label und meist als Selbstzahlerleistung. Die Evidenz ist widersprüchlich: Positive Ergebnisse längerer Protokolle stehen neueren placebokontrollierten 10-Sitzungsstudien ohne signifikanten Vorteil gegenüber.',
            'access' => 'Frei erhältlich / privater Anbieter; Durchführung in medizinischer Druckkammer', 'approved_for_condition' => false, 'off_label' => true, 'research_status' => 'Phase II',
            'studies' => [
                ['name' => 'Hyperbaric oxygen therapy improves neurocognitive functions and symptoms of post-COVID condition', 'kind' => 'Randomisierte kontrollierte Studie; 40-Sitzungs-Protokoll', 'phase' => null, 'url' => 'https://clinicaltrials.gov/study/NCT04647656'],
                ['name' => 'Ten sessions of hyperbaric oxygen versus sham treatment in patients with long covid (HOT-LoCO)', 'kind' => 'Randomisierte placebokontrollierte Studie; 10 Sitzungen', 'phase' => 'Phase II', 'url' => 'https://clinicaltrials.gov/study/NCT04842448'],
                ['name' => 'Effect of normobaric and hyperbaric hyperoxia treatment on symptoms and cognitive capacities in Long COVID patients', 'kind' => 'Placebokontrollierte Vierarmstudie', 'phase' => null, 'url' => 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12267068/'],
                ['name' => 'HBOT improves clinical symptoms and functional capacity and modulates thalamic connectivity in ME/CFS', 'kind' => 'Prospektive ME/CFS-Kohorte; 40 Sitzungen', 'phase' => null, 'url' => 'https://clinicaltrials.gov/study/NCT06118138'],
            ],
            'costs' => ['unit' => '325–375 € pro Sitzung', 'typical_count' => '10–40 Sitzungen', 'total' => 'ca. 4.900–15.000 € bei 15–40 Sitzungen', 'ongoing' => null],
            'reimbursement' => 'GKV: nein · PKV: keine allgemeine Übernahme belegt',
            'reimbursement_details' => [
                'gkv' => ['status' => 'nein', 'certainty' => 'belegt eindeutig', 'note' => 'Für Long COVID meist Selbstzahler. Einzelfallentscheidungen sind möglich, aber es besteht kein regulärer Leistungsanspruch; die ambulante GKV-HBOT ist nur für gesondert definierte Indikationen geregelt.', 'url' => 'https://www.g-ba.de/presse/pressemitteilungen-meldungen/704/'],
                'pkv' => ['status' => 'nein', 'certainty' => 'offen oder eingeschränkt belegt', 'note' => 'Tarif- und Einzelfallprüfung erforderlich. Vor Beginn sind Kostenvoranschlag und schriftliche Zusage sinnvoll; eine allgemeine Long-COVID-Erstattungszusage ist nicht ableitbar.', 'url' => 'https://igel-monitor.de/igel-a-z/igel/show/hyperbare-sauerstofftherapie-zur-behandlung-von-long-post-covid.html'],
            ],
            'setting' => 'Ambulant; stationäre Durchführung ist ebenfalls möglich',
            'scope' => ['duration' => '90–120 Minuten Sauerstoffatmung; Termin insgesamt etwa 2,5–3 Stunden', 'frequency' => 'häufig 5× pro Woche/werktäglich; bei ausgeprägter PEM gegebenenfalls geringer', 'count' => '10–40 Sitzungen', 'total_duration' => 'ca. 2–8 Wochen, protokollabhängig'],
            'accessibility' => [['label' => 'Behandlung körperlich anstrengend', 'value' => true], ['label' => 'Längeres Sitzen erforderlich', 'value' => true], ['label' => 'Längeres Liegen erforderlich', 'value' => false], ['label' => 'Längeres Stehen erforderlich', 'value' => false], ['label' => 'Körperliche Aktivität erforderlich', 'value' => false]],
            'aliases' => ['HBO', 'HBOT', 'Hyperbare Sauerstofftherapie'], 'application' => 'Atmung von nahezu 100 % medizinischem Sauerstoff unter Überdruck in einer Druckkammer',
            'medication' => ['active_ingredient' => 'Medizinischer Sauerstoff', 'brand' => null, 'class' => null, 'dosage' => 'typischerweise etwa 2–3 ATA; protokollabhängig'],
            'classification' => ['atc' => 'V03AN01 – oxygen', 'ichi' => null],
            'symptoms' => ['Fatigue', 'Brain Fog', 'Konzentrationsstörungen', 'Belastungsintoleranz', 'Muskelschmerzen (Myalgien)', 'Schlafstörungen', 'Atemnot (Dyspnoe)'],
            'reviewed_at' => '28.08.2026',
            'sources' => [['title' => 'IGeL-Monitor – HBOT bei Long/Post-COVID', 'url' => 'https://igel-monitor.de/igel-a-z/igel/show/hyperbare-sauerstofftherapie-zur-behandlung-von-long-post-covid.html'], ['title' => 'HOT-LoCO', 'url' => 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11997836/'], ['title' => 'Charité/Vivantes HBOT-Studie', 'url' => 'https://cfc.charite.de/klinische_studien/nksg/studie_hbot'], ['title' => 'VDD-Druckkammerübersicht', 'url' => 'https://www.vdd-hbo.de/druckkammern/']],
            'providers' => array_map(static fn(array $p): array => ['kind' => $p[0], 'name' => $p[1], 'location' => $p[2] ?? null, 'postal_code' => null, 'detail' => $p[3], 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['Neuer Kandidat', 'Angebot belegt'], 'contact' => [$p[4]]], [
                ['Zentrum','Zentrum für Hyperbarmedizin Hamburg ZHH GmbH','Hamburg','Explizites Long-COVID/ME-CFS-HBOT-Angebot','https://www.hbo-hamburg.de/'],
                ['Zentrum','HBO-Druckkammerzentrum Soltau','Soltau','Medizinische HBOT; Long-COVID-Angebot nicht separat belegt','https://www.vdd-hbo.de/druckkammern/'],
                ['Klinik','Vivantes Klinikum am Friedrichshain – Zentrum für hyperbare Sauerstofftherapie und Tauchmedizin','Berlin','Ambulante HBOT-Studie bei Post-COVID/ME/CFS; allgemeines Zentrum aktuell','https://cfc.charite.de/klinische_studien/nksg/studie_hbot'],
                ['Klinik','Universitätsklinikum Halle (Saale) – HBO','Halle (Saale)','Aktuelles medizinisches HBOT-Zentrum','https://www.vdd-hbo.de/druckkammern/'],
                ['Klinik','Zentrum für Tauch- und Hyperbarmedizin Ostbayern – Caritas-Krankenhaus St. Josef','Regensburg','Explizite Long-COVID-Off-Label-HBOT','https://csj.de/medizin-und-pflege/zentren/spezialzentren/zentrum-fuer-tauch-und-hyperbarmedizin-ostbayern/behandlung'],
                ['Zentrum','Hyperbares Sauerstoff-Zentrum München','München','Aktuelles medizinisches HBOT-Zentrum','https://www.vdd-hbo.de/druckkammern/'],
                ['Zentrum','Druckkammerzentrum Traunstein','Traunstein','Aktuelles medizinisches HBOT-Zentrum','https://www.vdd-hbo.de/druckkammern/'],
                ['Klinik','Druckkammer-Centrum Stuttgart im Klinikum Ludwigsburg','Ludwigsburg','Aktuelles medizinisches HBOT-Zentrum','https://www.vdd-hbo.de/druckkammern/'],
                ['Zentrum','HBO2-Zentrum für Hyperbarmedizin GmbH Freiburg','Freiburg','Explizites Post-/Long-COVID- und ME/CFS-Angebot','https://www.hbo2.de/fuer-patienten/post-covid-behandlung-hbo/'],
                ['Zentrum','Druckkammerzentren Rhein Main Taunus GmbH','Wiesbaden','Aktuelles medizinisches HBOT-Zentrum','https://www.vdd-hbo.de/druckkammern/'],
                ['Zentrum','HBO-Zentrum Euregio Aachen GmbH & Co KG','Aachen','Aktuelles medizinisches HBOT-Zentrum','https://www.vdd-hbo.de/druckkammern/'],
                ['Klinik','HBO-Zentrum Bergmannsheil Buer','Gelsenkirchen','Explizite klinische Long-COVID-HBOT','https://www.kgnw.de/presse/neues-aus-den-nrw-kliniken/220517-sauerstofftherapie-bergmannsheil'],
                ['Praxis','Praxis für Hyperbarmedizin – Dr. med. Gordon Rossbach','Münster','Explizite Long-COVID-HBOT in ärztlicher Praxis','https://hbo-muenster.de/long-covid'],
            ]),
            'relationships' => ['current_name' => 'Hyperbare Sauerstofftherapie (HBO)', 'current_rating' => null, 'related_treatments' => ['classification' => 'HBOT-Protokolle und verwandte Druckkammerverfahren', 'items' => [
                ['name' => 'Hyperbare Sauerstofftherapie 10-Sitzungs-Protokoll', 'type' => 'Verwandte Behandlung · LCN-ID 97', 'positive_rating' => null, 'slug' => 'hbot-10-sitzungen'],
                ['name' => 'Milde hyperbare Sauerstofftherapie (mHBOT)', 'type' => 'Verwandte Behandlung · neuer Kandidat; nicht synonym', 'positive_rating' => null, 'slug' => 'mhbot'],
            ]], 'alternative_products' => [], 'alternative_treatments' => []],
        ],
    ],
    'mhbot' => [
        'meta' => ['fixture_label' => 'Milde hyperbare Sauerstofftherapie (mHBOT) · Recherche v0.12 vom 28.08.2026', 'scenario_labels' => ['complete' => 'Recherche v0.12; alle Module und Reiter berücksichtigt']],
        'treatment' => [
            'name' => 'Milde hyperbare Sauerstofftherapie (mHBOT)', 'short_name' => 'mHBOT / mHBO', 'type' => 'Gerätegestützte Verfahren', 'subcategory' => null,
            'description' => 'mHBOT nutzt gering erhöhte Umgebungsdrücke, meist unter 1,5 ATA, häufig in weichen oder niedrigdruckigen Kammern mit Raumluft oder zusätzlich konzentriertem Sauerstoff. Sie ist fachlich von klinischer HBOT mit höherem Druck und nahezu 100 % medizinischem Sauerstoff zu trennen. Ergebnisse klinischer HBOT-Studien dürfen daher nicht auf mHBOT übertragen werden.',
            'access' => 'Frei erhältlich bei privaten Anbietern; üblicherweise Selbstzahlerleistung', 'approved_for_condition' => false, 'off_label' => false, 'research_status' => null,
            'studies' => [],
            'costs' => ['unit' => 'ca. 90–149 € pro Sitzung', 'typical_count' => 'typisch etwa 10–40 Anwendungen', 'total' => 'ca. 900–2.650 € für 10–30 Sitzungen; umfangreichere Serien können höher liegen', 'ongoing' => null],
            'reimbursement' => 'GKV: nein · PKV: keine allgemeine Übernahme belegt',
            'reimbursement_details' => [
                'gkv' => ['status' => 'nein', 'certainty' => 'belegt eindeutig', 'note' => 'Für Long COVID und ME/CFS typischerweise Selbstzahlerleistung. Einzelfallanfragen bleiben möglich, es besteht jedoch kein regulärer Leistungsanspruch.', 'url' => 'https://www.barbara-handlos.de/hyperbare-sauerstofftherapie/'],
                'pkv' => ['status' => 'nein', 'certainty' => 'offen oder eingeschränkt belegt', 'note' => 'Tarif- und einzelfallabhängig; vor Behandlungsbeginn sollte eine schriftliche Kostenzusage eingeholt werden. Eine allgemeine PKV-Übernahme ist nicht ableitbar.', 'url' => 'https://www.barbara-handlos.de/hyperbare-sauerstofftherapie/'],
            ],
            'setting' => 'Ambulant bei privaten Zentren und Praxen',
            'scope' => ['duration' => '60–90 Minuten pro Anwendung', 'frequency' => 'individuell bis täglich; häufig als Serie', 'count' => 'typisch etwa 10–40 Anwendungen; einzelne Anbieter empfehlen 14', 'total_duration' => 'ca. 2–8 Wochen bei dichter Serienanwendung; individuell länger'],
            'accessibility' => [['label' => 'Behandlung körperlich anstrengend', 'value' => false], ['label' => 'Längeres Sitzen erforderlich', 'value' => true], ['label' => 'Längeres Liegen erforderlich', 'value' => true], ['label' => 'Längeres Stehen erforderlich', 'value' => false], ['label' => 'Körperliche Aktivität erforderlich', 'value' => false]],
            'aliases' => ['mHBOT', 'mHBO', 'milde hyperbare Sauerstofftherapie', 'mild hyperbaric oxygen therapy'], 'application' => 'Passive Anwendung in einer weichen oder niedrigdruckigen Druckkammer',
            'medication' => ['active_ingredient' => null, 'brand' => null, 'class' => null, 'dosage' => null], 'classification' => ['atc' => null, 'ichi' => null],
            'symptoms' => ['Fatigue', 'Brain Fog', 'Konzentrationsstörungen', 'PEM (Post-Exertional Malaise)', 'Belastungsintoleranz', 'Schlafstörungen'],
            'reviewed_at' => '28.08.2026',
            'sources' => [['title' => 'UHMS – fachliche Abgrenzung', 'url' => 'https://www.uhms.org/images/Position-Statements/UHMS_Cred_and_Priv_Guide_2022_final_Jul_2023_V4.pdf'], ['title' => 'Systematischer Review zu mild hyperbaric oxygen', 'url' => 'https://pmc.ncbi.nlm.nih.gov/articles/PMC13414326/']],
            'providers' => array_map(static fn(array $p): array => ['kind'=>$p[0], 'name'=>$p[1], 'location'=>$p[2], 'postal_code'=>null, 'detail'=>$p[3], 'lat'=>null, 'lng'=>null, 'pro'=>null, 'neutral'=>null, 'contra'=>null, 'care'=>['Neuer Kandidat','Angebot eindeutig belegt'], 'contact'=>[$p[4]]], [
                ['Zentrum','Coolzoone Köln','Köln','Ausdrücklich als milde hyperbare Sauerstofftherapie angeboten','https://coolzoone-shop.de/pages/hyperbare-sauerstofftherapie-koeln'],
                ['Zentrum','Eis.Zoone Stuttgart','Stuttgart','mHBO seit 2024; 90-Minuten-Anwendungen','https://eiszoone-shop.de/pages/hyperbare-sauerstofftherapie-stuttgart'],
                ['Zentrum','Oxythea / IceSpa Düsseldorf','Düsseldorf','mHBOT; 90 Minuten; Privatangebot','https://oxythea.de/pages/hbot-hyperbare-sauerstofftherapie'],
                ['Zentrum','doctorfrost Frankfurt / Bad Homburg','Frankfurt / Bad Homburg','mHBO in privaten Longevity-Centern','https://www.doctorfrost.de/leistung/hbo-hyperbare-sauerstofftherapie'],
                ['Praxis','Privatpraxis Dr. Mayerhoff Hamburg','Hamburg','mHBOT mit 1,3–1,5 bar; ambulant 60–90 Minuten','https://www.dr-mayerhoff.hamburg/therapien/hbot/'],
                ['Praxis','Gesundzimmer München','München','Praxisgemeinschaft mit mHBOT-Angebot','https://www.gesundzimmer.de/de/Leistungen'],
                ['Zentrum','Sauerstoffzentrum Nordost','Groß Potrems','Ambulante mHBO mit 1,3 ATA; Post-COVID-Angebot','https://www.sauerstoffzentrum-nordost.de/'],
                ['Zentrum','Oxinity Berlin','Berlin','Spezialisiertes Studio für mHBOT','https://oxinity-health.com/'],
                ['Zentrum','Barbara Handlos / mHBOT Neu-Isenburg','Neu-Isenburg','1,3 ATA; 45-/90-Minuten-Sitzungen und Paketpreise','https://www.barbara-handlos.de/hyperbare-sauerstofftherapie/'],
                ['Zentrum','Mimbi Aesthetik München','München','mHBOT-Sauerstoffdruckkammer als Longevity-Angebot','https://mimbi-aesthetik.de/longevity/'],
            ]),
            'relationships' => ['current_name'=>'Milde hyperbare Sauerstofftherapie (mHBOT)', 'current_rating'=>null, 'related_treatments'=>['classification'=>'Sauerstoff- und druckbasierte Verfahren', 'items'=>[
                ['name'=>'Hyperbare Sauerstofftherapie (HBO)','type'=>'Verwandte Behandlung · LCN-ID 14; ausdrücklich nicht austauschbar','positive_rating'=>null,'slug'=>'hyperbare-sauerstofftherapie-hbo'],
                ['name'=>'Hyperbare Sauerstofftherapie 10-Sitzungs-Protokoll','type'=>'Verwandte Behandlung · LCN-ID 97; klinisches HBOT-Protokoll','positive_rating'=>null,'slug'=>'hbot-10-sitzungen'],
                ['name'=>'Intervall-Hypoxie-Hyperoxie Therapie (IHHT)','type'=>'Verwandtes gerätegestütztes Verfahren · LCN-ID 277','positive_rating'=>null,'slug'=>'ihht'],
            ]], 'alternative_products'=>[], 'alternative_treatments'=>[]],
        ],
    ],
    'keto-advisor-general' => [
        'meta' => ['fixture_label'=>'Ketogene Ernährung mit Berater · allgemeiner Kontext · Recherche v0.12 vom 28.08.2026','scenario_labels'=>['complete'=>'Allgemeine Beratung; nicht Long-COVID-spezifisch']],
        'treatment' => array_replace_recursive($ketoBase, [
            'name'=>'Ketogene Ernährung mit Berater (allgemein)',
            'description'=>'Professionell begleitete ketogene Ernährung ist eine sehr kohlenhydratarme, fettreiche Ernährungsform. Allgemein wird sie unter anderem zur Gewichtsreduktion und bei metabolischen Erkrankungen eingesetzt; bei bestimmten neurologischen Indikationen ist sie als medizinische Ernährungstherapie etabliert. Die Evidenz und langfristige Eignung hängen von der jeweiligen Indikation ab.',
            'access'=>'Frei erhältlich über private Ernährungsberatung oder Coaching; bei medizinischen Indikationen ist ärztliche Einbindung sinnvoll',
            'studies'=>[
                ['name'=>'Keto-Med randomized crossover trial','kind'=>'Randomisierte Crossover-Studie bei Prädiabetes oder Typ-2-Diabetes','phase'=>null,'url'=>'https://pubmed.ncbi.nlm.nih.gov/35641199/'],
                ['name'=>'Metabolic and Orexin-A Responses to Ketogenic Diet and Intermittent Fasting','kind'=>'Randomisierte 12-Monats-Studie bei Erwachsenen mit Adipositas','phase'=>null,'url'=>'https://pubmed.ncbi.nlm.nih.gov/41599851/'],
            ],
            'costs'=>['unit'=>'79–120 € pro ca. 60-minütiger Einzelberatung','typical_count'=>'ein Termin oder wiederholte Termine','total'=>'79–120 € für Einzelberatung; 390–1.290 € für mehrwöchige Coaching-Pakete','ongoing'=>'zusätzlich individuelle Lebensmittelkosten'],
            'reimbursement'=>'GKV und PKV: mögliche anteilige Erstattung unter Voraussetzungen',
            'reimbursement_details'=>[
                'gkv'=>['status'=>'ja','certainty'=>'offen oder eingeschränkt belegt','note'=>'Eine anteilige Bezuschussung kann bei anerkannten Ernährungsfachkräften und je nach Anlass und Krankenkasse möglich sein. Für Ernährungstherapie nach § 43 SGB V sind typischerweise eine ärztliche Notwendigkeitsbescheinigung und vorherige Abstimmung erforderlich. Keto selbst ist keine allgemeine Regelleistung.','url'=>'https://www.dge.de/ernaehrungsberatung/'],
                'pkv'=>['status'=>'ja','certainty'=>'offen oder eingeschränkt belegt','note'=>'Tarif- und einzelfallabhängig; die Erstattung qualifizierter Ernährungsberatung oder Ernährungstherapie sollte vor Beginn geklärt werden. Eine Keto-spezifische allgemeine Regel wurde nicht gefunden.','url'=>null],
            ],
            'setting'=>'Selbstständige Umsetzung zu Hause; Beratung ambulant oder online',
            'scope'=>['duration'=>'ca. 60 Minuten pro Einzelberatung','frequency'=>'einmalig oder wiederholt über Wochen/Monate','count'=>'ein oder mehrere Termine; programmspezifisch','total_duration'=>'individuell; häufig mehrere Wochen bis Monate'],
            'symptoms'=>['Brain Fog','Fatigue'],
            'sources'=>[['title'=>'DGE – Ernährungsberatung','url'=>'https://www.dge.de/ernaehrungsberatung/'],['title'=>'Keto-Med','url'=>'https://pubmed.ncbi.nlm.nih.gov/35641199/']],
            'providers'=>array_map(static fn(array $p):array=>['kind'=>$p[0],'name'=>$p[1],'location'=>$p[2],'postal_code'=>null,'detail'=>$p[3],'lat'=>null,'lng'=>null,'pro'=>null,'neutral'=>null,'contra'=>null,'care'=>['Neuer Kandidat','Angebot belegt'],'contact'=>[$p[4]]],[
                ['Beratung','Projekt KETO / VitalBalance','Online','Spezialisierte Keto-Ernährungsberatung ohne belegte Long-COVID-Spezialisierung','https://projektketo.de/keto-ernaehrungsberatung/'],
                ['Beratung','Praxis für Ernährung und Sport – Sonja Kurras',null,'Individuelle Beratung zur sicheren ketogenen Ernährung','https://sonjakreuzer.de/ernaehrungsberatung-ketogene-ernaehrung/'],
                ['Praxis','Praxis für Ernährungsberatung und Therapie Reutlingen – Daniela Homoth & Team','Reutlingen','Ambulante und Online-Beratung zur ketogenen Ernährungstherapie','https://www.ernaehrungsberatung-reutlingen.de/themen/ketogene-et/'],
                ['Praxis','Hausarztpraxis Dominik Pütz',null,'Pflanzenbasierte ketogene Ernährungsberatung','https://www.hausarzt-puetz.de/ernaehrungsmedizin/'],
            ]),
            'relationships'=>['current_name'=>'Ketogene Ernährung mit Berater (allgemein)','current_rating'=>null,'related_treatments'=>['classification'=>'Verwandte und alternative Ernährungsansätze','items'=>[
                ['name'=>'Low-Carb-Ernährung','type'=>'Verwandte Behandlung · LCN-ID 467','positive_rating'=>null,'slug'=>'low-carb-ernaehrung'],
                ['name'=>'Intervallfasten','type'=>'Alternative Behandlung · LCN-ID 462','positive_rating'=>null,'slug'=>'intervallfasten'],
                ['name'=>'Mediterrane Ernährung','type'=>'Alternative Behandlung · neuer Kandidat','positive_rating'=>null,'slug'=>'mediterrane-ernaehrung'],
            ]],'alternative_products'=>[],'alternative_treatments'=>[]],
        ]),
    ],
    'keto-advisor-lc' => [
        'meta'=>['fixture_label'=>'Ketogene Ernährung mit Berater · Long-COVID-Kontext · Recherche v0.12 vom 28.08.2026','scenario_labels'=>['complete'=>'Professionell begleitet; Long-COVID-/ME/CFS-Kontext']],
        'treatment'=>array_replace_recursive($ketoBase,[
            'name'=>'Ketogene Ernährung mit Berater (Long-COVID-Kontext)',
            'description'=>'Professionell begleitete ketogene Ernährung ist eine stark kohlenhydratreduzierte, fettreiche Intervention. Im Long-COVID-/ME/CFS-Kontext wird sie experimentell untersucht. Betreute Programme enthalten teils weitere Lifestyle-Komponenten, sodass beobachtete Effekte nicht der Keto-Ernährung allein zugeschrieben werden können.',
            'studies'=>[
                ['name'=>'KETPAIS – Ketogene Ernährungstherapie bei postakuten Infektionssyndromen im Kindes- und Jugendalter','kind'=>'Laufende deutsche Studie; modifizierte Atkins-Diät über drei Monate','phase'=>null,'url'=>'https://drks.de/search/de/trial/DRKS00038849'],
                ['name'=>'Designing Nutrition Studies for Long COVID and Related Infection-Associated Chronic Illness','kind'=>'Mixed-Methods-Auswertung eines betreuten 12-Wochen-KMT-Programms; keine kontrollierte Wirksamkeitsstudie','phase'=>null,'url'=>'https://pmc.ncbi.nlm.nih.gov/articles/PMC13080129/'],
            ],
            'costs'=>['unit'=>null,'typical_count'=>'36 betreute Online-Sitzungen im untersuchten 12-Wochen-Programm','total'=>null,'ongoing'=>'Lebensmittelkosten zusätzlich'],
            'reimbursement'=>'GKV und PKV: mögliche anteilige Erstattung qualifizierter Beratung unter Voraussetzungen',
            'reimbursement_details'=>[
                'gkv'=>['status'=>'ja','certainty'=>'offen oder eingeschränkt belegt','note'=>'Eine anteilige Bezuschussung qualifizierter Ernährungstherapie kann nach ärztlicher Notwendigkeitsbescheinigung möglich sein. Behandlung und Fachkraft müssen die jeweilige Kassenregel erfüllen; Lebensmittelkosten werden nicht übernommen.','url'=>'https://www.dge.de/ernaehrungsberatung/'],
                'pkv'=>['status'=>'ja','certainty'=>'offen oder eingeschränkt belegt','note'=>'Tarif- und einzelfallabhängig; die Kostenübernahme für ernährungsmedizinische oder ernährungstherapeutische Beratung sollte vorab geklärt werden.','url'=>null],
            ],
            'setting'=>'Selbstständige Umsetzung zu Hause; Begleitung ambulant, telefonisch oder online',
            'scope'=>['duration'=>'ca. 60 Minuten pro Beratungssitzung','frequency'=>'im untersuchten Programm 3 Online-Sitzungen pro Woche','count'=>'36 Sitzungen im 12-Wochen-Programm','total_duration'=>'12 Wochen; KETPAIS 3 Monate'],
            'symptoms'=>['Fatigue','Brain Fog','PEM (Post-Exertional Malaise)','POTS','Muskelschmerzen (Myalgien)','Konzentrationsstörungen','Belastungsintoleranz'],
            'sources'=>[['title'=>'KETPAIS','url'=>'https://drks.de/search/de/trial/DRKS00038849'],['title'=>'KMT-Programmauswertung','url'=>'https://pmc.ncbi.nlm.nih.gov/articles/PMC13080129/']],
            'providers'=>array_map(static fn(array $p):array=>['kind'=>$p[0],'name'=>$p[1],'location'=>$p[2],'postal_code'=>null,'detail'=>$p[3],'lat'=>null,'lng'=>null,'pro'=>null,'neutral'=>null,'contra'=>null,'care'=>['Neuer Kandidat','Angebot belegt'],'contact'=>[$p[4]]],[
                ['Arzt','Dr. Christian Warner','Hamburg','Medizinisch begleitete ketogene/kohlenhydratreduzierte Ernährung; Long COVID, ME/CFS und Dysautonomie genannt','https://dr-warner.hamburg/ernaehrungsmedizin/'],
                ['Programm','Enable Your Healing LLC','Online','12-wöchiges KMT-Lifestyle-Programm für Dysautonomie, ME/CFS und Long COVID','https://pmc.ncbi.nlm.nih.gov/articles/PMC13080129/'],
                ['Klinik','Universitätsklinikum OWL / Kinder- und Jugendmedizin Bielefeld','Bielefeld','KETPAIS-Beratung im Studienrahmen','https://drks.de/search/de/trial/DRKS00038849'],
                ['Beratung','Julia Tulipan','Online','Keto-Coach; Long COVID als Fachgebiet genannt, Ablauf nur eingeschränkt belegt','https://www.go-keto.com/de/coaches/julia-tulipan/'],
            ]),
            'relationships'=>['current_name'=>'Ketogene Ernährung mit Berater (Long-COVID-Kontext)','current_rating'=>null,'related_treatments'=>['classification'=>'Verwandte und alternative Ernährungsansätze','items'=>[
                ['name'=>'Low-Carb-Ernährung','type'=>'Verwandte Behandlung · LCN-ID 467','positive_rating'=>null,'slug'=>'low-carb-ernaehrung'],
                ['name'=>'Intervallfasten','type'=>'Verwandte Behandlung · LCN-ID 462','positive_rating'=>null,'slug'=>'intervallfasten'],
                ['name'=>'Antiinflammatorische Ernährung','type'=>'Alternative Behandlung · LCN-ID 458; eingeschränkt belegt','positive_rating'=>null,'slug'=>'antiinflammatorische-ernaehrung'],
            ]],'alternative_products'=>[],'alternative_treatments'=>[]],
        ]),
    ],
    'keto-self-general' => [
        'meta'=>['fixture_label'=>'Ketogene Ernährung ohne Berater · allgemeiner Kontext · Recherche v0.12 vom 28.08.2026','scenario_labels'=>['complete'=>'Selbstanwendung; allgemeiner Kontext']],
        'treatment'=>array_replace_recursive($ketoBase,[
            'name'=>'Ketogene Ernährung ohne Berater (allgemein)',
            'description'=>'Selbstständig durchgeführte ketogene Ernährung ist eine sehr kohlenhydratarme, fettreiche Ernährungsweise. Allgemein wird sie unter anderem für Gewichtsreduktion und metabolische Ziele eingesetzt. Die Evidenz ist stark ziel- und indikationsabhängig; kurzfristige metabolische Vorteile stehen möglichen Nebenwirkungen, erhöhtem LDL und Fragen der langfristigen Nachhaltigkeit gegenüber. Die medizinische ketogene Ernährung bei bestimmten Epilepsien wird dagegen üblicherweise professionell überwacht und ist nicht mit dieser Selbstanwendung gleichzusetzen.',
            'studies'=>[
                ['name'=>'Keto-Med randomized crossover trial','kind'=>'Randomisierte Crossover-Studie bei Prädiabetes oder Typ-2-Diabetes','phase'=>null,'url'=>'https://pubmed.ncbi.nlm.nih.gov/35641199/'],
                ['name'=>'Metabolic and Orexin-A Responses to Ketogenic Diet and Intermittent Fasting','kind'=>'Randomisierte 12-Monats-Studie bei Erwachsenen mit Adipositas','phase'=>null,'url'=>'https://pubmed.ncbi.nlm.nih.gov/41599851/'],
            ],
            'costs'=>['unit'=>'Normale individuelle Lebensmittelkosten','typical_count'=>null,'total'=>null,'ongoing'=>'laufende Lebensmittelkosten'],
            'reimbursement'=>'GKV und PKV: nein für normale Lebensmittel-/Selbstmanagementkosten',
            'reimbursement_details'=>[
                'gkv'=>['status'=>'nein','certainty'=>'belegt eindeutig','note'=>'Normale Lebensmittelkosten werden nicht als ketogene Ernährungstherapie übernommen. Eine mögliche Bezuschussung qualifizierter Ernährungstherapie gehört zum separaten Fall „mit Berater“.','url'=>null],
                'pkv'=>['status'=>'nein','certainty'=>'belegt eindeutig','note'=>'Normale Lebensmittel- und Selbstmanagementkosten sind selbst zu tragen. Individuelle Tarifregelungen für medizinisch indizierte Ernährungstherapie betreffen den beratenen Fall.','url'=>null],
            ],
            'setting'=>'Selbstständig zu Hause; kein Anbieter erforderlich',
            'scope'=>['duration'=>'tägliche Lebensmittelauswahl','frequency'=>'täglich / kontinuierlich','count'=>null,'total_duration'=>'individuell; häufig Wochen bis Monate, bei medizinischer ketogener Ernährung gegebenenfalls langfristig'],
            'symptoms'=>['Migräne','Kopfschmerzen','Brain Fog','Fatigue'],
            'sources'=>[['title'=>'Keto-Med','url'=>'https://pubmed.ncbi.nlm.nih.gov/35641199/'],['title'=>'Review zum Migränebezug','url'=>'https://pubmed.ncbi.nlm.nih.gov/37377485/']],
            'providers'=>[],
            'relationships'=>['current_name'=>'Ketogene Ernährung ohne Berater (allgemein)','current_rating'=>null,'related_treatments'=>['classification'=>'Verwandte und alternative Ernährungsansätze','items'=>[
                ['name'=>'Low-Carb-Ernährung','type'=>'Verwandte Behandlung · LCN-ID 467','positive_rating'=>null,'slug'=>'low-carb-ernaehrung'],
                ['name'=>'Intervallfasten','type'=>'Alternative Behandlung · LCN-ID 462','positive_rating'=>null,'slug'=>'intervallfasten'],
                ['name'=>'Mediterrane Ernährung','type'=>'Alternative Behandlung · neuer Kandidat','positive_rating'=>null,'slug'=>'mediterrane-ernaehrung'],
            ]],'alternative_products'=>[],'alternative_treatments'=>[]],
        ]),
    ],
    'keto-self-lc' => [
        'meta'=>['fixture_label'=>'Ketogene Ernährung ohne Berater · Long-COVID-Kontext · Recherche v0.12 vom 28.08.2026','scenario_labels'=>['complete'=>'Selbstanwendung; Long-COVID-/ME/CFS-Kontext']],
        'treatment'=>array_replace_recursive($ketoBase,[
            'name'=>'Ketogene Ernährung ohne Berater (Long-COVID-Kontext)',
            'description'=>'Selbstständig durchgeführte ketogene Ernährung ist eine stark kohlenhydratreduzierte, fettreiche Ernährungsweise. Bei Long COVID und ME/CFS wird sie als Selbstmanagementversuch genutzt. Starke positive Einzelberichte stehen unzureichender höhergradiger Evidenz gegenüber; betreute Studien sind nur eingeschränkt auf die unbegleitete Variante übertragbar.',
            'studies'=>[
                ['name'=>'KETPAIS','kind'=>'Betreute Studie; nur indirekte Evidenz für unbegleitete Selbstanwendung','phase'=>null,'url'=>'https://drks.de/search/de/trial/DRKS00038849'],
                ['name'=>'Designing Nutrition Studies for Long COVID and Related Infection-Associated Chronic Illness','kind'=>'Betreutes KMT-Programm; keine kontrollierte Evidenz für unbegleitete Anwendung','phase'=>null,'url'=>'https://pmc.ncbi.nlm.nih.gov/articles/PMC13080129/'],
            ],
            'costs'=>['unit'=>'Normale individuelle Lebensmittelkosten','typical_count'=>null,'total'=>null,'ongoing'=>'laufende Lebensmittelkosten'],
            'reimbursement'=>'GKV und PKV: nein für normale Lebensmittel-/Selbstmanagementkosten',
            'reimbursement_details'=>[
                'gkv'=>['status'=>'nein','certainty'=>'belegt eindeutig','note'=>'Normale Lebensmittelkosten werden nicht als Long-COVID-Keto-Therapie übernommen. Eine mögliche Bezuschussung qualifizierter Ernährungstherapie gehört zum separaten Fall „mit Berater“.','url'=>null],
                'pkv'=>['status'=>'nein','certainty'=>'belegt eindeutig','note'=>'Normale Lebensmittel- und Selbstmanagementkosten sind selbst zu tragen. Tarifregelungen für medizinisch indizierte Ernährungstherapie betreffen den beratenen Fall.','url'=>null],
            ],
            'setting'=>'Selbstständig zu Hause; kein Anbieter erforderlich',
            'scope'=>['duration'=>'tägliche Lebensmittelauswahl','frequency'=>'täglich / kontinuierlich','count'=>null,'total_duration'=>'nicht standardisiert; Selbstversuche reichen von Wochen bis Monaten'],
            'symptoms'=>['Fatigue','Brain Fog','PEM (Post-Exertional Malaise)','Schwindel','Atemnot / Kurzatmigkeit','Kopfschmerzen','POTS'],
            'sources'=>[['title'=>'KETPAIS – nur indirekte Evidenz','url'=>'https://drks.de/search/de/trial/DRKS00038849'],['title'=>'ME/CFS-Praxisleitfaden','url'=>'https://praxisleitfaden.mecfs.de/mecfs']],
            'providers'=>[],
            'relationships'=>['current_name'=>'Ketogene Ernährung ohne Berater (Long-COVID-Kontext)','current_rating'=>null,'related_treatments'=>['classification'=>'Verwandte und alternative Ernährungsansätze','items'=>[
                ['name'=>'Low-Carb-Ernährung','type'=>'Verwandte Behandlung · LCN-ID 467','positive_rating'=>null,'slug'=>'low-carb-ernaehrung'],
                ['name'=>'Intervallfasten','type'=>'Alternative Behandlung · LCN-ID 462','positive_rating'=>null,'slug'=>'intervallfasten'],
                ['name'=>'Antiinflammatorische Ernährung','type'=>'Alternative Behandlung · LCN-ID 458; eingeschränkt belegt','positive_rating'=>null,'slug'=>'antiinflammatorische-ernaehrung'],
            ]],'alternative_products'=>[],'alternative_treatments'=>[]],
        ]),
    ],
    'help-apherese' => [
        'meta' => ['fixture_label' => 'H.E.L.P.-Apherese · Recherche v0.12 vom 27.08.2026', 'scenario_labels' => ['complete' => 'Recherche v0.12; Nutzerfelder nicht befüllt']],
        'treatment' => [
            'name' => 'H.E.L.P.-Apherese', 'short_name' => 'HELP', 'type' => 'Medizinische Prozeduren', 'subcategory' => null,
            'description' => 'H.E.L.P.-Apherese ist eine Form der LDL-/Lipidapherese (Heparin-induzierte extrakorporale Lipoprotein-/Fibrinogen-Präzipitation). Sie wird bei Long/Post-COVID von einzelnen spezialisierten Anbietern eingesetzt, ist dafür jedoch nicht als Standardtherapie etabliert. Aktuelle deutsche Fachinformationen und Leitlinien sehen für unkontrollierten Einsatz keine ausreichende Evidenz und empfehlen solche Verfahren im Long-COVID-Kontext grundsätzlich nur im Rahmen klinischer Studien.',
            'access' => 'Frei erhältlich / privater Anbieter; üblicherweise Selbstzahlerleistung', 'approved_for_condition' => false, 'off_label' => false, 'research_status' => null,
            'studies' => [
                ['name' => 'Clinical improvement of Long-COVID is associated with reduction in autoantibodies, lipids, and inflammation following therapeutic apheresis', 'kind' => 'Apherese-Publikation; keine randomisierte HELP-spezifische Wirksamkeitsstudie', 'phase' => null, 'url' => 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10152027/'],
                ['name' => 'A practical approach for the treatment of post-COVID symptoms', 'kind' => 'Fallbericht mit multimodalem Behandlungsansatz', 'phase' => null, 'url' => 'https://pubmed.ncbi.nlm.nih.gov/37087708/'],
            ],
            'costs' => ['unit' => '1.300–2.300 € pro Sitzung', 'typical_count' => 'häufig etwa 5 Sitzungen; teils mehr', 'total' => 'ca. 6.500–11.500 € bei etwa 5 Sitzungen', 'ongoing' => null],
            'reimbursement' => 'GKV: nein · PKV: keine allgemeine Übernahme belegt',
            'reimbursement_details' => [
                'gkv' => ['status' => 'nein', 'certainty' => 'belegt eindeutig', 'note' => 'GKV-Kostenübernahme der LDL-/HELP-Apherese nur bei den in der G-BA-Richtlinie definierten lipidologischen Indikationen; Long COVID gehört nicht dazu.', 'url' => 'https://www.g-ba.de/downloads/62-492-3704/MVV-RL_2024-10-17_iK-2025-01-21.pdf'],
                'pkv' => ['status' => 'nein', 'certainty' => 'offen oder eingeschränkt belegt', 'note' => 'Selbstzahlerleistung ist üblich; mögliche PKV-Erstattung hängt von Tarif, medizinischer Begründung und Einzelfallentscheidung ab.', 'url' => 'https://igel-monitor.de/igel-a-z/igel/show/help-apherese-zur-behandlung-von-long-post-covid.html'],
            ],
            'setting' => 'Ambulant in spezialisierten Apheresezentren oder Kliniken',
            'scope' => ['duration' => 'ca. 2,5–3 Stunden pro Sitzung einschließlich Vorbereitung und Abschluss', 'frequency' => null, 'count' => 'meist mehrere; häufig etwa 5, teils mehr', 'total_duration' => null],
            'accessibility' => [['label' => 'Behandlung körperlich anstrengend', 'value' => true], ['label' => 'Längeres Sitzen erforderlich', 'value' => true], ['label' => 'Längeres Liegen erforderlich', 'value' => true], ['label' => 'Längeres Stehen erforderlich', 'value' => false], ['label' => 'Körperliche Aktivität erforderlich', 'value' => false]],
            'aliases' => ['HELP-Apherese', 'Heparin-induzierte extrakorporale Lipoprotein/Fibrinogen-Präzipitation'], 'application' => 'Extrakorporale Blutbehandlung über venöse Zugänge',
            'medication' => ['active_ingredient' => null, 'brand' => null, 'class' => null, 'dosage' => null],
            'classification' => ['atc' => null, 'ichi' => null],
            'symptoms' => ['Fatigue', 'Brain Fog', 'Kurzatmigkeit', 'Kopfschmerzen', 'Schwindel'],
            'reviewed_at' => '27.08.2026',
            'sources' => [
                ['title' => 'IGeL-Monitor – HELP-Apherese bei Long/Post-COVID', 'url' => 'https://igel-monitor.de/igel-a-z/igel/show/help-apherese-zur-behandlung-von-long-post-covid.html'],
                ['title' => 'B. Braun – technische Apherese-Beschreibung', 'url' => 'https://www.bbraun.com/en/products-and-solutions/therapies/extracorporeal-blood-treatment-therapies/apheresis.html'],
                ['title' => 'Dr. Beate Jaeger', 'url' => 'https://drbeatejaeger.com/de/'],
            ],
            'providers' => [
                ['kind' => 'Ärztin', 'name' => 'Dr. Beate Jaeger', 'location' => null, 'postal_code' => null, 'detail' => 'Angebot eindeutig belegt · LCN-ID 542', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['LCN-Bestand', 'Belegt eindeutig'], 'contact' => ['Anbieterseite']],
                ['kind' => 'Klinik', 'name' => 'Apheresis Center Cyprus', 'location' => 'Zypern', 'postal_code' => null, 'detail' => 'Angebot eindeutig belegt · LCN-ID 1162', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['LCN-Bestand', 'Belegt eindeutig'], 'contact' => ['Anbieterseite']],
                ['kind' => 'Klinik', 'name' => 'Clinicum St. Georg', 'location' => null, 'postal_code' => null, 'detail' => 'Angebot eindeutig belegt · neuer LCN-Kandidat; Dublettenprüfung vor Import', 'lat' => null, 'lng' => null, 'pro' => null, 'neutral' => null, 'contra' => null, 'care' => ['Neuer Kandidat', 'Belegt eindeutig'], 'contact' => ['Anbieterseite']],
            ],
            'relationships' => [
                'current_name' => 'H.E.L.P.-Apherese', 'current_rating' => null,
                'related_treatments' => ['classification' => 'Apherese-Verfahren', 'items' => [
                    ['name' => 'Immunadsorption', 'type' => 'Verwandte Behandlung · eindeutig belegt', 'positive_rating' => null, 'slug' => 'immunadsorption'],
                    ['name' => 'Immunapherese', 'type' => 'Verwandte Behandlung · eingeschränkt belegt', 'positive_rating' => null, 'slug' => 'immunapherese'],
                    ['name' => 'Inuspherese', 'type' => 'Verwandte Behandlung · eingeschränkt belegt', 'positive_rating' => null, 'slug' => 'inuspherese'],
                    ['name' => 'Plasmapherese', 'type' => 'Verwandte Behandlung · eindeutig belegt', 'positive_rating' => null, 'slug' => 'plasmapherese'],
                    ['name' => 'Plasmapherese + IVIG', 'type' => 'Verwandte Behandlung · eingeschränkt belegt', 'positive_rating' => null, 'slug' => 'plasmapherese-ivig'],
                ]],
                'alternative_products' => [], 'alternative_treatments' => [],
            ],
        ],
    ],
];

if (isset($fixtureOverrides[$fixture])) {
    $data = array_replace_recursive($data, $fixtureOverrides[$fixture]);
    foreach (['studies', 'symptoms', 'sources', 'aliases', 'accessibility'] as $listKey) {
        if (array_key_exists($listKey, $fixtureOverrides[$fixture]['treatment'])) {
            $data['treatment'][$listKey] = $fixtureOverrides[$fixture]['treatment'][$listKey];
        }
    }
    if (isset($fixtureOverrides[$fixture]['treatment']['providers'])) {
        $data['treatment']['providers'] = $fixtureOverrides[$fixture]['treatment']['providers'];
    } else {
        $data['treatment']['providers'] = [];
    }
    if (isset($fixtureOverrides[$fixture]['treatment']['relationships'])) {
        $data['treatment']['relationships'] = $fixtureOverrides[$fixture]['treatment']['relationships'];
    } else {
        $data['treatment']['relationships'] = ['related_treatments' => ['classification' => null, 'items' => []], 'alternative_products' => [], 'alternative_treatments' => []];
    }
    $pemRisk = match ($fixture) {
        'keto-advisor-general', 'keto-self-general' => 'Niedrig',
        'ldn-research', 'hbot', 'mhbot', 'keto-advisor-lc', 'keto-self-lc' => 'Mittel',
        default => null,
    };
    $data['treatment']['experience'] = ['total' => 0, 'ratings' => ['positive' => 0, 'neutral' => 0, 'negative' => 0], 'gamechanger' => 0, 'pem_risk' => $pemRisk, 'onset' => []];
}

if ($scenario === 'research') {
    $data['treatment']['costs'] = null;
    $data['treatment']['reimbursement'] = null;
    $data['treatment']['setting'] = null;
    $data['treatment']['scope'] = null;
    $data['treatment']['accessibility'] = [];
    $data['treatment']['application'] = null;
    $data['treatment']['medication']['dosage'] = null;
    $data['treatment']['symptoms'] = [];
    $data['treatment']['relationships'] = [
        'related_treatments' => ['classification' => null, 'items' => []],
        'alternative_products' => [],
        'alternative_treatments' => [],
    ];
    $data['treatment']['experience'] = null;
    $data['treatment']['providers'] = [];
}

echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
