<?php
declare(strict_types=1);
require_once __DIR__ . '/api/_treatments_nd.php';
require_once __DIR__ . '/api/_treatment_id_migration.php';
if (isset($_GET['nd_id']) && !isset($_GET['treatment_id'])) {
    $previous = filter_var($_GET['nd_id'], FILTER_VALIDATE_INT);
    $target = LCN_PREVIOUS_ND_IDS[$previous] ?? null;
    if (!$target) {
        require_once __DIR__ . '/components/treatments_nd_view.php';
        http_response_code(404); ndStart('Behandlung nicht gefunden', true, true);
        echo '<section class="card" role="alert"><h1>Behandlung nicht gefunden</h1><p>Dieser Link führt zu keiner verfügbaren Behandlung.</p><a href="therapien_karte.html">Zur Behandlungssuche</a></section>';
        ndEnd(); exit;
    }
    $params = ['treatment_id'=>$target];
    if (isset($_GET['demo'])) $params['demo'] = $_GET['demo'] === '1' ? '1' : '0';
    header('Location: therapie_detail.php?' . http_build_query($params), true, 302); exit;
}
require_once __DIR__ . '/components/treatments_nd_view.php';
require_once __DIR__ . '/components/treatments_nd_reduced.php';
require_once __DIR__ . '/components/treatments_nd_map.php';
$id = filter_var($_GET['treatment_id'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
$legacyId = filter_var($_GET['treat_id'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
$item = null; $error = null;
try {
    if (!$id && $legacyId) {
        $mapped = lcnNdRows(lcnTreatmentsNdDatabase(), 'SELECT treat_nd_id FROM tbl_treatments_nd WHERE treat_nd_id = ?', [$legacyId]);
        if (!$mapped) { header('Location: therapie_detail.html?treat_id='.$legacyId.'&source=priority'); exit; }
        $id = (int)$mapped[0]['treat_nd_id'];
    }
    if (!$id) { http_response_code(400); $error = 'Bitte wähle eine Behandlung aus der Suche aus.'; }
    else {
    $item = lcnNdDetail(lcnTreatmentsNdDatabase(), $id);
    if (!$item) { http_response_code(404); $error = 'Diese Behandlung wurde nicht gefunden.'; }
    }
} catch (Throwable $e) { lcnLogApiError('therapie_detail', $e); http_response_code(503); $error = 'Die Behandlung konnte gerade nicht geladen werden.'; }
ndStart($item['treatmentname'] ?? 'Behandlung', true, true);
if ($error) { echo '<section class="card" role="alert"><h1>Behandlung nicht verfügbar</h1><p>'.ndEscape($error).'</p><a href="therapien_karte.html">Zur Behandlungssuche</a></section>'; ndEnd(); return; }
$views = ['ueberblick'=>'Überblick','termin'=>'Welche Belastungshürden gibt es bei der Behandlung?','zugang'=>'Wie zugänglich ist die Behandlung?','wirkung'=>'Welche Erfahrungen gibt es?','alternativen'=>'Behandlungsalternativen'];
?>
<div class="detail-layout ux-detail" data-treatment-id="<?= (int)$id ?>" data-previous-treatment-id="<?= (int)array_search((int)$id, LCN_PREVIOUS_ND_IDS, true) ?>">
<nav class="side-nav" aria-label="Ansichten der Behandlung"><div class="nav-items">
<?php $n=0; foreach ($views as $view=>$label): ?><a href="#<?= $view ?>" data-view="<?= $view ?>"><span class="nav-number"><?= ++$n ?></span><span><strong><?= str_replace("Behandlungsalternativen", "Behandlungs&shy;alternativen", ndEscape($label)) ?></strong></span></a><?php endforeach; ?>
</div></nav>
<div id="view-content" tabindex="-1">
<p class="ux-test-notice">Bewertungen werden gespeichert und in den Community-Ergebnissen mitgezählt. Du kannst deine Antwort ändern oder zurücksetzen. <span id="ux-demo-state"></span></p>
<noscript>Bitte JavaScript aktivieren, um zwischen den Ansichten zu wechseln und eigene Angaben auszuwählen.</noscript>
<section id="ueberblick" class="nd-panel" aria-label="Überblick">
<?php if (($item['review_status'] ?? '') === 'altbestand_ungeprueft'): ?><p class="ux-test-notice">Übernommener Bestand · Angaben noch nicht geprüft.</p><?php endif; ?>
<section class="card overview-structured ux-treatment-overview"><h2 class="overview-heading">Überblick</h2>
<div class="overview-profile-grid">
<aside class="overview-identity"><span class="ux-eyebrow">Behandlung</span><h3><?= ndEscape($item['treatmentname']) ?></h3><div class="overview-organization"><span>Bereich</span><strong><?= ndEscape($item['unterkategorie'] ?: 'Noch keine Angabe') ?></strong></div><span class="overview-type-badge"><?= ndEscape($item['typ']) ?></span></aside>
<div class="overview-groups">
<section class="overview-group"><div class="overview-group-content"><h3>Auf einen Blick</h3><?= ndFields($item, ['durchfuehrungssetting'=>'Durchführungssetting','zugang'=>'Zugang','zulassung_long_covid_mecfs'=>'Für Long COVID / ME/CFS zugelassen']) ?: '<p>Noch keine redaktionellen Angaben vorhanden.</p>' ?></div></section>
<?php $aliasGroups=ndAliasGroups($item); if ($aliasGroups): ?><section class="overview-group"><div class="overview-group-content"><h3>Auch bekannt als</h3><?= $aliasGroups ?></div></section><?php endif; ?>
<section class="overview-group"><div class="overview-group-content"><h3>Community-Erfahrungen</h3><a href="#wirkung" data-community-summary>Erfahrungen ansehen →</a></div></section>
</div></div></section></section>
<section id="termin" class="nd-panel" aria-label="Welche Belastungshürden gibt es bei der Behandlung?" hidden><h2>Welche Belastungshürden gibt es bei der Behandlung?</h2><p class="ux-section-intro">So läuft die Behandlung ab und das bedeutet sie im Alltag.</p>
<?= ndReducedChart($item,'setting','Durchführungssetting','rows',$item['durchfuehrungssetting'] ?? '') ?>
<?= ndReducedChart($item,'pem','Crash-/PEM-Risiko','segments') ?>
<?= ndProviderMap($item, 'anbieter') ?>
</section>
<section id="zugang" class="nd-panel" aria-label="Zugang & Kosten" hidden><h2>Wie zugänglich ist die Behandlung?</h2><p class="ux-section-intro">Was brauche ich dafür, wie komme ich daran und was kostet mich das?</p>
<?= ndReducedChart($item,'access','Zugang – wie erhalte ich die Behandlung?','rows',$item['zugang'] ?? '') ?>
<?= ndReducedChart($item,'unit_cost','Kosten pro Behandlung / Einheit','cost') ?>
<?= ndReducedChart($item,'total_cost','Gesamtkosten der Behandlung','cost') ?>
</section>
<section id="wirkung" class="nd-panel" aria-label="Erfahrungen, Wirkung & Symptome" hidden><h2>Welche Erfahrungen gibt es?</h2><p class="ux-section-intro">Gesamtbewertung, Gamechanger und Symptombezüge auf einen Blick.</p>
<?= ndReducedChart($item,'effect','Gesamtbewertung','effect') ?>
<?= ndReducedChart($item,'gamechanger','Gamechanger?','donut') ?>
<section class="card"><h3>Wobei könnte die Behandlung helfen?</h3><p>Redaktionelle Symptombezüge · Die Zuordnung ist kein Nachweis der Wirksamkeit.</p><div class="ux-symptom-groups">
<?php $groups=[]; foreach ($item['symptoms'] as $symptom) $groups[$symptom['sym_category'] ?: 'Weitere Beschwerden'][]=$symptom['sym_name'];
foreach ($groups as $group=>$names) echo '<section><h4>'.ndEscape($group).'</h4>'.ndChips($names).'</section>';
if (!$groups) echo '<p>Noch keine redaktionellen Symptombezüge vorhanden.</p>'; ?>
</div>
<?php if ($item['symptoms']): ?><div class="ux-symptom-demo">
<h3>Community-Erfahrungen nach Symptom</h3>
<p class="community-label">Klicke auf einen Balken, um deine Erfahrung für das jeweilige Symptom anzugeben. Deine Antwort wird gespeichert und mitgezählt.</p>
<div class="ux-symptom-demo-grid">
<?php
$demoSymptoms = $item['symptoms'];
$demoDistributions = [[8,20,68,4], [12,32,54,2], [10,24,60,6]];
foreach ($demoSymptoms as $index=>$symptom) {
    $chart = ndReducedChart(['community'=>[]], 'effect', $symptom['sym_name'], 'effect');
    echo str_replace('data-question="effect"', 'data-question="symptom-'.(int)$symptom['sym_id'].'" data-demo-counts="'.ndEscape(json_encode($demoDistributions[$index % count($demoDistributions)])).'"', $chart);
}
?>
</div></div><?php endif; ?></section></section>
<section id="alternativen" class="nd-panel" aria-label="Behandlungsalternativen" hidden><h2>Behandlungsalternativen</h2><p>Verknüpfte Behandlungen entdecken · keine Empfehlung oder Rangliste.</p><div class="ux-alternatives">
<?php
foreach (['verwandte Behandlung'=>'Verwandte Behandlungen','alternative Behandlung'=>'Alternative Behandlungen','alternatives Präparat'=>'Alternative Präparate'] as $type=>$label) {
    $entries='';
    foreach ($item['relations'] as $relation) {
        if ($relation['beziehungstyp'] !== $type || !$relation['resolved_name']) continue;
        $href=$relation['resolved_nd_id'] ? 'therapie_detail.php?treatment_id='.(int)$relation['resolved_nd_id'] : ($relation['resolved_legacy_id'] ? 'therapie_detail.html?treat_id='.(int)$relation['resolved_legacy_id'] : null);
        if ($href) $entries.='<li><a href="'.ndEscape($href).'">'.ndEscape($relation['resolved_name']).' →</a></li>';
    }
    $content = $entries ? '<ul class="nd-directory">'.$entries.'</ul>' : '<div class="ux-empty-relation"><span aria-hidden="true">↗</span><strong>Noch keine Verknüpfung hinterlegt</strong><p>Für diese Behandlung ist dieser Beziehungstyp bisher nicht dokumentiert.</p></div>';
    echo ndCard($label, $content);
} ?>
</div>
<?php
$aliasPeers=[];
foreach ($item['alias_peers'] as $peer) {
    $peerKey=$peer['resolved_nd_id'] ? 'nd:'.$peer['resolved_nd_id'] : 'legacy:'.$peer['resolved_legacy_id'];
    $aliasPeers[$peerKey]['peer']=$peer;
    $aliasPeers[$peerKey]['aliases'][]=$peer['alias'];
}
if ($aliasPeers): ?>
<section class="card ux-discovery ux-alias-discovery"><div class="ux-discovery-heading"><div><span class="ux-eyebrow">Vorhandene Verknüpfungen</span><h3>Über gemeinsame Bezeichnungen verbunden</h3></div><span class="ux-count">Alias-System</span></div><p>Diese Einträge teilen eine Alias-Bezeichnung mit dieser Behandlung. Eine gemeinsame Bezeichnung kann auch auf eine Kombination verweisen und belegt keine Austauschbarkeit.</p><div class="ux-peer-grid">
<?php foreach ($aliasPeers as $entry): $peer=$entry['peer']; $href=$peer['resolved_nd_id'] ? 'therapie_detail.php?treatment_id='.(int)$peer['resolved_nd_id'] : 'therapie_detail.html?treat_id='.(int)$peer['resolved_legacy_id']; ?>
<a href="<?= ndEscape($href) ?>"><strong><?= ndEscape($peer['resolved_name']) ?><span aria-hidden="true">↗</span></strong><small>Gemeinsame Alias-Bezeichnung<?= $peer['resolved_nd_id'] ? '' : ' · bisheriger Katalog' ?></small><?= ndChips(array_unique($entry['aliases'])) ?></a>
<?php endforeach; ?></div></section><?php endif;
$peers=[];
foreach ($item['symptom_peers'] as $peer) { $peers[$peer['treat_nd_id']]['name']=$peer['treatmentname']; $peers[$peer['treat_nd_id']]['symptoms'][]=$peer['sym_name']; }
if ($peers): ?>
<section class="card ux-discovery"><div class="ux-discovery-heading"><div><span class="ux-eyebrow">Navigation über Symptombezüge</span><h3>Über gemeinsame Symptome entdecken</h3></div><span class="ux-count"><?= count($peers) ?> Behandlungen</span></div><p>Diese Behandlungen sind einigen derselben Symptome zugeordnet. Das belegt weder eine vergleichbare Wirkung noch eine Eignung als Ersatz.</p><div class="ux-peer-grid">
<?php foreach ($peers as $peerId=>$peer): ?><a href="therapie_detail.php?treatment_id=<?= (int)$peerId ?>"><strong><?= ndEscape($peer['name']) ?><span aria-hidden="true">↗</span></strong><small>Gemeinsame Symptombezüge</small><?= ndChips($peer['symptoms']) ?></a><?php endforeach; ?>
</div></section><?php endif; ?>
</section></div></div><?php ndEnd(); ?>

