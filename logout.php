<?php
require_once __DIR__ . '/api/_site_auth.php';
header('Cache-Control: no-store, private');
$currentUser = lcnAuthenticatedWebUser();
$previousUser = trim((string)($_COOKIE['lcn_switch_from'] ?? ''));
if ($previousUser !== '' && $currentUser !== null && !hash_equals($previousUser, $currentUser)) {
    setcookie('lcn_switch_from', '', time() - 3600, '/', '', !empty($_SERVER['HTTPS']), true);
    header('Location: index.html');
    exit;
}
if ($currentUser !== null) {
    setcookie('lcn_switch_from', $currentUser, ['expires' => time() + 300, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Lax']);
}
http_response_code(401);
header('WWW-Authenticate: Basic realm="Long Covid Navigator - Konto wechseln"');
header('Content-Type: text/html; charset=utf-8');
?><!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Konto wechseln – LCN</title></head>
<body style="max-width:42rem;margin:4rem auto;padding:0 1.5rem;font:16px/1.55 Arial,sans-serif;color:#082f53"><h1>Abmelden / Konto wechseln</h1><p>Gib im Anmeldefenster die Zugangsdaten des anderen Kontos ein. Danach wirst du automatisch zur Startseite weitergeleitet.</p><p>Falls du das Fenster abgebrochen hast, rufe diese Seite erneut auf.</p><p><a href="logout.php">Anmeldefenster erneut öffnen</a> · <a href="index.html">Zurück zur Website</a></p></body></html>
