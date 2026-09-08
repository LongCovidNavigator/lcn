<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LCN – Dummy-Übersicht</title>
    <link rel="stylesheet" href="styles/general.css">
    <link rel="stylesheet" href="styles/navigation.css">
    <link rel="stylesheet" href="styles/footer-style.css">
    <link rel="stylesheet" href="styles/dummy_uebersicht.css?v=1">
    <script src="scripts/access-nav.js?v=2" defer></script>
</head>
<body>
<div id="header-placeholder"></div>
<main class="dummy-index">
    <header><span>Dev-Vergleichsansicht</span><h1>Dummys</h1><p>Bestehende und recherchebasierte Detailseiten direkt nebeneinander öffnen.</p></header>
    <section><h2>Ärzte</h2><div class="dummy-grid">
        <a href="arzt_detail_dummy.php?id=9001&scenario=complete"><strong>Beispiel-Dummy</strong><span>Bestehender fiktiver Vollständigkeits-Dummy</span></a>
        <a href="arzt_detail_dummy.php?id=9002&fixture=stingl&scenario=complete"><strong>Dr. Michael Stingl</strong><span>Recherche v0.5 · aktuelleres Schema</span></a>
        <a href="arzt_detail_dummy.php?id=9003&fixture=kacik&scenario=complete"><strong>Dr. med. Michael Kacik</strong><span>Älterer Durchstich v0.3</span></a>
        <a href="arzt_detail_dummy.php?id=9004&fixture=strasser&scenario=complete"><strong>Dr. med. Maja Strasser</strong><span>Recherche v0.5 · Module 1–5</span></a>
        <a href="arzt_detail_dummy.php?id=9005&fixture=hohberger&scenario=complete"><strong>PD Dr. med. Dr. rer. biol. hum. Bettina Hohberger</strong><span>Recherche v0.5 · vollständiger Durchstich</span></a>
        <a href="arzt_detail_dummy.php?id=9006&fixture=jaeger&scenario=complete"><strong>Dr. med. Beate Roxane Jaeger</strong><span>Recherche v0.5 · vollständiger Durchstich</span></a>
        <a href="arzt_detail_dummy.php?id=9007&fixture=bellmann&scenario=complete"><strong>Dr. med. Judith Bellmann-Strobl</strong><span>Recherche v0.5 · vollständiger Durchstich</span></a>
        <a href="arzt_detail_dummy.php?id=9008&fixture=cyprus&scenario=complete"><strong>Apheresis Center Cyprus</strong><span>Institutionsrecherche v0.5 · vollständiger Durchstich</span></a>
    </div></section>
    <section><h2>Therapien</h2><div class="dummy-grid">
        <a href="treatment_detail_dummy.php?scenario=complete"><strong>LDN · bestehender Dummy</strong><span>Bisherige fiktive Testansicht</span></a>
        <a href="treatment_detail_dummy.php?fixture=ldn-research&scenario=complete"><strong>LDN · Recherche</strong><span>Durchstich vom 26.08.2026</span></a>
        <a href="treatment_detail_dummy.php?fixture=ivabradin&scenario=complete"><strong>Ivabradin</strong><span>Recherche v0.12 · Module 1–7</span></a>
        <a href="treatment_detail_dummy.php?fixture=help-apherese&scenario=complete"><strong>H.E.L.P.-Apherese</strong><span>Recherche v0.12 · Module 1–7</span></a>
        <a href="treatment_detail_dummy.php?fixture=hbot&scenario=complete"><strong>Hyperbare Sauerstofftherapie (HBO)</strong><span>Recherche v0.12 · Module 1–7</span></a>
        <a href="treatment_detail_dummy.php?fixture=mhbot&scenario=complete"><strong>Milde hyperbare Sauerstofftherapie (mHBOT)</strong><span>Recherche v0.12 · Module 1–7</span></a>
        <a href="treatment_detail_dummy.php?fixture=keto-advisor-general&scenario=complete"><strong>Ketogene Ernährung mit Berater</strong><span>Allgemeiner Kontext · Recherche v0.12</span></a>
        <a href="treatment_detail_dummy.php?fixture=keto-advisor-lc&scenario=complete"><strong>Ketogene Ernährung mit Berater</strong><span>Long-COVID-Kontext · Recherche v0.12</span></a>
        <a href="treatment_detail_dummy.php?fixture=keto-self-general&scenario=complete"><strong>Ketogene Ernährung ohne Berater</strong><span>Allgemeiner Kontext · Recherche v0.12</span></a>
        <a href="treatment_detail_dummy.php?fixture=keto-self-lc&scenario=complete"><strong>Ketogene Ernährung ohne Berater</strong><span>Long-COVID-Kontext · Recherche v0.12</span></a>
    </div></section>
</main>
<div id="footer-placeholder"></div>
<script>fetch('components/header.html?v=5').then(r=>r.text()).then(html=>document.getElementById('header-placeholder').innerHTML=html);fetch('components/footer.html').then(r=>r.text()).then(html=>document.getElementById('footer-placeholder').innerHTML=html);</script>
</body></html>
