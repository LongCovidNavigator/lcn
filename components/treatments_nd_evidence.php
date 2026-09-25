<?php
declare(strict_types=1);

function ndAccessScales(array $item, ?array $only = null): string
{
    $definitions = [
        'zugang' => ['Zugang', ['Frei erhältlich / privater Anbieter', 'Ärztliche Verordnung / Rezept erforderlich', 'Nur im Rahmen einer Studie']],
        'zulassung_long_covid_mecfs' => ['Zulassung für Long COVID / ME/CFS', ['Nein', 'Ja', 'Nicht anwendbar']],
        'off_label_status' => ['Off-Label-Status', ['Kein Off-Label', 'Off-Label', 'Nicht anwendbar']],
        'gkv_kostenuebernahme_status' => ['GKV-Kostenübernahme', ['Ja', 'Nein']],
    ];
    $html = '';
    foreach ($definitions as $field => [$title, $options]) {
        if (!in_array($field, $only ?? ['zugang', 'zulassung_long_covid_mecfs', 'off_label_status'], true)) continue;
        if (!ndHas($item[$field] ?? null)) continue;
        $raw = trim($item[$field]);
        $value = mb_strtolower($raw, 'UTF-8');
        $selected = null;
        $notApplicable = str_starts_with($value, 'nicht anwendbar');
        if ($notApplicable && $field !== 'zugang' && $field !== 'gkv_kostenuebernahme_status') $selected = 2;
        if (!$notApplicable) {
            if ($field === 'zugang') {
                // Only unambiguous stored statements: never infer a prescription requirement
                // from "verordnungsfähig", or collapse mixed product-dependent access.
                if (str_starts_with($value, 'frei erhältlich')) $selected = 0;
                elseif (in_array($value, ['ärztliche verordnung / rezept erforderlich', 'ärztliche verordnung; intravenöse infusion in medizinischer einrichtung'], true)) $selected = 1;
                elseif ($value === 'nur im rahmen einer studie') $selected = 2;
            } elseif ($field === 'zulassung_long_covid_mecfs') {
                if (preg_match('/^nein(?:\s|$)/u', $value)) $selected = 0;
                elseif ($value === 'ja') $selected = 1;
            } elseif ($field === 'gkv_kostenuebernahme_status') {
                if ($value === 'ja') $selected = 0;
                elseif ($value === 'nein') $selected = 1;
            } else {
                if (str_starts_with($value, 'kein off-label')) $selected = 0;
                elseif (str_starts_with($value, 'off-label')) $selected = 1;
            }
        }
        $html .= '<section class="nd-research-scale" data-research-scale="' . $field . '"><div class="nd-scale-heading"><h4>' . ndEscape($title) . '</h4><span>Redaktionell recherchiert</span></div><ol class="nd-option-line" style="--options:' . count($options) . '">';
        foreach ($options as $index => $option) {
            $active = $selected === $index;
            $html .= '<li' . ($active ? ' class="is-current"' : '') . '><span class="nd-option-dot" aria-hidden="true">' . ($active ? '✓' : '') . '</span><span>' . ndEscape($option) . '</span>' . ($active ? '<strong>Recherchierter Wert</strong>' : '') . '</li>';
        }
        $display = $field === 'gkv_kostenuebernahme_status' && $selected !== null ? ($selected === 0 ? 'Grundsätzlich erstattungsfähig – Voraussetzungen beachten.' : 'Keine reguläre Erstattung im recherchierten Einsatzkontext.') : $raw;
        $html .= '</ol><p class="nd-researched-value"><strong>' . ($notApplicable ? 'Nicht anwendbar' : ($selected === null ? 'Differenzierte Angabe' : 'Einordnung')) . ':</strong> ' . ndEscape($display) . '</p>';
        if ($selected === null && !$notApplicable) $html .= '<p class="nd-scale-note">Der Recherchewert lässt sich nicht eindeutig einer einzelnen Option zuordnen. Deshalb ist kein Punkt markiert.</p>';
        $html .= ndFieldEvidence($item, $field) . '</section>';
    }
    return $html ? '<div class="nd-research-scales">' . $html . '</div>' : '';
}

// Provenance remains in the repository for editorial use; not displayed in this prototype.
function ndEvidence(array $item, array $points, ?string $subpoint = null): string { return ''; }

function ndFieldEvidence(array $item, string $field): string
{
    $mapping = [
        'zugang' => ['Zugang'], 'zulassung_long_covid_mecfs' => ['Zulassung Long COVID / ME/CFS'],
        'off_label_status' => ['Off-Label-Status'], 'apothekenrelevanz' => ['Apothekenrelevanz / Bezug'],
        'hinweis_apothekenrelevanz' => ['Apothekenrelevanz / Bezug'],
        'gkv_kostenuebernahme_status' => ['Kostenübernahme GKV'], 'gkv_kostenuebernahme' => ['Kostenübernahme GKV'], 'hinweis_gkv_kostenuebernahme' => ['Kostenübernahme GKV'],
        'durchfuehrungssetting' => ['Durchführungssetting'], 'typ' => ['Typ / Unterkategorie'], 'unterkategorie' => ['Typ / Unterkategorie'],
    ];
    if (isset($mapping[$field])) return ndEvidence($item, $mapping[$field]);
    $scope = ['dauer_einer_anwendung' => 'Dauer einer Anwendung', 'haeufigkeit' => 'Häufigkeit', 'anzahl_anwendungen' => 'Anzahl Anwendungen', 'gesamte_behandlungsdauer' => 'gesamte Behandlungsdauer'];
    if (isset($scope[$field])) return ndEvidence($item, ['Behandlungsumfang'], $scope[$field]);
    $medicine = ['wirkstoff' => 'Wirkstoff', 'handels_markenname' => 'Handels-/Markenname', 'medikamentenklasse' => 'Medikamentenklasse', 'applikationsform' => 'Applikationsform', 'dosierung_dosierungsbereich' => 'Dosierung / Dosierungsbereich', 'einnahmehaeufigkeit' => 'Einnahmehäufigkeit', 'einschleichen' => 'Einschleichen', 'einschleichschema' => 'Einschleichschema', 'ausschleichen' => 'Ausschleichen', 'ausschleichschema' => 'Ausschleichschema', 'individuelle_dosisanpassung' => 'Individuelle Dosisanpassung nach Verträglichkeit', 'atc_code' => 'ATC'];
    return isset($medicine[$field]) ? ndEvidence($item, ['Medikamenteninformationen/Klassifikation'], $medicine[$field]) : '';
}

function ndCommunityReadout(array $item): string
{
    $groups = []; $pending = 0;
    foreach ($item['community'] as $row) {
        if ($row['review_status'] === 'suspicious') { $pending += (int)$row['n']; continue; }
        $groups[$row['question_key']][] = $row;
    }
    $labels = ['gesamtbewertung' => 'Gesamtbewertung', 'gamechanger' => 'Gamechanger', 'crashrisiko' => 'Crash-/PEM-Risiko', 'pem_risiko' => 'Crash-/PEM-Risiko', 'zeit_bis_wirkung' => 'Zeit bis zur Veränderung'];
    $html = '';
    foreach ($groups as $key => $rows) {
        $total = array_sum(array_column($rows, 'n'));
        $html .= '<h4>' . ndEscape($labels[$key] ?? $key) . ' · n = ' . $total . '</h4><div class="nd-demo-bars">';
        foreach ($rows as $row) {
            $pct = round(100 * (int)$row['n'] / $total);
            $html .= '<div><span>' . ndEscape(trim($row['answer_value'] . ' ' . ($row['answer_unit'] ?? ''))) . '</span><i><b style="width:' . $pct . '%;background:#1798a1"></b></i><strong>' . $pct . ' %</strong></div>';
        }
        $html .= '</div>';
    }
    if ($pending) $html .= '<p>' . $pending . ' gespeicherte Antworten sind als prüfbedürftig („suspicious“) markiert und nicht in die Auswertung aufgenommen.</p>';
    return $html ? ndCard('Gespeicherte Community-Angaben', '<p>Datenbankbestand – getrennt von den zuschaltbaren Dummydaten und deinem lokalen Testentwurf.</p>' . $html) : '';
}
