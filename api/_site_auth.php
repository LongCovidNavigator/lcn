<?php
require_once __DIR__ . '/_lcn_db.php';

function lcnAuthenticatedWebUser(): ?string {
    foreach ([$_SERVER['REMOTE_USER'] ?? null, $_SERVER['PHP_AUTH_USER'] ?? null, $_SERVER['REDIRECT_REMOTE_USER'] ?? null] as $candidate) {
        $user = trim((string)$candidate);
        if ($user !== '') return $user;
    }
    return null;
}

function lcnAdminUsername(): string {
    return trim((string)(lcnEnv('LCN_ADMIN_USERNAME', 'admin') ?? 'admin'));
}

function lcnCurrentSiteRole(): string {
    $remoteAddress = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $host = preg_replace('/:\d+$/', '', $host);
    if (in_array($remoteAddress, ['127.0.0.1', '::1'], true)
        && in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
        return 'admin';
    }
    $user = lcnAuthenticatedWebUser();
    if ($user !== null && hash_equals(lcnAdminUsername(), $user)) return 'admin';
    return $user !== null ? 'tester' : 'guest';
}

function lcnRequireAdminJson(): void {
    if (lcnCurrentSiteRole() === 'admin') return;
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Dieser Bereich ist nur für den Administrator freigegeben.'], JSON_UNESCAPED_UNICODE);
    exit;
}

function lcnRequireAdminPage(): void {
    if (lcnCurrentSiteRole() === 'admin') return;
    http_response_code(403);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="de"><meta charset="utf-8"><title>Kein Zugriff</title><body style="font-family:Arial;padding:3rem"><h1>Kein Zugriff</h1><p>Diese Seite ist ausschließlich für den Administrator freigegeben.</p><p><a href="index.html">Zurück zur Beta-Website</a></p></body></html>';
    exit;
}
