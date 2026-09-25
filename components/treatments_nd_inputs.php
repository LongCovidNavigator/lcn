<?php
declare(strict_types=1);

// User/hybrid fields from the v0.13 research schema. No editorial preselection.
function ndInputChoices(string $key, string $label, array $options, bool $multiple = false): string
{
    $help = [
        'rating' => ['positiv' => ['↑', 'Insgesamt eine hilfreiche Erfahrung.'], 'neutral' => ['↔', 'Insgesamt weder positiv noch negativ.'], 'negativ' => ['↓', 'Insgesamt eine ungünstige Erfahrung.']],
        'pem' => ['keines' => ['○', 'Du hast kein Crash-/PEM-Risiko wahrgenommen.'], 'niedrig' => ['▂', 'Du schätzt das Risiko als gering ein.'], 'mittel' => ['▄', 'Du schätzt das Risiko als mittel ein.'], 'hoch' => ['▇', 'Du schätzt das Risiko als hoch ein.']],
        'gamechanger' => ['ja' => ['★', 'Die Behandlung hatte einen entscheidenden Anteil an deiner Verbesserung.'], 'nein' => ['○', 'Kein entscheidender Anteil – sie kann trotzdem hilfreich gewesen sein.']],
        'onset' => ['Stunden' => ['◷', 'Erste Veränderung innerhalb von Stunden.'], 'Tage' => ['◷', 'Erste Veränderung nach Tagen.'], 'Wochen' => ['◷', 'Erste Veränderung nach Wochen.'], 'Monate' => ['◷', 'Erste Veränderung nach Monaten.'], 'keine Wirkung' => ['○', 'Bisher keine Wirkung wahrgenommen.']],
        'setting' => ['selbstständig zu Hause' => ['⌂', 'Du führst die Behandlung selbst zu Hause durch.'], 'Hausbesuch' => ['⌂', 'Eine behandelnde Person kommt zu dir.'], 'ambulant' => ['↗', 'Behandlung vor Ort ohne stationäre Aufnahme.'], 'stationär' => ['▣', 'Behandlung mit stationärem Aufenthalt.']],
        'gkv' => ['ja' => ['✓', 'In deinem Fall hat die GKV Kosten übernommen.'], 'nein' => ['−', 'In deinem Fall keine GKV-Übernahme. Nicht GKV-versichert? Bitte offen lassen.']],
        'pharmacy' => ['ja' => ['✓', 'Zum Beispiel eine individuelle Rezeptur oder besondere Beschaffung.'], 'nein' => ['−', 'Keine besondere Apothekenleistung nötig.']],
    ];
    $intro = ['pem' => 'Persönliche Einschätzung, keine medizinisch festgelegten Risikogrenzen. Nicht beurteilbar? Lass die Frage offen.', 'rating' => 'Bewerte deine Gesamterfahrung. Das ist keine Aussage über die Wirksamkeit bei anderen Menschen.', 'onset' => 'Gemeint ist die erste wahrgenommene Veränderung, nicht die Dauer der Einnahme. Du kannst die Frage offen lassen.'];
    $html = '<fieldset class="nd-answer" data-answer="' . ndEscape($key) . '"><legend>' . ndEscape($label) . '</legend>' . (isset($intro[$key]) ? '<p class="nd-answer-help">' . ndEscape($intro[$key]) . '</p>' : '') . '<div class="nd-choice-scale" style="--count:' . count($options) . '">';
    foreach ($options as $i => $option) {
        [$symbol, $description] = $help[$key][$option] ?? [$multiple ? '✓' : ($option === 'ja' ? '✓' : '−'), ''];
        $html .= '<label><input type="' . ($multiple ? 'checkbox' : 'radio') . '" name="' . ndEscape($key) . ($multiple ? '[]' : '') . '" value="' . ndEscape($option) . '"><span class="nd-scale-mark" aria-hidden="true">' . ndEscape($symbol) . '</span><strong>' . ndEscape($option) . '</strong>' . ($description ? '<small>' . ndEscape($description) . '</small>' : '') . '</label>';
    }
    return $html . '</div><button type="button" class="nd-clear-answer" data-clear-answer="' . ndEscape($key) . '">Auswahl zurücksetzen</button></fieldset>';
}
function ndInputText(string $key, string $label, string $hint = ''): string
{
    return '<label class="nd-text-answer">' . ndEscape($label) . '<textarea name="' . ndEscape($key) . '" rows="2" maxlength="1500" placeholder="' . ndEscape($hint) . '"></textarea></label>';
}
function ndInputForm(string $title, string $content): string
{
    return '<section class="card nd-input-card"><h3>' . ndEscape($title) . '</h3><p class="community-label">Deine Angaben · Testentwurf in diesem Tab, keine Veröffentlichung</p><noscript><p>Bitte JavaScript aktivieren, um die Testeingaben auszuprobieren.</p></noscript><form class="nd-user-form" hidden>' . $content . '<button type="submit" class="nd-save-draft">Testentwurf übernehmen</button><p class="nd-draft-status" role="status"></p></form></section>';
}
function ndDistributionInput(string $key, string $title, array $options, array $notes, bool $multiple = false): string
{
    $html = '<fieldset class="nd-answer nd-distribution" data-answer="' . $key . '"><legend>' . ndEscape($title) . '</legend><div class="chart-heading"><p>' . ($multiple ? 'Klicke auf alle zutreffenden Möglichkeiten. Mehrfachauswahl möglich; erneutes Anklicken hebt die Auswahl auf.' : 'Klicke auf einen Balken, um deine Einschätzung abzugeben. Nicht beurteilbar? Lass die Frage offen.') . '</p><span data-distribution-note="' . $key . '">Keine Community-Daten</span></div><div class="effect-chart nd-distribution-chart">';
    foreach ($options as $index => $option) {
        $html .= '<label class="effect-column"><input type="' . ($multiple ? 'checkbox' : 'radio') . '" name="' . $key . ($multiple ? '[]' : '') . '" value="' . ndEscape($option) . '"><span class="bar-area"><strong data-distribution-percent="' . $key . '" data-index="' . $index . '">–</strong><span class="effect-bar nd-' . $key . '-' . $index . '" data-distribution-bar="' . $key . '" data-index="' . $index . '" style="height:0px"></span></span><span class="effect-label">' . ndEscape($option) . '</span><small>' . ndEscape($notes[$index]) . '</small><span class="nd-selection-marker">Deine Auswahl</span></label>';
    }
    $html .= '</div><p class="nd-answer-help">' . ($multiple ? 'Die Prozentwerte beziehen sich jeweils auf die Befragten. Durch Mehrfachauswahl kann die Summe über 100 % liegen.' : ($key === 'pem' ? 'Persönliche Risikoeinschätzung, keine medizinisch festgelegten Risikogrenzen.' : 'Deine persönliche Erfahrung wird getrennt vom recherchierten Status erfasst. Testangaben bleiben in diesem Browser-Tab.')) . '</p><button type="button" class="nd-clear-answer" data-clear-answer="' . $key . '">Auswahl zurücksetzen</button></fieldset>';
    return $html;
}
function ndTableInput(string $key, string $title, array $options, array $notes, bool $multiple = false): string
{
    $html = '<fieldset class="nd-answer nd-distribution nd-answer-table" data-answer="' . ndEscape($key) . '"><legend>' . ndEscape($title) . '</legend><p>' . ($multiple ? 'Alle zutreffenden Möglichkeiten anklicken; erneutes Anklicken hebt die Auswahl auf.' : 'Eine Antwort anklicken; die Auswahl lässt sich unten zurücksetzen.') . '</p><p class="community-label" data-distribution-note="' . ndEscape($key) . '">Keine Community-Daten</p><div class="nd-option-table" role="table" aria-label="' . ndEscape($title) . '"><div class="nd-option-table-head" role="row"><strong role="columnheader">Möglichkeit</strong><strong role="columnheader">Nutzeranteil</strong><strong role="columnheader">Deine Auswahl</strong></div>';
    foreach ($options as $index => $option) {
        $html .= '<label class="nd-option-table-row" role="row"><span role="cell">' . ndEscape($option) . '</span><span role="cell" class="nd-table-distribution"><strong data-distribution-percent="' . $key . '" data-index="' . $index . '">–</strong><span class="nd-table-track" aria-hidden="true"><span data-distribution-width="' . $key . '" data-index="' . $index . '" style="width:0%"></span></span></span><span role="cell"><input type="' . ($multiple ? 'checkbox' : 'radio') . '" name="' . $key . ($multiple ? '[]' : '') . '" value="' . ndEscape($option) . '" aria-label="' . ndEscape($option) . '"><span class="nd-table-own"> ausgewählt</span></span></label>';
    }
    return $html . '</div><p class="nd-answer-help">' . ($multiple ? 'Mehrfachauswahl: Die Anteile können zusammen über 100 % liegen. ' : '') . 'Testdaten und eigene Angaben sind getrennt.</p><button type="button" class="nd-clear-answer" data-clear-answer="' . $key . '">Auswahl zurücksetzen</button></fieldset>';
}
function ndInlineInput(string $content): string
{
    return '<noscript><p>Für eigene Testangaben bitte JavaScript aktivieren.</p></noscript><form class="nd-user-form nd-inline-form" hidden>' . $content . '<button type="submit" class="nd-save-draft">Testangaben übernehmen</button><p class="nd-draft-status" role="status"></p></form>';
}
function ndVisualFact(string $label, $value, string $symbol): string
{
    if (!ndHas($value)) return '';
    return '<div class="nd-visual-fact"><span class="nd-fact-symbol" aria-hidden="true">' . $symbol . '</span><div><strong>' . ndEscape($label) . '</strong><p>' . ndEscape($value) . '</p><small>Recherchierte Angabe</small></div></div>';
}
function ndResearchAnswer(string $chart, string $label, $value, string $symbol): string
{
    $fact = ndVisualFact($label, $value, $symbol);
    return preg_replace_callback('/<\/legend>/', fn() => '</legend>' . $fact, $chart, 1);
}
function ndTreatmentInputs(string $view, array $item): string
{
    if ($view === 'termin') {
        $html = ndDistributionInput('pem', 'Wie schätzt du das Crash-/PEM-Risiko aus deiner Erfahrung ein?', ['keines', 'niedrig', 'mittel', 'hoch'], ['Kein Risiko wahrgenommen', 'Als gering eingeschätzt', 'Als mittel eingeschätzt', 'Als hoch eingeschätzt']);
        $html .= ndDistributionInput('setting', 'Wo hast du die Behandlung durchgeführt?', ['selbstständig zu Hause', 'Hausbesuch', 'ambulant', 'stationär'], ['Selbst zu Hause durchgeführt', 'Behandelnde Person kommt zu dir', 'Vor Ort, ohne stationäre Aufnahme', 'Mit stationärem Aufenthalt'], true);
        return ndInputForm('Deine Erfahrung mit der Durchführung', $html);
    }
    if ($view === 'umfang') {
        $html = '<p>Recherche, Nutzerverteilung und deine Auswahl stehen jeweils zusammen. Die Kategorien dienen zur Einordnung im Test.</p>';
        $research = ['duration' => ['dauer_einer_anwendung', '◷'], 'frequency' => ['haeufigkeit', '↻'], 'count' => ['anzahl_anwendungen', '▦'], 'total_duration' => ['gesamte_behandlungsdauer', '⟷']];
        $scales = [
            'duration' => ['Dauer einer Anwendung', ['Unter 15 Minuten', '15 bis 60 Minuten', 'Über 1 bis 3 Stunden', 'Über 3 Stunden']],
            'frequency' => ['Häufigkeit', ['Seltener als wöchentlich', 'Wöchentlich / mehrmals pro Woche', 'Einmal täglich', 'Mehrmals täglich']],
            'count' => ['Anzahl Anwendungen', ['Eine Anwendung', '2 bis 10 Anwendungen', '11 bis 30 Anwendungen', 'Mehr als 30 / fortlaufend']],
            'total_duration' => ['Gesamte Behandlungsdauer', ['Bis zu einer Woche', 'Über 1 bis 4 Wochen', 'Über 4 Wochen bis 3 Monate', 'Über 3 Monate / fortlaufend']],
        ];
        foreach ($scales as $key => [$label, $options]) {
            $html .= ndResearchAnswer(ndDistributionInput($key . '_band', $label, $options, array_fill(0, 4, '')), $label, $item[$research[$key][0]] ?? null, $research[$key][1]);
            $html .= '<details class="nd-input-details"><summary>Genauen Wert ergänzen: ' . ndEscape($label) . '</summary>' . ndInputText($key, $label, 'Wert mit Einheit; bei Bedarf fortlaufende Anwendung angeben') . '</details>';
        }
        return ndInputForm('Durchführung und zeitlicher Rahmen', '<div class="nd-visual-summary nd-time-route">' . ndVisualFact('Durchführung', $item['durchfuehrungssetting'] ?? null, '⌂') . '</div>' . $html);
    }
    if ($view === 'medikament') {
        $result = '';
        if (ndHas($item['wirkstoff']) || $item['typ'] === 'Arzneimittel') {
            $html = '<div class="nd-visual-summary nd-medicine-profile">';
            foreach (['wirkstoff' => ['Wirkstoff', '◉'], 'handels_markenname' => ['Handels- / Markenname', '◇'], 'medikamentenklasse' => ['Medikamentenklasse', '▦'], 'atc_code' => ['ATC-Code', '#']] as $field => [$label, $icon]) $html .= ndVisualFact($label, $item[$field] ?? null, $icon);
            $html .= '</div><p>Dokumentierte Anwendung; keine individuelle Dosierungsempfehlung. Die Symbole zeigen Anwendungsschritte, keine maßstabsgetreue Dosiskurve.</p>';
            $options = ['Tablette', 'Kapsel', 'Tropfen / Lösung', 'Pulver', 'Infusion', 'Injektion', 'Inhalation', 'Pflaster', 'Spray', 'Creme / Gel / Salbe', 'Zäpfchen', 'Sonstige'];
            $html .= ndResearchAnswer(ndTableInput('application', 'Welche Anwendungsform hast du genutzt?', $options, array_fill(0, count($options), ''), true), 'Anwendungsform', $item['applikationsform'] ?? null, '◒');
            $html .= '<div class="nd-visual-summary nd-dose-summary">' . ndVisualFact('Dosierung / Dosierungsbereich', $item['dosierung_dosierungsbereich'] ?? null, '⚖') . ndVisualFact('Einnahmehäufigkeit', $item['einnahmehaeufigkeit'] ?? null, '↻') . '</div>';
            $html .= '<details class="nd-input-details"><summary>Genaue eigene Dosierung und Einnahmehäufigkeit ergänzen</summary>' . ndInputText('dose', 'Deine Dosierung / Dosierungsbereich', 'Mit Einheit und Bezugsgröße') . ndInputText('intake_frequency', 'Deine Einnahmehäufigkeit', 'z. B. täglich, 2× täglich, wöchentlich') . '</details>';
            foreach ([
                'titration' => ['Hast du eingeschlichen?', 'einschleichen', 'Einschleichen', '↗', 'einschleichschema', 'titration_plan', 'Dein Einschleichschema'],
                'dose_adjustment' => ['Hast du die Dosis nach Verträglichkeit individuell angepasst?', 'individuelle_dosisanpassung', 'Anpassen nach Verträglichkeit', '⇄', null, null, null],
                'taper' => ['Hast du ausgeschlichen?', 'ausschleichen', 'Ausschleichen', '↘', 'ausschleichschema', 'taper_plan', 'Dein Ausschleichschema'],
            ] as $key => [$question, $field, $label, $icon, $schema, $own, $ownLabel]) {
                $chart = ndTableInput($key, $question, ['ja', 'nein'], ['Aus deiner eigenen Anwendung', 'Aus deiner eigenen Anwendung']);
                $value = $item[$field] ?? null;
                if ($schema && ndHas($item[$schema] ?? null)) $value = trim(($value ?? '') . "
" . $item[$schema]);
                $html .= ndResearchAnswer($chart, $label, $value, $icon);
                if ($own) $html .= '<details class="nd-input-details"><summary>' . ndEscape($ownLabel) . ' ergänzen</summary>' . ndInputText($own, $ownLabel, 'Dosis mit Einheit und zeitlichen Schritten') . '</details>';
            }
            $result = ndInputForm('Anwendung des Medikaments', $html);
        }
        return $result;
    }
    if ($view === 'wirkung') {
        $html = '<fieldset class="nd-answer nd-effect-answer" data-answer="effect"><legend>Zustandsveränderung</legend><div class="chart-heading"><p>Subjektive Erfahrung nach der Behandlung. Klicke auf einen Balken, um deine Erfahrung auszuwählen.</p><span id="nd-effect-data-label">Keine Community-Daten</span></div><div class="effect-chart" role="group" aria-label="Zustandsveränderung: Community und deine Auswahl">';
        foreach (['Verschlechterung', 'Keine Veränderung', 'Verbesserung', 'Heilung'] as $index => $label) {
            $html .= '<input class="nd-effect-value" type="radio" name="effect" value="' . ndEscape($label) . '" hidden><button type="button" class="effect-column" data-effect-value="' . ndEscape($label) . '" aria-pressed="false"><span class="bar-area"><strong data-effect-percent="' . $index . '">–</strong><span class="effect-bar effect-' . $index . '" data-effect-bar="' . $index . '" style="height:0px"></span></span><span class="effect-label">' . ndEscape($label) . '</span></button>';
        }
        $html .= '</div><p class="nd-answer-help">Die Skala entspricht der Arztseite. „Heilung“ bezeichnet hier eine subjektive Selbsteinschätzung, keinen medizinischen Nachweis.</p><button type="button" class="nd-clear-answer" data-clear-answer="effect">Auswahl zurücksetzen</button></fieldset>';
        $html .= ndDistributionInput('gamechanger', 'War die Behandlung für dich ein Gamechanger?', ['ja', 'nein'], ['Entscheidender Anteil an deiner Verbesserung.', 'Kein entscheidender Anteil; die Behandlung kann trotzdem hilfreich gewesen sein.']);
        $html .= ndDistributionInput('onset', 'Wann hast du eine Wirkung / Veränderung wahrgenommen?', ['Stunden', 'Tage', 'Wochen', 'Monate', 'keine Wirkung'], ['Erste Veränderung innerhalb von Stunden', 'Erste Veränderung nach Tagen', 'Erste Veränderung nach Wochen', 'Erste Veränderung nach Monaten', 'Bisher keine Wirkung wahrgenommen']);
        $options = array_column($item['symptom_options'], 'sym_name');
        $html .= '<details class="nd-input-details"><summary>Symptome / Beschwerden zuordnen</summary>' . ndInputChoices('symptoms', 'Für welche Beschwerden hast du die Behandlung angewendet?', $options, true) . '</details>';
        return ndInputForm('Deine Erfahrung mit der Behandlung', $html);
    }
    return '';
}
