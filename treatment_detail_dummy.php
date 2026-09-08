<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LCN – Testansicht Therapie-Detail</title>
    <link rel="stylesheet" href="styles/general.css">
    <link rel="stylesheet" href="styles/navigation.css">
    <link rel="stylesheet" href="styles/footer-style.css">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <link rel="stylesheet" href="styles/therapie_detail.css?v=23">
    <link rel="stylesheet" href="styles/treatment_detail_dummy.css?v=7">
    <script src="scripts/access-nav.js?v=2" defer></script>
</head>
<body class="tdd-page">
    <div id="header-placeholder"></div>

    <main class="tdd-shell">
        <a class="tdd-back" href="dummy_uebersicht.php">← Zurück zur Dummy-Übersicht</a>

        <section class="tdd-testbar" aria-label="Testansicht auswählen">
            <div>
                <span class="tdd-eyebrow">Isolierter UI-Prototyp</span>
                <strong>Datenumfang vergleichen</strong>
            </div>
            <nav class="tdd-scenarios">
                <a data-scenario-link="complete" href="?scenario=complete">Vollständig</a>
                <a data-scenario-link="research" href="?scenario=research">Nur Recherche</a>
                <a data-scenario-link="voting" href="?scenario=voting">Nur Abstimmung</a>
                <a data-scenario-link="hybrid" href="?scenario=hybrid">Nur Hybrid</a>
            </nav>
        </section>

        <div id="tdd-status" class="tdd-status">Testdaten werden geladen …</div>
        <article id="tdd-content" class="tdd-content" hidden></article>
    </main>

    <div id="footer-placeholder"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="scripts/treatment_detail_dummy.js?v=11"></script>
    <script>
        fetch('components/header.html?v=4').then(r => r.text()).then(html => document.getElementById('header-placeholder').innerHTML = html);
        fetch('components/footer.html').then(r => r.text()).then(html => document.getElementById('footer-placeholder').innerHTML = html);
    </script>
</body>
</html>
