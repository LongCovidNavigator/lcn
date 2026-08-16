<?php

require_once dirname(__DIR__) . '/api/_vote_monitoring.php';

if (PHP_SAPI === 'cli') {
    http_response_code(404);
    exit;
}

$expectedUser = lcnEnv('LCN_CRON_USERNAME');
$expectedPasswordHash = lcnEnv('LCN_CRON_PASSWORD_HASH');
$providedUser = (string)($_SERVER['PHP_AUTH_USER'] ?? '');
$providedPassword = (string)($_SERVER['PHP_AUTH_PW'] ?? '');

if ($expectedUser === null || $expectedPasswordHash === null
    || !hash_equals($expectedUser, $providedUser)
    || !password_verify($providedPassword, $expectedPasswordHash)) {
    header('WWW-Authenticate: Basic realm="LCN internal cron"');
    http_response_code(401);
    exit;
}

try {
    $result = lcnRunVoteMonitoring(false);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => true,
        'run_id' => $result['run_id'],
        'delivery_status' => $result['delivery_status'],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    lcnLogApiError('vote_monitoring_http', $error);
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Monitoring failed.']);
}
