<?php
declare(strict_types=1);

function ndEscape($value): string { return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function ndHas($value): bool { return is_bool($value) || ($value !== null && trim((string)$value) !== ''); }
function ndText($value): string { return ndEscape(is_bool($value) ? ($value ? 'Ja' : 'Nein') : $value); }
function ndFields(array $data, array $labels): string
{
    $html = '';
    foreach ($labels as $key => $label) {
        if (ndHas($data[$key] ?? null)) $html .= '<div><dt>' . ndEscape($label) . '</dt><dd>' . ndText($data[$key]) . (isset($data['field_sources']) && function_exists('ndFieldEvidence') ? ndFieldEvidence($data, $key) : '') . '</dd></div>';
    }
    return $html === '' ? '' : '<dl class="nd-facts">' . $html . '</dl>';
}
function ndCard(string $title, string $content, string $id = ''): string
{
    return $content === '' ? '' : '<section class="card"' . ($id ? ' id="' . ndEscape($id) . '"' : '') . '><h3>' . ndEscape($title) . '</h3>' . $content . '</section>';
}
function ndChips(array $values): string
{
    $values = array_values(array_filter($values, 'ndHas'));
    return $values ? '<div class="nd-chips">' . implode('', array_map(fn($v) => '<span>' . ndText($v) . '</span>', $values)) . '</div>' : '';
}
function ndSource($url, string $label = 'Quelle ansehen'): string
{
    if (!is_string($url) || !filter_var($url, FILTER_VALIDATE_URL) || !in_array(strtolower((string)parse_url($url, PHP_URL_SCHEME)), ['http', 'https'], true)) return '';
    return '<a href="' . ndEscape($url) . '" target="_blank" rel="noopener noreferrer">' . ndEscape($label) . ' ↗</a>';
}
function ndStart(string $title, bool $detail = false, bool $reduced = false): void
{
    ?><!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title><?= ndEscape($title) ?> · LCN Testansicht</title>
<link rel="stylesheet" href="styles/general.css"><link rel="stylesheet" href="styles/navigation.css"><link rel="stylesheet" href="styles/footer-style.css">
<link rel="stylesheet" href="styles/arzt_detail_konzept.css?v=45"><link rel="stylesheet" href="styles/top_recommendation_map.css"><link rel="stylesheet" href="styles/treatments_nd.css?v=14">
<link rel="stylesheet" href="styles/treatments_nd_provider_beta.css?v=1">
<script src="scripts/access-nav.js?v=2" defer></script><script src="scripts/image-registry.js?v=5" defer></script><script src="scripts/treatments_nd.js?v=3" defer></script>
<?php if ($reduced): ?><link rel="stylesheet" href="styles/treatments_nd_reduced.css?v=2"><script src="scripts/treatments_nd_reduced.js?v=2" defer></script>
<?php else: ?><script src="scripts/treatments_nd_inputs.js?v=2" defer></script><script src="scripts/treatments_nd_demo.js?v=7" defer></script><script src="scripts/treatments_nd_dashboard.js?v=3" defer></script><?php endif; ?>
<script src="scripts/treatments_nd_map.js?v=4" defer></script>
</head><body class="nd-page<?= $detail ? ' nd-detail compact-doctor-header' : '' ?><?= $reduced ? ' ux-page' : '' ?>"><div id="header-placeholder"><?php if ($reduced): ?>
<header class="ux-site-header"><a class="ux-brand" href="index.html"><span>LCN</span><strong>Long Covid Navigator</strong></a><nav aria-label="Hauptnavigation"><a href="treatments_nd_test.php" aria-current="page">Treatments</a><a href="aerzte_karte.html">Behandler</a><a href="index.html">Über LCN</a></nav><div class="ux-header-tools"><span>Testansicht</span><button type="button" id="nd-demo-header-toggle" aria-pressed="false">Dummydaten: aus</button></div></header>
<?php elseif ($detail): ?>
<header class="profile"><div class="detail-brand-group"><a class="detail-brand" href="index.html"><img data-lcn-image="brand-logo" alt=""><span>LCN</span></a><a class="detail-back-link" href="treatments_nd_test.php">← <span class="detail-back-label">Behandlungs-Suche</span></a></div><div class="profile-copy"><h1><?= ndEscape($title) ?></h1><p>Treatment-Testansicht · <button type="button" id="nd-demo-header-toggle" aria-pressed="false">Dummydaten laden …</button></p></div><button class="detail-menu-toggle" type="button" aria-label="Hauptnavigation öffnen" aria-expanded="false" aria-controls="nd-main-menu">☰</button></header>
<div id="nd-main-menu" hidden><?php readfile(__DIR__ . '/header.html'); ?></div>
<?php else: readfile(__DIR__ . '/header.html'); endif; ?></div>
<main class="page-shell nd-shell"><nav class="nd-breadcrumb" aria-label="Brotkrumennavigation"><a href="index.html">Startseite</a><span aria-hidden="true">/</span><a href="treatments_nd_test.php">Behandlungen · Testansicht</a></nav>
<div class="nd-test-note"><strong>Neue Treatment-Testansicht</strong><span>Redaktionelle Daten · Prototyp im Testbetrieb</span></div>
<?php
}
function ndEnd(): void
{
    ?></main><div id="footer-placeholder"><?php readfile(__DIR__ . '/footer.html'); ?></div></body></html><?php
}
