<?php
require_once __DIR__ . '/api/_site_auth.php';
lcnRequireAdminPage();
header('Cache-Control: no-store, private');
?><!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Freigaben – LCN</title>
    <link rel="stylesheet" href="styles/general.css">
    <link rel="stylesheet" href="styles/navigation.css?v=header-dummy-20261024">
    <link rel="stylesheet" href="styles/footer-style.css?v=b4b1163611">
    <link rel="stylesheet" href="styles/freigaben.css?v=undo-review-20261108">
    <script src="scripts/image-registry.js?v=shared-count-pins-20261105"></script>
    <script src="scripts/access-nav.js?v=copy-fragment-20261116" defer></script>
<script src="scripts/feedback_context.js?v=responsive-20261107" defer data-lcn-feedback-loader></script><script src="scripts/scroll_restore.js?v=admin-ready-20261108" defer></script></head>
<body>
    <div id="header-placeholder"></div>
    <main class="review-shell">
        <a class="review-back" href="index.html">← Zurück zur Beta-Startseite</a>
        <header>
            <span>LCN Administration</span>
            <h1>Freigaben</h1>
            <p>Prüfe Vorschläge zu Behandler:innen, Therapien und Symptomen und entscheide über die Freigabe.</p>
            <a class="review-feedback-link" href="feedback_admin.php">Feedback verwalten →</a>
        </header>
        <section aria-labelledby="review-overview-heading">
            <h2 class="review-section-title" id="review-overview-heading">Übersicht</h2>
            <div id="review-dashboard" class="review-dashboard"></div>
        </section>
        <section class="review-filter-panel" aria-labelledby="review-filter-heading">
            <h2 class="review-section-title" id="review-filter-heading">Anträge filtern</h2>
            <div class="review-toolbar">
                <label>Art des Antrags
                    <select id="review-kind">
                        <option value="all">Alle Antragsarten</option>
                        <option value="new">Neue Einträge ohne Dublettenhinweis</option>
                        <option value="new_duplicate">Neue Einträge mit Dublettenverdacht</option>
                        <option value="change">Angaben ändern</option>
                        <option value="medication">Medikamenten-Einordnung</option>
                        <option value="link">Verknüpfungen ergänzen</option>
                        <option value="remove">Verknüpfungen entfernen</option>
                        <option value="symptom">Symptome ergänzen</option>
                        <optgroup label="Dublettenprüfung">
                            <option value="duplicate_suspect">Alle mit Dublettenverdacht</option>
                            <option value="duplicate_confirmed">Als Dublette markiert</option>
                        </optgroup>
                    </select>
                </label>
                <label>Suche<input id="review-search" type="search" placeholder="Name, Ort, Zuordnung oder Antragsnummer"></label>
                <span id="review-count" role="status"></span>
            </div>
        </section>
        <div id="review-message" aria-live="polite"></div>
        <section id="review-list" data-scroll-restore-pending></section>
    </main>
    <div id="footer-placeholder"></div>
    <script src="scripts/freigaben.js?v=undo-review-20261108"></script>
    <script>function toggleMobileMenu(){document.querySelector('.main-nav ul')?.classList.toggle('show');}</script>
</body>
</html>
