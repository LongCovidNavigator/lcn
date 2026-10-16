<?php
declare(strict_types=1);
require_once __DIR__ . '/api/_treatments_nd.php';
require_once __DIR__ . '/api/_treatment_id_migration.php';
if (isset($_GET['nd_id']) && !isset($_GET['treatment_id'])) {
    $previous = filter_var($_GET['nd_id'], FILTER_VALIDATE_INT);
    $target = LCN_PREVIOUS_ND_IDS[$previous] ?? null;
    if (!$target) {
        require_once __DIR__ . '/components/treatments_nd_view.php';
        http_response_code(404); ndStart('Therapie nicht gefunden', true, true);
        echo '<section class="card" role="alert"><h1>Therapie nicht gefunden</h1><p>Dieser Link führt zu keiner verfügbaren Therapie.</p><a href="therapien_karte.html">Zur Therapiesuche</a></section>';
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
    if (!$id) { http_response_code(400); $error = 'Bitte wähle eine Therapie aus der Suche aus.'; }
    else {
    $item = lcnNdDetail(lcnTreatmentsNdDatabase(), $id);
    if (!$item) { http_response_code(404); $error = 'Diese Therapie wurde nicht gefunden.'; }
    }
} catch (Throwable $e) { lcnLogApiError('therapie_detail', $e); http_response_code(503); $error = 'Die Therapie konnte gerade nicht geladen werden.'; }
ndStart($item['treatmentname'] ?? 'Therapie', true, true);
if ($error) { echo '<section class="card" role="alert"><h1>Therapie nicht verfügbar</h1><p>'.ndEscape($error).'</p><a href="therapien_karte.html">Zur Therapiesuche</a></section>'; ndEnd(); return; }
$views = ['ueberblick'=>'Überblick','termin'=>'Welche Belastungshürden gibt es bei der Therapie?','zugang'=>'Wie zugänglich ist die Therapie?','wirkung'=>'Welche Erfahrungen gibt es?','alternativen'=>'Therapiealternativen','dashboard'=>'Dashboard'];
?>
<div class="detail-layout ux-detail" data-home-delivery="<?= lcnNdCanTreatAtHome($item) ? '1' : '0' ?>" data-independent-at-home="<?= lcnNdIndependentAtHome($item) ? '1' : '0' ?>" data-treatment-id="<?= (int)$id ?>" data-previous-treatment-id="<?= (int)array_search((int)$id, LCN_PREVIOUS_ND_IDS, true) ?>">
<nav class="side-nav" aria-label="Ansichten der Therapie"><div class="nav-items">
<?php $n=0; foreach ($views as $view=>$label): ?><a href="#<?= $view ?>" data-view="<?= $view ?>"><span class="nav-number"><?= ++$n ?></span><span><strong><?= str_replace("Therapiealternativen", "Therapie&shy;alternativen", ndEscape($label)) ?></strong></span></a><?php endforeach; ?>
</div></nav>
<div id="view-content" tabindex="-1">

<noscript>Bitte JavaScript aktivieren, um zwischen den Ansichten zu wechseln und eigene Angaben auszuwählen.</noscript>
<section id="ueberblick" class="nd-panel" aria-label="Überblick">
<?php if (($item['review_status'] ?? '') === 'altbestand_ungeprueft'): ?><p class="ux-test-notice">Übernommener Bestand · Angaben noch nicht geprüft.</p><?php endif; ?>
<section class="card ux-overview-frame"><div class="ux-overview-heading"><h2>Überblick</h2><span class="ux-heading-info"><button type="button" aria-label="Information zum Überblick" aria-describedby="therapy-overview-help">ⓘ</button><p id="therapy-overview-help" role="tooltip">Hier findest du die Kategorie der Therapie, die Gesamtauswertung. Die einzelnen Bewertungen und ihre Gewichtung kannst du im Dashboard ansehen.</p></span></div>
<div class="ux-overview-summary">
<aside class="card ux-treatment-identity"><div class="overview-icon ux-treatment-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M3 12h4l2-4 4 8 2-4h6"/></svg></div>
<h3><?= ndEscape($item['treatmentname']) ?></h3>
<?php if (ndHas($item['typ'])): ?><div class="ux-identity-field"><span>Kategorie</span><strong><?= ndEscape($item['typ']) ?></strong></div><?php endif; ?>
<?php if (ndHas($item['unterkategorie'])): ?><div class="ux-identity-field"><span>Unterkategorie</span><strong><?= ndEscape($item['unterkategorie']) ?></strong></div><?php endif; ?>

<a class="ux-identity-experiences" href="#wirkung" data-community-summary>Community-Bewertungen ansehen →</a>
</aside>
<div data-treatment-score="overview"></div>
</div></section>

</section>
<section id="termin" class="nd-panel" aria-label="Welche Belastungshürden gibt es bei der Therapie?" hidden>
<?= ndReducedChart($item,'setting','Durchführungssetting','rows') ?>
<?= ndReducedChart($item,'pem','Crash-/PEM-Risiko','segments') ?>
<?= ndProviderMap($item, 'anbieter') ?>
</section>
<section id="zugang" class="nd-panel" aria-label="Zugang & Kosten" hidden>
<?= ndReducedChart($item,'access','Zugang','rows') ?>
<?= ndReducedChart($item,'unit_cost','Kosten pro Therapie / Einheit','cost') ?>
<?= ndReducedChart($item,'total_cost','Gesamtkosten der Therapie','cost') ?>
</section>
<section id="wirkung" class="nd-panel" aria-label="Erfahrungen, Wirkung & Symptome" hidden>
<?= ndReducedChart($item,'effect','Community-Bewertung','effect') ?>
<?= ndReducedChart($item,'gamechanger','Gamechanger','donut') ?>
<section class="card ux-symptom-help" aria-labelledby="symptom-help-heading">
<h3 id="symptom-help-heading">Wobei hat dir die Therapie geholfen?</h3>
<p>Klicke die Symptome an, bei denen dir die Therapie geholfen hat. Erneutes Anklicken nimmt deine Stimme zurück.</p>
<ol class="ux-symptom-ranking" data-symptom-ranking aria-label="Symptome nach hilfreichen Erfahrungen"></ol>
<div class="ux-symptom-picker" data-symptom-combobox><label for="symptom-search">Weiteres Symptom auswählen</label><div class="ux-symptom-input-wrap"><input id="symptom-search" type="text" role="combobox" data-symptom-search placeholder="Symptom auswählen oder eintippen …" autocomplete="off" aria-autocomplete="list" aria-expanded="false" aria-controls="symptom-picker"><button type="button" data-symptom-toggle aria-label="Symptomliste öffnen" aria-controls="symptom-picker" aria-expanded="false">⌄</button></div><div id="symptom-picker" role="listbox" aria-label="Weitere Symptome" data-symptom-picker hidden></div></div>
</section></section>
<section id="alternativen" class="nd-panel" aria-label="Therapiealternativen" hidden><p>Verknüpfte Therapien entdecken · keine Empfehlung oder Rangliste.</p><div class="ux-alternatives">
<?php
foreach (['verwandte Behandlung'=>'Verwandte Therapien','alternative Behandlung'=>'Alternative Therapien','alternatives Präparat'=>'Alternative Präparate'] as $type=>$label) {
    $entries='';
    foreach ($item['relations'] as $relation) {
        if ($relation['beziehungstyp'] !== $type || !$relation['resolved_name']) continue;
        $href=$relation['resolved_nd_id'] ? 'therapie_detail.php?treatment_id='.(int)$relation['resolved_nd_id'] : ($relation['resolved_legacy_id'] ? 'therapie_detail.html?treat_id='.(int)$relation['resolved_legacy_id'] : null);
        if ($href) $entries.='<li><a href="'.ndEscape($href).'">'.ndEscape($relation['resolved_name']).' →</a></li>';
    }
    $content = $entries ? '<ul class="nd-directory">'.$entries.'</ul>' : '<div class="ux-empty-relation"><span aria-hidden="true">↗</span><strong>Noch keine Verknüpfung hinterlegt</strong><p>Für diese Therapie ist dieser Beziehungstyp bisher nicht dokumentiert.</p></div>';
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
<section class="card ux-discovery ux-alias-discovery"><div class="ux-discovery-heading"><div><span class="ux-eyebrow">Vorhandene Verknüpfungen</span><h3>Über gemeinsame Bezeichnungen verbunden</h3></div><span class="ux-count">Alias-System</span></div><p>Diese Einträge teilen eine Alias-Bezeichnung mit dieser Therapie. Eine gemeinsame Bezeichnung kann auch auf eine Kombination verweisen und belegt keine Austauschbarkeit.</p><div class="ux-peer-grid">
<?php foreach ($aliasPeers as $entry): $peer=$entry['peer']; $href=$peer['resolved_nd_id'] ? 'therapie_detail.php?treatment_id='.(int)$peer['resolved_nd_id'] : 'therapie_detail.html?treat_id='.(int)$peer['resolved_legacy_id']; ?>
<a href="<?= ndEscape($href) ?>"><strong><?= ndEscape($peer['resolved_name']) ?><span aria-hidden="true">↗</span></strong><small>Gemeinsame Alias-Bezeichnung<?= $peer['resolved_nd_id'] ? '' : ' · bisheriger Katalog' ?></small><?= ndChips(array_unique($entry['aliases'])) ?></a>
<?php endforeach; ?></div></section><?php endif;
$peers=[];
foreach ($item['symptom_peers'] as $peer) { $peers[$peer['treat_nd_id']]['name']=$peer['treatmentname']; $peers[$peer['treat_nd_id']]['symptoms'][]=$peer['sym_name']; }
if ($peers): ?>
<section class="card ux-discovery"><div class="ux-discovery-heading"><div><span class="ux-eyebrow">Navigation über Symptombezüge</span><h3>Über gemeinsame Symptome entdecken</h3></div><span class="ux-count"><?= count($peers) ?> Therapien</span></div><p>Diese Therapien sind einigen derselben Symptome zugeordnet. Das belegt weder eine vergleichbare Wirkung noch eine Eignung als Ersatz.</p><div class="ux-peer-grid">
<?php foreach ($peers as $peerId=>$peer): ?><a href="therapie_detail.php?treatment_id=<?= (int)$peerId ?>"><strong><?= ndEscape($peer['name']) ?><span aria-hidden="true">↗</span></strong><small>Gemeinsame Symptombezüge</small><?= ndChips($peer['symptoms']) ?></a><?php endforeach; ?>
</div></section><?php endif; ?>
</section><section id="dashboard" class="nd-panel" aria-label="Dashboard" hidden><div data-treatment-score="full"></div><div class="ux-dashboard-grid" data-treatment-dashboard></div></section></div></div><?php ndEnd(); ?>

