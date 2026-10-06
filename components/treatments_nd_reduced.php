<?php
declare(strict_types=1);

// Controlled UI values; no database columns or inferred category conversions.
const ND_REDUCED_SCALES = [
    'setting' => ['selbstständig zu Hause', 'Hausbesuch', 'ambulant', 'stationär'],
    'pem' => ['keines', 'niedrig', 'mittel', 'hoch'],
    'access' => ['frei erhältlich / privater Anbieter', 'ärztliche Verordnung / Rezept erforderlich', 'nur im Rahmen einer Studie'],
    'unit_cost' => ['komplett übernommen', 'bis 50 €', 'bis 100 €', 'bis 500 €', 'bis 1.000 €', 'bis 1.500 €', 'bis 2.000 €', 'über 2.000 €', 'nicht anwendbar'],
    'total_cost' => ['komplett übernommen', 'bis 100 €', 'bis 500 €', 'bis 1.000 €', 'bis 5.000 €', 'bis 10.000 €', 'bis 25.000 €', 'über 25.000 €', 'nicht anwendbar'],
    'effect' => ['Verschlechterung', 'Keine Veränderung', 'Verbesserung', 'Heilung'],
    'gamechanger' => ['Ja', 'Nein'],
];
const ND_CONTROLLED_TIMING = [
    'haeufigkeit' => ['täglich', '2–3× pro Woche', 'wöchentlich', 'alle 2 Wochen', 'monatlich', 'alle 3 Monate', 'alle 6 Monate', 'jährlich'],
    'dauer_einer_anwendung' => ['< 1 Minute', 'bis 5 Minuten', 'bis 30 Minuten', 'bis 1 Stunde', 'bis 2 Stunden', 'bis 4 Stunden', 'bis 8 Stunden', 'ganztägig', 'länger als 1 Tag'],
    'anzahl_anwendungen' => ['einmalig', 'bis 5', 'bis 10', 'bis 30', 'bis 50', 'bis 100', '> 100', 'unbegrenzt / kontinuierlich'],
    'gesamte_behandlungsdauer' => ['einmalig', 'bis 1 Woche', 'bis 1 Monat', 'bis 3 Monate', 'bis 6 Monate', 'bis 1 Jahr', 'länger als 1 Jahr', 'unbegrenzt'],
    'sonderzustaende' => ['individuell / variabel', 'nicht anwendbar', 'keine belastbare Angabe'],
];
function ndReducedChart(array $item, string $key, string $title, string $kind, string $research = ''): string
{
    $options = ND_REDUCED_SCALES[$key];
    $keys = ['setting'=>['durchfuehrungssetting'], 'pem'=>['crash_pem_risiko'], 'access'=>['zugang'], 'effect'=>['gesamtbewertung'], 'gamechanger'=>['gamechanger']];
    $counts = array_fill(0, count($options), 0);
    foreach ($item['community'] as $row) {
        if (!in_array($row['review_status'], ['active','approved'], true) || !in_array($row['question_key'], $keys[$key] ?? [], true)) continue;
        foreach ($options as $i => $label) if (mb_strtolower(trim($row['answer_value'])) === mb_strtolower($label)) $counts[$i] += (int)$row['n'];
    }
    $cost = in_array($key, ['unit_cost','total_cost'], true);
    $html = '<section class="card ux-question" data-question="'.$key.'" data-kind="'.$kind.'" data-counts="'.ndEscape(json_encode($counts)).'"><h3>'.ndEscape($title).'</h3>';
    if ($key === 'gamechanger') $html .= '<p>Hat die Behandlung deinen Alltag entscheidend verbessert?</p>';
    if ($key === 'unit_cost') $html .= '<p class="ux-basis-caption">(Behandlung / Anwendung / Packung / Flasche / Ampulle / Spritze / Rezeptur)</p>';
    if ($research !== '') $html .= '<div class="ux-research"><strong>Redaktionelle Angabe</strong><p>'.ndEscape($research).'</p></div>';
    if ($cost) {
        $html .= '<div class="insurance-toggle" role="group" aria-label="Versicherung: '.ndEscape($title).'">';
        foreach (['GKV','PKV'] as $context) $html .= '<button type="button" data-insurance="'.ndEscape($context).'" aria-pressed="'.($context==='GKV'?'true':'false').'">'.ndEscape($context).'</button>';
        $html .= '</div>';

    }
    $html .= '<p class="community-label" data-community-note></p><div class="ux-chart '.($kind==='effect'?'effect-chart':($kind==='cost'?'interactive-dot-scale':'ux-'.$kind)).'" style="--count:'.count($options).'" role="group" aria-label="'.ndEscape($title).'">';
    if ($kind === 'donut') $html .= '<svg viewBox="0 0 160 160" class="ux-donut" aria-label="Gamechanger-Verteilung"><circle cx="80" cy="80" r="60" class="ux-donut-track"/><g transform="rotate(-90 80 80)"><circle cx="80" cy="80" r="60" pathLength="100" data-segment="0" role="button" tabindex="0" aria-label="Ja auswählen"/><circle cx="80" cy="80" r="60" pathLength="100" data-segment="1" role="button" tabindex="0" aria-label="Nein auswählen"/></g><text x="80" y="78" text-anchor="middle" data-donut-value>–</text><text x="80" y="98" text-anchor="middle" class="ux-donut-caption">Ja</text></svg>';
    $displayOptions = $cost ? [8 => $options[8]] + $options : $options;
    foreach ($displayOptions as $i => $label) {
        $html .= '<button type="button" data-option="'.$i.'" data-value="'.ndEscape($label).'" aria-pressed="false" class="'.($kind==='effect'?'effect-column':'ux-choice').'">';
        if ($kind==='effect') $html .= '<span class="bar-area"><strong data-percent>–</strong><span class="effect-bar effect-'.$i.'" data-bar></span></span>';
        elseif ($kind==='cost') $html .= '<span class="dot" aria-hidden="true"></span><strong class="scale-percent" data-percent>–</strong>';
        else $html .= '<strong data-percent>–</strong><span class="ux-track" aria-hidden="true"><span data-bar></span></span>';
        $html .= '<span>'.ndEscape($label).'</span><small class="ux-selected">Deine Auswahl</small></button>';
    }
    return $html.'</div><p class="ux-own" role="status"></p><button type="button" data-clear>Auswahl zurücksetzen</button></section>';
}



/** Display genuine name variants; combinations and broader relations are not aliases here. */
function ndAliasGroups(array $item): string
{
    $normalize = static function (string $name): string {
        $name = preg_replace('/\s*\([A-Z0-9-]{2,12}\)\s*/u', '', $name);
        return mb_strtolower(preg_replace('/[\s\x{2010}-\x{2015}-]+/u', ' ', trim($name)));
    };
    $types = [
        'abbreviation'=>['Abkürzungen', 3],
        'language_variant'=>['Übersetzungen', 2], 'language_variant_de'=>['Übersetzungen', 2],
        'language_variant_en'=>['Übersetzungen', 2], 'long_form_en'=>['Übersetzungen', 2],
        'spelling_variant'=>['Andere Schreibweisen', 1], 'spelling_variant_en'=>['Andere Schreibweisen', 1],
        'long_name'=>['Andere Schreibweisen', 1], 'long_form'=>['Andere Schreibweisen', 1],
        'alternate_name'=>['Weitere Bezeichnungen', 1], 'synonym'=>['Weitere Bezeichnungen', 1],
    ];
    $names=[];
    $title=mb_strtolower(trim($item['treatmentname']));
    foreach ($item['aliases'] as $row) {
        $name=trim($row['alias']); $type=$row['alias_type'] ?? '';
        if (!isset($types[$type]) || preg_match('/\s[+&]\s|\b(?:kombi\w*|kombination\w*|combination\w*)\b/iu', $name)) continue;
        $key=$normalize($name);
        if (mb_strtolower($name) === $title || $key === '') continue;
        [$group,$priority]=$types[$type];
        if (!isset($names[$key]) || $priority > $names[$key]['priority']) $names[$key]=compact('name','group','priority');
    }
    // A spelling/long-form classification takes precedence over a generic alternate-name tag.
    foreach ($item['aliases'] as $row) {
        $key=$normalize(trim($row['alias']));
        if (isset($names[$key]) && $names[$key]['group']==='Weitere Bezeichnungen' && in_array($row['alias_type'] ?? '', ['spelling_variant','long_name','long_form'], true)) $names[$key]['group']='Andere Schreibweisen';
    }
    $html='';
    foreach (['Abkürzungen','Andere Schreibweisen','Übersetzungen','Weitere Bezeichnungen'] as $group) {
        $values=array_column(array_filter($names, static fn($entry)=>$entry['group']===$group), 'name');
        if ($values) $html.='<section><h4>'.ndEscape($group).'</h4>'.ndChips($values).'</section>';
    }
    return $html ? '<div class="ux-alias-groups">'.$html.'</div>' : '';
}
