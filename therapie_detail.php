<?php
declare(strict_types=1);
require_once __DIR__ . '/api/_treatments_nd.php';
require_once __DIR__ . '/api/_treatment_discovery.php';
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
require_once __DIR__ . '/components/treatment_relationship_stages.php';
require_once __DIR__ . '/components/treatment_combinations.php';
require_once __DIR__ . '/components/treatments_nd_map.php';
$id = filter_var($_GET['treatment_id'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
$legacyId = filter_var($_GET['treat_id'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
$item = null; $error = null;
try {
    if($id){$merged=lcnMergedCatalogId(lcnTreatmentsNdDatabase(),'treatment',(int)$id);if($merged!==(int)$id){$params=$_GET;$params['treatment_id']=$merged;header('Location: therapie_detail.php?'.http_build_query($params),true,302);exit;}}
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
<?php if (($item['review_status'] ?? '') === 'pending_group'): ?><p class="ux-test-notice" role="status">Community-Vorschlag · Prüfung ausstehend</p><?php endif; ?>

<noscript>Bitte JavaScript aktivieren, um zwischen den Ansichten zu wechseln und eigene Angaben auszuwählen.</noscript>
<section id="ueberblick" class="nd-panel" aria-label="Überblick">
<?php if (($item['review_status'] ?? '') === 'altbestand_ungeprueft'): ?><p class="ux-test-notice">Übernommener Bestand · Angaben noch nicht geprüft.</p><?php endif; ?>
<section class="card ux-overview-frame"><div class="ux-overview-heading"><h2>Überblick</h2><span class="ux-heading-info"><button type="button" aria-label="Information zum Überblick" aria-describedby="therapy-overview-help">ⓘ</button><p id="therapy-overview-help" role="tooltip">Wie ist die Therapie eingeordnet, und wie schneidet sie im Vergleich ab? Hier findest du ihre Kategorisierung und den Vergleich mit anderen Therapien.</p></span></div>
<div class="ux-overview-summary">
<aside class="card ux-treatment-identity"><div class="overview-icon ux-treatment-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M3 12h4l2-4 4 8 2-4h6"/></svg></div>
<h3><?= ndEscape($item['treatmentname']) ?></h3>
<div class="ux-identity-fields">
<?php if (ndHas($item['typ'])): ?><div class="ux-identity-field ux-identity-category-field"><span>Kategorie</span><strong><?= ndEscape($item['typ']) ?></strong></div><?php endif; ?>
<?php if (ndHas($item['unterkategorie'])): ?><div class="ux-identity-field ux-identity-subcategory-field"><span>Unterkategorie</span><strong><?= ndEscape($item['unterkategorie']) ?></strong></div><?php endif; ?>
</div>

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
<h3 id="symptom-help-heading">Symptome</h3>
<div class="ux-symptom-grid"><ol class="ux-symptom-ranking" data-symptom-ranking aria-label="Symptome nach hilfreichen Erfahrungen"></ol>
<div class="ux-symptom-picker" data-symptom-combobox><label for="symptom-search">Weiteres Symptom auswählen</label><div class="ux-symptom-input-wrap"><input id="symptom-search" type="text" role="combobox" data-symptom-search placeholder="＋ Weiteres Symptom hinzufügen …" autocomplete="off" aria-autocomplete="list" aria-expanded="false" aria-controls="symptom-picker"></div><div id="symptom-picker" role="listbox" aria-label="Weitere Symptome" data-symptom-picker hidden></div></div></div>
</section></section>
<section id="alternativen" class="nd-panel" aria-label="Therapiealternativen" hidden>
<section class="card ux-discovery ux-alternative-section"><h3>Alternative Therapien <span class="ux-heading-info"><button type="button" aria-label="Information zu alternativen Therapien" aria-describedby="therapy-alternatives-help">ⓘ</button><p id="therapy-alternatives-help" role="tooltip">Welche anderen Behandlungen kommen für einen ähnlichen Einsatz infrage? Hier sammelt die Community mögliche Alternativen zu dieser Therapie. Du kannst weitere Optionen ergänzen. Ein Eintrag bedeutet nicht, dass die Behandlungen gleich wirksam oder für jede Person austauschbar sind. Noch ungeprüfte Vorschläge sind gekennzeichnet.</p></span></h3>
<div class="ux-alternative-strip" role="group" aria-label="Aktuelle Therapie und Alternativen">
<article class="ux-alternative-tile ux-alternative-current"><small>Aktuelle Therapie</small><strong><?= ndEscape($item['treatmentname']) ?></strong>
<?php if(ndHas($item['typ'])): ?><span class="ux-alternative-category"><?= ndEscape($item['typ']) ?></span><?php endif; ?>
<?php if(ndHas($item['unterkategorie'])): ?><span class="ux-alternative-subcategory"><?= ndEscape($item['unterkategorie']) ?></span><?php endif; ?>
</article>
<div class="ux-alternative-options" role="region" aria-label="Alternativen – horizontal scrollbar" tabindex="0">
<?php $seen=[]; $relationCount=0; foreach ($item['relations'] as $relation):
if (!$relation['resolved_name']) continue;
$href=$relation['resolved_nd_id'] ? 'therapie_detail.php?treatment_id='.(int)$relation['resolved_nd_id'].'#alternativen' : ($relation['resolved_legacy_id'] ? 'therapie_detail.html?treat_id='.(int)$relation['resolved_legacy_id'] : null);
$key=$href ?? $relation['resolved_name']; if(isset($seen[$key]))continue; $seen[$key]=true; $relationCount++;
?><article class="ux-alternative-tile ux-feedback-relation">
<small class="ux-alternative-role">Alternative Therapie</small>
<?php if($href): ?><a class="ux-alternative-name" href="<?= ndEscape($href) ?>"><?= ndEscape($relation['resolved_name']) ?></a><?php else: ?><strong class="ux-alternative-name"><?= ndEscape($relation['resolved_name']) ?></strong><?php endif; ?>
<div class="ux-alternative-categories"><?php if(ndHas($relation['resolved_category'] ?? null)): ?><span class="ux-alternative-category"><?= ndEscape($relation['resolved_category']) ?></span><?php endif; ?>
<?php if(ndHas($relation['resolved_subcategory'] ?? null)): ?><span class="ux-alternative-subcategory"><?= ndEscape($relation['resolved_subcategory']) ?></span><?php endif; ?></div>
<?php $relationStatement='„'.$relation['resolved_name'].'“ ist als alternative Therapie zu „'.$item['treatmentname'].'“ eingetragen.'; ?>
<div class="ux-alternative-feedback"><span data-treatment-relation-feedback="tr:<?= (int)$relation['relation_id'] ?>" data-feedback-statement="<?= ndEscape($relationStatement) ?>" data-feedback-standard="1"></span></div></article>
<?php endforeach; ?>
<button type="button" class="ux-alternative-tile ux-alternative-add" data-treatment-relation-add data-kind="alternative"><span aria-hidden="true">＋</span><span>Weitere Therapie hinzufügen</span></button>
</div></div>
</section>
<?php
$graph=lcnTreatmentDiscoveryGraph(lcnTreatmentsNdDatabase());
echo ndRenderRelationshipStages($graph,(int)$id);
echo ndRenderTreatmentCombinations($graph,(int)$id);
?>
<p data-treatment-relation-status role="status"></p>
</section><section id="dashboard" class="nd-panel" aria-label="Dashboard" hidden><div data-treatment-score="full"></div><div class="ux-dashboard-grid" data-treatment-dashboard></div></section></div></div><?php ndEnd(); ?>

