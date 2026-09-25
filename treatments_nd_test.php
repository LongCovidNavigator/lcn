<?php
declare(strict_types=1);
require_once __DIR__ . '/api/_treatments_nd.php';
require_once __DIR__ . '/components/treatments_nd_view.php';
$search = is_string($_GET['q'] ?? '') ? mb_substr(trim($_GET['q'] ?? ''), 0, 200) : '';
$error = false;
try { $items = lcnNdSearch(lcnTreatmentsNdDatabase(), $search); }
catch (Throwable $e) { lcnLogApiError('treatments_nd_test', $e); http_response_code(503); $error = true; $items = []; }
ndStart('Behandlungen entdecken');
?>
<header class="profile"><div class="avatar" aria-hidden="true">LCN</div><div class="profile-copy"><p class="eyebrow">Behandlungen entdecken</p><h1>Neue Perspektiven auf Behandlungen</h1><p>Recherchierte Informationen zu Anwendung, Zugang und Kosten – übersichtlich an einem Ort.</p></div></header>
<form class="card nd-search" method="get" action="treatments_nd_test.php"><label for="nd-search">Behandlungsname oder anderer Name (Alias)</label><div><input id="nd-search" name="q" type="search" maxlength="200" value="<?= ndEscape($search) ?>" placeholder="Zum Beispiel LDN oder Pacing"><button type="submit">Suchen</button><?php if ($search !== ''): ?><a href="treatments_nd_test.php">Zurücksetzen</a><?php endif; ?></div></form>
<?php if ($error): ?><p role="alert" class="card">Die Behandlungen konnten gerade nicht geladen werden. Bitte versuche es später erneut.</p>
<?php else: ?><p class="nd-result-count" role="status"><?= count($items) ?> Behandlungen<?= $search !== '' ? ' für „' . ndEscape($search) . '“' : ' in der Testansicht' ?></p>
<?php if (!$items): ?><p class="card">Keine passende Behandlung gefunden. Versuche einen anderen Namen.</p><?php endif; ?>
<div class="nd-results"><?php foreach ($items as $item): ?><article class="card nd-result">
<?= ndChips([$item['typ'], $item['unterkategorie']]) ?>
<h2><a href="treatment_nd_test.php?id=<?= (int)$item['treat_nd_id'] ?>"><?= ndEscape($item['treatmentname']) ?></a></h2>
<?php if (ndHas($item['beschreibung'])): ?><p class="nd-excerpt"><?= ndEscape($item['beschreibung']) ?></p><?php endif; ?>
<?= ndFields($item, ['zugang' => 'Zugang', 'durchfuehrungssetting' => 'Durchführung']) ?>
<a class="nd-open" href="treatment_nd_test.php?id=<?= (int)$item['treat_nd_id'] ?>">Behandlung ansehen <span aria-hidden="true">→</span></a>
</article><?php endforeach; ?></div><?php endif; ndEnd(); ?>
