<?php
// Read-only coverage report. php scripts/audit_doctor_profiles.php > docs/doctor-profile-coverage.md
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/_doctor_hybrid.php';
$pdo = lcnDoctorDatabase();
$fields = ['Name', 'Praxis / Organisation', 'Website', 'Telefon', 'E-Mail', 'Adresse', 'Fachrichtungen', 'Spezialisierungen', 'Zusatzqualifikationen / Weiterbildungen', 'Treatments'];
$counts = array_fill_keys($fields, 0);
$multiple = [];
$entityCounts = [];
$known = static fn($value) => $value !== null && trim((string)$value) !== '' && !in_array(mb_strtolower(trim((string)$value)), ['unbekannt','unknown','nicht recherchiert','keine angabe'], true);
foreach (LCN_PRIORITY_DOCTOR_IDS as $id) {
    $research = lcnDoctorResearch($pdo, $id);
    $entity = $research['entity'];
    $location = $research['locations'][0] ?? [];
    $statement = $pdo->prepare('SELECT COUNT(DISTINCT treat_id) FROM tbl_cpl_drs2treatments_03 WHERE dr_id = ?');
    $statement->execute([$id]);
    $treatments = (int)$statement->fetchColumn();
    $values = [$entity['anzeigename'], $entity['organisationsname'], $entity['website'], $location['loc_phone'] ?? $entity['telefon'], $location['loc_email'] ?? $entity['email'],
        ($location['loc_city'] ?? '') !== '' && ($location['loc_street'] ?? '') !== '' ? 'vorhanden' : null,
        count($research['specialty']) ?: null, count($research['specializations']) ?: null, count($research['qualifications']) ?: null, $treatments ?: null];
    foreach ($fields as $index => $field) if ($known($values[$index])) $counts[$field]++;
    foreach ($entity as $field => $value) if ($known($value)) $entityCounts[$field] = ($entityCounts[$field] ?? 0) + 1;
    if (count($research['specialty']) > 1) $multiple[] = $entity['anzeigename'] . ' (' . count($research['specialty']) . ')';
    if ($id === 627) $stingl = [count($research['specialty']), count($research['specializations']), count($research['qualifications'])];
}
echo '# Datenabdeckung der 39 Behandler' . "\n\nStand: " . date('Y-m-d') . ". Lesende Auswertung der vorhandenen Hybrid-Datenbank.\n\n";
echo "Gezählt werden nichtleere Werte; unbekannt / nicht recherchiert / keine Angabe zählen nicht als erhoben. Bei Fachprofilen zählt mindestens ein zugeordneter Eintrag. Kontakt berücksichtigt den Hauptstandort. Adresse bedeutet Straße und Ort, keine postalische Validierung.\n\n";
echo "| Steckbrieffeld | Behandler mit Angabe | Anteil |\n|---|---:|---:|\n";
foreach ($counts as $field => $count) echo "| $field | $count / 39 | " . round($count * 100 / 39) . " % |\n";
echo "\n## Fachprofile\n\nDr. Michael Stingl: {$stingl[0]} Fachrichtung(en), {$stingl[1]} Spezialisierung(en), {$stingl[2]} Zusatzqualifikation(en).\n\n";
echo 'Mehrere Fachrichtungen: ' . implode('; ', $multiple) . ".\n\n";
echo "## Weitere recherchierte Felder\n\nDiese Felder gehören überwiegend zu den Detailansichten; sie werden nicht als Community-Antworten interpretiert.\n\n| Datenfeld | Behandler mit Angabe |\n|---|---:|\n";
foreach (['sprechstunde_gkv','sprechstunde_pkv','kassensitz','ersttermin_vor_ort','ersttermin_telefon','ersttermin_video','folgetermin_vor_ort','folgetermin_telefon','folgetermin_video','hausbesuche','wartezeit_bis_ersttermin','warteliste_vorhanden'] as $field) echo "| $field | " . ($entityCounts[$field] ?? 0) . " / 39 |\n";
echo "\n## Umsetzung im Entwurf\n\nName, Organisation, Behandlertyp, alle Fachrichtungen, Spezialisierungen, Zusatzqualifikationen / Weiterbildungen, Adresse, Land und Kontakt werden im Überblick angezeigt. Nicht erhobene Werte bleiben als „Noch keine Angabe“ sichtbar. Treatments bleiben auf der Wirkungsseite mit vollständigen Kategorien und Anzahlen. Aus Rechercheangaben werden keine Community-Prozentwerte abgeleitet.\n";
