<?php
require_once __DIR__ . '/_site_auth.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
echo json_encode([
    'ok' => true,
    'role' => lcnCurrentSiteRole(),
    'username' => lcnAuthenticatedWebUser(),
], JSON_UNESCAPED_UNICODE);
