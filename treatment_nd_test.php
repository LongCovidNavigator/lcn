<?php
declare(strict_types=1);
require_once __DIR__ . '/api/_treatments_nd.php';
require_once __DIR__ . '/components/treatments_nd_view.php';
require_once __DIR__ . '/components/treatments_nd_reduced.php';
require_once __DIR__ . '/components/treatments_nd_map.php';
$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
$item = null; $error = null;
if (!$id) { http_response_code(400); $error = 'Bitte wähle eine Behandlung aus der Testübersicht aus.'; }
else try {
    $item = lcnNdDetail(lcnTreatmentsNdDatabase(), $id);
    if (!$item) { http_response_code(404); $error = 'Diese Behandlung wurde nicht gefunden.'; }
} catch (Throwable $e) { lcnLogApiError('treatment_nd_test', $e); http_response_code(503); $error = 'Die Behandlung konnte gerade nicht geladen werden.'; }
ndStart($item['treatmentname'] ?? 'Behandlung', true, true);
if ($error) { echo '<p class="card" role="alert">'.ndEscape($error).'</p>'; ndEnd(); return; }
$views = ['ueberblick'=>'Überblick','termin'=>'Belastung & Logistik','zugang'=>'Zugang & Kosten','wirkung'=>'Erfahrungen, Wirkung & Symptome','alternativen'=>'Behandlungsalternativen'];
?>
<div class="detail-layout ux-detail" data-treatment-id="<?= (int)$id ?>">
<nav class="side-nav" aria-label="Ansichten der Treatment-Detailseite"><div class="nav-items">
<?php $n=0; foreach ($views as $view=>$label): ?><a href="#<?= $view ?>" data-view="<?= $view ?>"><span class="nav-number"><?= ++$n ?></span><span><strong><?= str_replace("Behandlungsalternativen", "Behandlungs&shy;alternativen", ndEscape($label)) ?></strong></span></a><?php endforeach; ?>
</div></nav>
<div id="view-content" tabindex="-1">
<a class="ux-back" href="treatments_nd_test.php">← Zurück zu Treatments</a>
<div class="ux-hero">
<header class="ux-treatment-context"><div class="ux-identity-copy"><span class="ux-eyebrow">Behandlung im Überblick</span><h1><?= ndEscape($item['treatmentname']) ?></h1><?= ndChips([$item['typ'], $item['unterkategorie']]) ?><p><?= ndEscape($item['beschreibung']) ?></p></div><div class="ux-treatment-art" aria-hidden="true"><?php if ($item['typ'] === 'Arzneimittel'): ?><i class="ux-capsule"></i><i class="ux-capsule ux-capsule-second"></i><?php else: ?><svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="34"/><path d="M50 30v40M30 50h40"/></svg><?php endif; ?></div></header>
<aside class="ux-glance"><h2>Auf einen Blick</h2><?= ndFields($item, ['durchfuehrungssetting'=>'Durchführungssetting','zugang'=>'Zugang','zulassung_long_covid_mecfs'=>'Zulassung Long COVID / ME/CFS']) ?: '<p>Noch keine redaktionellen Angaben vorhanden.</p>' ?><a href="#zugang">Zugang &amp; Kosten ansehen <span>→</span></a></aside>
</div>
<p class="ux-test-notice">Testansicht: Eigene Angaben werden nur in diesem Browser-Tab gespeichert und nicht veröffentlicht. <span id="ux-demo-state"></span></p>
<noscript>Bitte JavaScript aktivieren, um zwischen den Ansichten zu wechseln und eigene Angaben auszuwählen.</noscript>
<section id="ueberblick" class="nd-panel" aria-label="Überblick"><h2>Überblick</h2>
<?= ndCard('Auch bekannt als', ndChips(array_column($item['aliases'], 'alias'))) ?>
<div class="ux-overview-links"><a href="#termin"><span>02</span><strong>Den Alltag planen</strong><p>Durchführung, Belastung und Anbieter in deiner Nähe.</p><b>Belastung &amp; Logistik →</b></a><a href="#wirkung"><span>04</span><strong>Erfahrungen einordnen</strong><p>Community-Angaben zu Wirkung und Symptomen.</p><b>Erfahrungen ansehen →</b></a><a href="#alternativen"><span>05</span><strong>Weitere Behandlungen entdecken</strong><p>Dokumentierte Beziehungen und gemeinsame Symptombezüge.</p><b>Behandlungsalternativen →</b></a></div>
</section>
<section id="termin" class="nd-panel" aria-label="Belastung & Logistik" hidden><h2>Belastung &amp; Logistik</h2>
<?= ndReducedChart($item,'setting','Durchführungssetting','rows',$item['durchfuehrungssetting'] ?? '') ?>
<?= ndReducedChart($item,'pem','Crash-/PEM-Risiko','segments') ?>
<?= ndProviderMap($item, 'anbieter') ?>
</section>
<section id="zugang" class="nd-panel" aria-label="Zugang & Kosten" hidden><h2>Zugang &amp; Kosten</h2>
<?= ndReducedChart($item,'access','Zugang – wie erhalte ich die Behandlung?','rows',$item['zugang'] ?? '') ?>
<?php foreach (['unit_cost'=>['Kosten pro Behandlung / Einheit','preis_pro_einheit'], 'total_cost'=>['Gesamtkosten der Behandlung','typische_gesamtkosten']] as $key=>[$title,$field]) {
    $research=[];
    foreach ($item['costs'] as $cost) if (ndHas($cost[$field] ?? null)) $research[] = trim(($cost['land'] ?? '').' · '.($cost['waehrung'] ?? '').' · '.$cost[$field]);
    echo ndReducedChart($item,$key,$title,'cost',implode("\n",$research));
} ?>
</section>
<section id="wirkung" class="nd-panel" aria-label="Erfahrungen, Wirkung & Symptome" hidden><h2>Erfahrungen, Wirkung &amp; Symptome</h2>
<?= ndReducedChart($item,'effect','Gesamtbewertung','effect') ?>
<?= ndReducedChart($item,'gamechanger','Gamechanger?','donut') ?>
<section class="card"><h3>Wobei könnte die Behandlung helfen?</h3><p>Redaktionelle Symptombezüge · Die Zuordnung ist kein Nachweis der Wirksamkeit.</p><div class="ux-symptom-groups">
<?php $groups=[]; foreach ($item['symptoms'] as $symptom) $groups[$symptom['sym_category'] ?: 'Weitere Beschwerden'][]=$symptom['sym_name'];
foreach ($groups as $group=>$names) echo '<section><h4>'.ndEscape($group).'</h4>'.ndChips($names).'<p class="community-label">Community: Noch keine auswertbaren symptombezogenen Veränderungsangaben.</p></section>';
if (!$groups) echo '<p>Noch keine redaktionellen Symptombezüge vorhanden.</p>'; ?>
</div></section></section>
<section id="alternativen" class="nd-panel" aria-label="Behandlungsalternativen" hidden><h2>Behandlungsalternativen</h2><p>Verknüpfte Behandlungen entdecken · keine Empfehlung oder Rangliste.</p><div class="ux-alternatives">
<?php foreach (['verwandte Behandlung'=>'Verwandte Behandlungen','alternative Behandlung'=>'Alternative Behandlungen','alternatives Präparat'=>'Alternative Präparate'] as $type=>$label) {
    $entries='';
    foreach ($item['relations'] as $relation) {
        if ($relation['beziehungstyp'] !== $type || !$relation['resolved_name']) continue;
        $href=$relation['resolved_nd_id'] ? 'treatment_nd_test.php?id='.(int)$relation['resolved_nd_id'] : ($relation['resolved_legacy_id'] ? 'therapie_detail.html?treat_id='.(int)$relation['resolved_legacy_id'] : null);
        if ($href) $entries.='<li><a href="'.ndEscape($href).'">'.ndEscape($relation['resolved_name']).' →</a></li>';
    }
    echo ndCard($label,$entries ? '<ul class="nd-directory">'.$entries.'</ul>' : '<div class="ux-empty-relation"><span aria-hidden="true">↗</span><strong>Noch keine Verknüpfung hinterlegt</strong><p>Für diese Behandlung ist dieser Beziehungstyp bisher nicht dokumentiert.</p></div>');
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
<?php foreach ($aliasPeers as $entry): $peer=$entry['peer']; $href=$peer['resolved_nd_id'] ? 'treatment_nd_test.php?id='.(int)$peer['resolved_nd_id'] : 'therapie_detail.html?treat_id='.(int)$peer['resolved_legacy_id']; ?>
<a href="<?= ndEscape($href) ?>"><strong><?= ndEscape($peer['resolved_name']) ?><span aria-hidden="true">↗</span></strong><small>Gemeinsame Alias-Bezeichnung<?= $peer['resolved_nd_id'] ? '' : ' · bisheriger Katalog' ?></small><?= ndChips(array_unique($entry['aliases'])) ?></a>
<?php endforeach; ?></div></section><?php endif;
$peers=[];
foreach ($item['symptom_peers'] as $peer) { $peers[$peer['treat_nd_id']]['name']=$peer['treatmentname']; $peers[$peer['treat_nd_id']]['symptoms'][]=$peer['sym_name']; }
if ($peers): ?>
<section class="card ux-discovery"><div class="ux-discovery-heading"><div><span class="ux-eyebrow">Navigation über Symptombezüge</span><h3>Über gemeinsame Symptome entdecken</h3></div><span class="ux-count"><?= count($peers) ?> Behandlungen</span></div><p>Diese Behandlungen sind einigen derselben Symptome zugeordnet. Das belegt weder eine vergleichbare Wirkung noch eine Eignung als Ersatz.</p><div class="ux-peer-grid">
<?php foreach ($peers as $peerId=>$peer): ?><a href="treatment_nd_test.php?id=<?= (int)$peerId ?>"><strong><?= ndEscape($peer['name']) ?><span aria-hidden="true">↗</span></strong><small>Gemeinsame Symptombezüge</small><?= ndChips($peer['symptoms']) ?></a><?php endforeach; ?>
</div></section><?php endif; ?>
</section></div></div><?php ndEnd(); ?>

