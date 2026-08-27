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
