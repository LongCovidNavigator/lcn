<?php
declare(strict_types=1);

require_once __DIR__.'/api/_symptom_catalog.php';
require_once __DIR__.'/api/_treatment_symptom_help.php';
require_once __DIR__.'/api/_doctor_symptom_help.php';

header('Cache-Control: private, no-store');
lcnRequireAdminPage();

function symptomDetailEscape(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$showTherapies = ($_GET['view'] ?? '') === 'therapien';
$symptom = null;
$linked = $available = $providers = $symptomProviders = $providerLocations = [];
$error = '';
try {
    if (!$id) {
        throw new InvalidArgumentException('Bitte wähle ein Symptom aus der Übersicht.');
    }
    $pdo = lcnDatabase();
    $symptom = symRecord($pdo, $id);
    lcnVotingToken();
    if ($showTherapies) {
        foreach (lcnTreatmentsForSymptom($pdo, $id) as $treatment) {
            if ($treatment['linked']) {
                $linked[(int)$treatment['treat_nd_id']] = $treatment;
            } else {
                $available[] = $treatment;
            }
        }
    }
    if (!$showTherapies) {
        $matches = lcnDirectSymptomProviders($pdo, [$id]);
        $symptomProviders = $matches[$id] ?? [];
        $providerLocations = lcnSymptomProviderLocations($pdo, $matches);
    } elseif ($linked) {
        $ids = array_keys($linked);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $rows = lcnNdRows($pdo, "SELECT c.treat_id,d.dr_id,d.dr_display_name
            FROM v_lcn_provider_treatments c JOIN v_lcn_doctors d ON d.dr_id=c.dr_id
            WHERE c.treat_id IN ($placeholders)
            ORDER BY c.treat_id,c.sort_order,d.dr_display_name,d.dr_id", $ids);
        foreach ($rows as $row) {
            $providers[(int)$row['treat_id']] ??= $row;
        }
    }
} catch (InvalidArgumentException $e) {
    http_response_code($id ? 404 : 400);
    $error = $e->getMessage();
} catch (Throwable $e) {
    http_response_code(503);
    lcnLogApiError('symptom_detail', $e);
    $error = 'Die Symptomdetails können gerade nicht geladen werden.';
}
$title = symptomDetailEscape($symptom['sym_name'] ?? 'Symptomdetails');
?>
<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title><?= $title ?> – LCN</title>
    <link rel="stylesheet" href="styles/general.css">
    <link rel="stylesheet" href="styles/navigation.css">
    <link rel="stylesheet" href="styles/feedback.css">
    <link rel="stylesheet" href="styles/public_detail_theme.css?v=8f1296b5fe">
    <link rel="stylesheet" href="styles/footer-style.css">
    <link rel="stylesheet" href="styles/symptoms.css">
    <link rel="stylesheet" href="assets/vendor/leaflet/leaflet.css">
    <link rel="stylesheet" href="styles/symptom_detail.css?v=direct-providers">
    <script src="scripts/access-nav.js?v=local-only-20261107" defer></script>
    <script src="assets/vendor/leaflet/leaflet.js" defer></script>
    <script src="scripts/image-registry.js" defer></script>
    <script src="scripts/map_viewport.js?v=direct-providers" defer></script>
    <script src="scripts/online_access.js?v=symptom-detail" defer></script>
    <script src="scripts/symptom_locations.js?v=direct-providers" defer></script>
    <script src="scripts/symptom_detail.js?v=direct-providers" defer></script>
</head>
<body class="lcn-public-page sym-page symptom-detail">
<div id="header-placeholder"><?php readfile(__DIR__.'/components/header.html'); ?></div>
<main class="fb-shell" data-symptom-id="<?= (int)$id ?>">
    <header class="fb-hero">
        <a href="symptome.php">← Symptome im Überblick</a>
        <h1><?= $title ?></h1>
        <?php if ($symptom): ?>
            <p>Kategorie <span class="fb-tag"><?= symptomDetailEscape(trim($symptom['sym_category']) ?: 'Noch ohne Kategorie') ?></span></p>
        <?php endif; ?>
    </header>
    <?php if ($error): ?>
        <p class="fb-error" role="alert"><?= symptomDetailEscape($error) ?></p>
    <?php else: ?>
        <nav class="doctor-view-switch symptom-detail-nav" aria-label="Ergebnisart">
            <a class="doctor-view-switch-button<?= !$showTherapies ? ' is-active' : '' ?>" href="?id=<?= $id ?>"<?= !$showTherapies ? ' aria-current="page"' : '' ?>>Behandler</a>
            <a class="doctor-view-switch-button<?= $showTherapies ? ' is-active' : '' ?>" href="?id=<?= $id ?>&amp;view=therapien"<?= $showTherapies ? ' aria-current="page"' : '' ?>>Therapien</a>
        </nav>
        <?php if (!$showTherapies): ?>
        <section class="fb-panel" aria-labelledby="symptom-providers-heading">
            <h2 id="symptom-providers-heading">Behandler (<?= count($symptomProviders) ?>)</h2>
            <?php if ($symptomProviders): ?>
                <script type="application/json" id="symptom-provider-locations"><?= json_encode((object)$providerLocations, JSON_HEX_TAG | JSON_INVALID_UTF8_SUBSTITUTE) ?></script>
                <div id="symptom-provider-map" role="region" aria-label="Standorte direkt verknüpfter Behandler" hidden></div>
                <p id="symptom-provider-map-status" role="status"></p>
                <table id="symptom-provider-table" class="symptom-treatment-table" aria-labelledby="symptom-providers-heading">
                    <thead><tr>
                        <th scope="col">Behandler</th>
                        <th scope="col">Hilfreiche Erfahrungen</th>
                        <th scope="col">Entfernung / Ort</th>
                    </tr></thead>
                    <tbody>
                    <?php foreach ($symptomProviders as $provider): $providerId = $provider['dr_id']; ?>
                        <?php $place = $providerLocations[$providerId][0] ?? []; ?>
                        <tr data-symptom-provider="<?= $providerId ?>">
                            <th scope="row">
                                <a href="arzt_detail.html?id=<?= $providerId ?>"><?= symptomDetailEscape($provider['dr_display_name']) ?></a>
                                <span class="lcn-online-badge" data-sym-online="<?= $providerId ?>" hidden>Erst- und Folgetermin online</span>
                            </th>
                            <td><?= $provider['experience_count'] ?></td>
                            <td data-symptom-provider-location><?= symptomDetailEscape(trim(($place['loc_plz'] ?? '').' '.($place['loc_city'] ?? '')) ?: '–') ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <p>Zu diesem Symptom sind noch keine Behandler verknüpft.</p>
            <?php endif; ?>
        </section>
        <?php else: ?>
        <section class="fb-panel" aria-labelledby="symptom-map-heading">
            <h2 id="symptom-map-heading">Behandlungen auf der Karte</h2>
            <?php if ($available): ?>
                <form id="symptom-link-form" class="fb-toolbar" hidden>
                    <label>Weitere Behandlung verknüpfen
                        <select name="treatment_id" required>
                            <option value="">Behandlung auswählen</option>
                            <?php foreach ($available as $treatment): ?>
                                <option value="<?= (int)$treatment['treat_nd_id'] ?>"><?= symptomDetailEscape($treatment['treatmentname']) ?><?= $treatment['typ'] ? ' · '.symptomDetailEscape($treatment['typ']) : '' ?></option>
                            <?php endforeach; ?>
                        </select>
                    </label>
                    <button class="fb-button" type="submit">Verknüpfen</button>
                </form>
                <p id="symptom-link-error" class="fb-error" role="alert" hidden></p>
            <?php endif; ?>
            <p id="symptom-map-status" role="status"><?= $linked ? 'Standorte werden geladen …' : 'Für dieses Symptom sind noch keine Behandlungen verknüpft.' ?></p>
            <div id="symptom-map" aria-label="Karte der Behandlungsstandorte" hidden></div>
        </section>
        <section class="fb-panel" aria-labelledby="symptom-list-heading">
            <h2 id="symptom-list-heading">Verknüpfte Behandlungen (<?= count($linked) ?>)</h2>
            <p class="fb-muted">Die Zuordnungen dienen der Orientierung. Ob eine Behandlung zu deinen Beschwerden passt, kannst du mit einer behandelnden Person klären.</p>
            <?php if ($linked): ?>
                <div class="doctor-view-switch" role="group" aria-label="Ansicht der verknüpften Behandlungen" data-treatment-view-switch hidden>
                    <button type="button" class="doctor-view-switch-button is-active" data-treatment-view="cards" aria-pressed="true" aria-controls="symptom-treatment-cards">Kacheln</button>
                    <button type="button" class="doctor-view-switch-button" data-treatment-view="table" aria-pressed="false" aria-controls="symptom-treatment-table">Tabelle</button>
                </div>
                <ul id="symptom-treatment-cards" class="symptom-treatment-list">
                    <?php foreach ($linked as $treatmentId => $treatment): $provider = $providers[$treatmentId] ?? null; ?>
                        <li class="fb-card" data-treatment-id="<?= $treatmentId ?>">
                            <div class="fb-card-content">
                                <h3><a href="therapie_detail.php?treatment_id=<?= $treatmentId ?>" data-therapy-link><?= symptomDetailEscape($treatment['treatmentname']) ?></a><span class="lcn-online-badge" data-therapy-online hidden>Online-Behandlung</span></h3>
                                <p class="fb-muted symptom-provider-label">Behandler</p>
                                <p data-provider>
                                    <?php if ($provider): ?>
                                        <a href="arzt_detail.html?id=<?= (int)$provider['dr_id'] ?>" data-provider-id="<?= (int)$provider['dr_id'] ?>"><?= symptomDetailEscape($provider['dr_display_name']) ?></a><span class="lcn-online-badge" data-provider-online hidden>Erst- und Folgetermin online</span>
                                    <?php else: ?>
                                        Kein Behandler hinterlegt.
                                    <?php endif; ?>
                                </p>
                                <p class="fb-muted" data-provider-location hidden></p>
                            </div>
                        </li>
                    <?php endforeach; ?>
                </ul>
                <table id="symptom-treatment-table" class="symptom-treatment-table" aria-labelledby="symptom-list-heading" hidden>
                    <thead>
                        <tr>
                            <th scope="col">Behandlung</th>
                            <th scope="col">Behandler</th>
                            <th scope="col">Entfernung</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            <?php else: ?>
                <p>Noch keine Behandlungen verknüpft.</p>
            <?php endif; ?>
        </section>
        <?php endif; ?>
    <?php endif; ?>
</main>
<div id="footer-placeholder"><?php readfile(__DIR__.'/components/footer.html'); ?></div>
</body>
</html>
