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
    <link rel="stylesheet" href="styles/navigation.css">
    <link rel="stylesheet" href="styles/footer-style.css">
    <link rel="stylesheet" href="styles/freigaben.css?v=2">
    <script src="scripts/image-registry.js?v=5"></script>
</head>
<body>
    <div id="header-placeholder"></div>
    <main class="review-shell">
        <a class="review-back" href="index.html">← Zurück zur Beta-Startseite</a>
        <header><span>LCN Administration</span><h1>Prüf- und Freigabeübersicht</h1><p>Automatisch vorsortierte neue Einträge, Ergänzungen, mögliche Dubletten und Auffälligkeiten.</p></header>
        <section id="review-dashboard" class="review-dashboard" aria-label="Übersicht"></section>
        <div class="review-type-filters" id="review-type-filters">
            <button class="is-active" data-type="all">Alle</button><button data-type="doctor">Ärzt:innen & Praxen</button><button data-type="treatment">Behandlungen</button>
        </div>
        <nav id="review-filters">
            <button class="is-active" data-status="all">Übersicht</button>
            <button data-status="pending">Offen</button>
            <button data-status="reviewing">In Prüfung</button>
            <button data-status="approved">Freigegeben</button>
            <button data-status="duplicate">Dubletten</button>
            <button data-status="rejected">Abgelehnt</button>
        </nav>
        <div id="review-message" aria-live="polite"></div>
        <section id="review-list"></section>
    </main>
    <div id="footer-placeholder"></div>
    <script src="scripts/freigaben.js?v=3"></script>
    <script>function toggleMobileMenu(){document.querySelector('.main-nav ul')?.classList.toggle('show');}</script>
</body>
</html>
