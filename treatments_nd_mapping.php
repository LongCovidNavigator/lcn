<?php
declare(strict_types=1);
require_once __DIR__ . '/api/_treatments_nd.php';
require_once __DIR__ . '/components/treatments_nd_view.php';
$groups = [
 ['Erfahrungen (Reiter 4)', 'Gamechanger und Zeit bis zur Veränderung', 'Nutzer', 'Lokaler Entwurf und abschaltbare Testverteilung', 'Je eine gemeinsame anklickbare Grafik; keine getrennte Ergebnisgrafik oder doppelte Dashboard-Auswertung'],
 ['Überblick, Belastungshürden und Erfahrungen', 'Anbieterkarte und Entfernung', 'Bestandsdaten', 'ND-Anbieterzuordnung + Standortkoordinaten', 'Gemeinsamer Ausgangsort; Luftlinie; keine erfundenen Anbieterpositionen'],
 ['Belastungshürden', 'Zeitlicher Rahmen: Dauer, Häufigkeit, Anzahl, Gesamtdauer', 'Hybrid', 'Recherche + lokale Testangaben', 'Anklickbare Balken mit abschaltbaren fiktiven Verteilungen; genaue Werte ergänzbar'],
 ['Erfahrungen (Reiter 4)', 'Zugeordnete Beschwerden', 'Recherche', 'tbl_cpl_treatments_nd2symptoms', 'Nach Beschwerdegruppen geordnet'],
 ['Angezeigte Datenpunkte', 'Feldbezogene Quellen, Sicherheit, Quellentyp, Prüfdatum', 'Recherche', 'tbl_treatment_field_sources_nd', 'Nur intern verfügbar; keine sichtbaren Quellen oder Quellenlinks in der Detailansicht'],
 ['Dashboard', 'Studienname und Prüfstatus', 'Redaktion', 'tbl_treatment_studies_nd', 'Kompakte Studienliste, nur bei vorhandenen Einträgen'],
 ['Erfahrungen / Dashboard', 'Gespeicherte Community-Antworten', 'Nutzer', 'tbl_treatment_community_answers_nd', 'Nur freigegebene / aktive Werte aggregiert; suspicious als Prüfhinweis, ohne Wertauswertung'],
 ['Überblick', 'Name, Typ, Unterkategorie, Beschreibung, Wirkstoff', 'Redaktion / interne Zuordnung', 'tbl_treatments_nd', 'Profilkarte und fachliche Einordnung'],
 ['Erfahrungen (Reiter 4)', 'Zugeordnete Symptome', 'Hybrid', 'tbl_symptoms + tbl_cpl_treatments_nd2symptoms (aktiv und eindeutig / normalisiert)', 'Vorhandene Zuordnungen als Chips; keine Wirksamkeitsaussage'],
 ['Belastungshürden (Anzeige und eigene Angaben)', 'Dauer, Häufigkeit, Anzahl und Gesamtdauer', 'Hybrid', 'tbl_treatments_nd + eigene Testeingabe', 'Recherchierter Ablauf und getrennt davon persönliche Angaben'],
 ['Belastungshürden', 'Durchführungssetting: selbstständig zu Hause, Hausbesuch, ambulant, stationär', 'Hybrid', 'Eigener Testentwurf / optionale Simulation', 'Anklickbare Verteilung mit Mehrfachauswahl; n=100, Summe kann über 100 % liegen'],
 ['Belastungshürden', 'Crash-/PEM-Risiko: keines, niedrig, mittel, hoch', 'Nutzer', 'Eigener Testentwurf / optionale Simulation', 'Eine anklickbare Verteilung für Ergebnis und eigene Antwort'],
 ['Belastungshürden', 'Wirkstoff, Markenname, Medikamentenklasse, ATC', 'Redaktion', 'tbl_treatments_nd', 'Nur vorhandene Medikamenteninformationen'],
 ['Belastungshürden (Recherche und eigene Angaben)', 'Anwendungsform, Dosierung, Einnahmehäufigkeit, Ein-/Ausschleichen mit Schema, individuelle Dosisanpassung', 'Hybrid', 'tbl_treatments_nd + eigene Testeingabe', 'Nutzerfelder für Arzneimittel; als zusätzlicher Bereich aufklappbar'],
 ['Zugänglichkeit', 'Zugang, Zulassung Long COVID / ME/CFS, Off-Label-Status', 'Redaktion', 'tbl_treatments_nd', 'Skalen mit allen Optionen; Zulassung und Off-Label nebeneinander; uneindeutige Angaben bleiben unmarkiert'],
 ['Zugänglichkeit', 'Preis pro Einheit, laufende Kosten, Gesamtkosten', 'Hybrid', 'tbl_treatment_costs_nd + eigene Testeingabe', 'Kosten mit Bezugsgröße, Erstattung davon getrennt'],
 ['Zugänglichkeit', 'GKV-Status Ja/Nein, Kostenübernahme und Hinweis; Apothekenrelevanz und Hinweis', 'Hybrid', 'tbl_treatments_nd / Kostenzeilen + eigene Testeingabe', 'Recherchierter Status plus anklickbare Nutzerverteilung im selben Ergebnisblock; Dummydaten abschaltbar'],
 ['Erfahrungen', 'Zustandsveränderung: Verschlechterung, Keine Veränderung, Verbesserung, Heilung', 'Nutzer', 'Eigener Testentwurf / optionale Simulation', 'Identische anklickbare Balken und vierstufige Skala wie bei Ärzten; fiktive Prozente abschaltbar'],
 ['Erfahrungen', 'Gamechanger: ja, nein', 'Nutzer', 'Eigener Testentwurf / optionale Simulation', 'Entscheidender Anteil an Verbesserung; im Beispiel als Prozentkennzahl'],
 ['Erfahrungen', 'Zeit bis Veränderung: Stunden, Tage, Wochen, Monate, keine Wirkung', 'Nutzer', 'Eigener Testentwurf / optionale Simulation', 'Erklärte Auswahlkarten; Verteilungsbalken bei Simulation'],
 ['Erfahrungen', 'Eigene Symptome / Beschwerden', 'Hybrid', 'Auswahl aus tbl_symptoms; eigener Testentwurf', 'Mehrfachauswahl, getrennt von den vorhandenen Zuordnungen'],
 ['Dashboard', 'Eigene Antworten und optionale simulierte Erfahrungsübersicht', 'Nutzer', 'Browser-Tab / separate feste Demo-Profile', 'Eigene und fiktive Angaben klar getrennt'],
 ['Erfahrungen (Reiter 4)', 'Anbieter', 'Bestehende Relation', 'tbl_cpl_entities2treatments_nd + tbl_entities_nd; Standort aus tbl_drs_locations_03', 'ND-Zuordnung, aktive Entities; bestätigte / Bestandsangebote und Kandidaten getrennt'],
 ['Dashboard', 'Apotheken und Angebote', 'Redaktion', 'tbl_treatment_pharmacies_nd + tbl_cpl_treatments_nd2pharmacies', 'Angebote mit Belegsicherheit; Quellen nur intern'],
 ['Überblick', 'Verwandte Treatments', 'Redaktion', 'tbl_cpl_treatments_nd_relations; Unterkategorie; tbl_cpl_treatments_nd2symptoms', 'Ausgehende Beziehungen, eingehende Verweise und getrennte Listen über gleiche Unterkategorie / Symptome. Keine Gleichsetzung mit medizinischen Alternativen'],
 ['Dashboard', 'Aliasse, Datenstand, Prüfstatus', 'Bestand / Redaktion', 'tbl_aliases_03 + tbl_cpl_treatments_nd2aliases; tbl_treatments_nd', 'Alternative Namen und Herkunftseinordnung'],
];
$items = []; $error = false;
try { $items = lcnNdSearch(lcnTreatmentsNdDatabase()); }
catch (Throwable $e) { lcnLogApiError('treatments_nd_mapping', $e); http_response_code(503); $error = true; }
ndStart('Einträge und Zuordnung');
?>
<header class="profile"><div class="profile-copy"><h1>Einträge und Zuordnung</h1><p>Welche Angaben stehen wo? Die fünf Reiter bleiben wie auf der Arztseite; die Inhalte folgen dem Treatment-Schema v0.13.</p></div></header>
<section class="card"><h2>Drei klar getrennte Datenebenen</h2><p><strong>Recherche:</strong> echte Daten aus der Hybrid-Datenbank. <strong>Eigene Angaben:</strong> dein Testentwurf im Browser-Tab. <strong>Nutzer-Dummydaten:</strong> frei erfundene Verteilungen aus zwei umschaltbaren Beispielprofilen, ohne Übernahme in eigene Antworten oder die Datenbank.</p><p>„Hybrid“ heißt: Recherche und Nutzerangaben sind vorgesehen. Im Prototyp werden sie getrennt gezeigt, nicht rechnerisch vermischt.</p></section>
<section class="card"><h2>Felder nach Reiter</h2><div class="nd-mapping-scroll"><table class="nd-mapping-table"><thead><tr><th>Reiter</th><th>Einträge</th><th>Erhebungsart</th><th>Datenquelle</th><th>Darstellung / Zuordnung</th></tr></thead><tbody>
<?php foreach ($groups as $row): ?><tr><?php foreach ($row as $cell): ?><td><?= ndEscape($cell) ?></td><?php endforeach; ?></tr><?php endforeach; ?>
</tbody></table></div></section>
<section class="card"><h2>Aktuelle Treatment-Einträge</h2><p>Typ und Unterkategorie werden unverändert aus der Datenbank übernommen. Die Beispielprofile ordnen keine medizinischen Eigenschaften zu.</p>
<?php if ($error): ?><p role="alert">Die Treatment-Liste konnte gerade nicht geladen werden.</p><?php else: ?>
<p><?= count($items) ?> Treatments</p><div class="nd-mapping-scroll"><table class="nd-mapping-table"><thead><tr><th>Treatment</th><th>Typ</th><th>Unterkategorie</th><th>Legacy-ID</th></tr></thead><tbody>
<?php foreach ($items as $item): ?><tr><td><a href="treatment_nd_test.php?id=<?= (int)$item['treat_nd_id'] ?>"><?= ndEscape($item['treatmentname']) ?></a></td><td><?= ndEscape($item['typ']) ?></td><td><?= ndEscape($item['unterkategorie'] ?? '—') ?></td><td><?= ndEscape($item['legacy_treat_id'] ?? 'Keine Verknüpfung') ?></td></tr><?php endforeach; ?>
</tbody></table></div><?php endif; ?></section>
<?php ndEnd(); ?>
