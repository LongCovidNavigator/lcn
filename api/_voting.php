<?php

require_once __DIR__ . '/_lcn_db.php';

const LCN_VOTER_COOKIE = 'lcn_voter';
const LCN_VOTER_COOKIE_LIFETIME = 31536000;

function lcnRequireVotingRequest(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        lcnSendVoteJson(['ok' => false, 'error' => 'Method not allowed.'], 405);
    }

    $contentType = strtolower(trim(explode(';', (string)($_SERVER['CONTENT_TYPE'] ?? ''))[0]));

    if ($contentType !== 'application/json') {
        lcnSendVoteJson(['ok' => false, 'error' => 'Content-Type must be application/json.'], 415);
    }

    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));

    if ($host === '' || preg_match('/\A[a-z0-9.-]+(?::[0-9]{1,5})?\z/i', $host) !== 1) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Request origin could not be verified.'], 403);
    }

    $expectedOrigin = (lcnIsHttpsRequest() ? 'https://' : 'http://') . $host;
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    $referer = trim((string)($_SERVER['HTTP_REFERER'] ?? ''));
    $candidate = $origin !== '' ? $origin : $referer;
    $candidateParts = $candidate !== '' ? parse_url($candidate) : false;
    $candidateOrigin = is_array($candidateParts)
        && isset($candidateParts['scheme'], $candidateParts['host'])
        ? strtolower($candidateParts['scheme']) . '://' . strtolower($candidateParts['host'])
            . (isset($candidateParts['port']) ? ':' . (int)$candidateParts['port'] : '')
        : '';

    if (!hash_equals(strtolower($expectedOrigin), $candidateOrigin)) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Cross-origin voting is not allowed.'], 403);
    }
}

function lcnIsHttpsRequest(): bool
{
    return (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off')
        || (string)($_SERVER['SERVER_PORT'] ?? '') === '443';
}

function lcnVotingToken(): string
{
    $existingToken = (string)($_COOKIE[LCN_VOTER_COOKIE] ?? '');

    if (preg_match('/\A[a-f0-9]{64}\z/', $existingToken) === 1) {
        return $existingToken;
    }

    $token = bin2hex(random_bytes(32));
    $isHttps = lcnIsHttpsRequest();

    if (!setcookie(LCN_VOTER_COOKIE, $token, [
        'expires' => time() + LCN_VOTER_COOKIE_LIFETIME,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ])) {
        throw new RuntimeException('Voting cookie could not be set.');
    }

    $_COOKIE[LCN_VOTER_COOKIE] = $token;

    return $token;
}

function lcnExistingVoterKey(): ?string
{
    $token = (string)($_COOKIE[LCN_VOTER_COOKIE] ?? '');

    if (preg_match('/\A[a-f0-9]{64}\z/', $token) !== 1) {
        return null;
    }

    $secret = lcnEnv('LCN_VOTER_SECRET');

    if ($secret === null || strlen($secret) < 32) {
        throw new RuntimeException('LCN voter secret is missing or too short.');
    }

    return hash_hmac('sha256', $token, $secret);
}

function lcnAttachOwnVotes(PDO $pdo, array &$items, string $targetType): void
{
    $configuration = [
        'doctor' => ['table' => 'doctor_votes', 'column' => 'dr_id'],
        'treatment' => ['table' => 'treatment_votes', 'column' => 'treat_id'],
    ][$targetType] ?? null;

    if ($configuration === null) {
        throw new InvalidArgumentException('Unsupported voting target type.');
    }

    $targetColumn = $configuration['column'];
    $targetIds = [];

    foreach ($items as &$item) {
        $item['own_vote'] = null;
        $targetId = (int)($item[$targetColumn] ?? 0);

        if ($targetId > 0) {
            $targetIds[$targetId] = $targetId;
        }
    }
    unset($item);

    $voterKey = lcnExistingVoterKey();

    if ($voterKey === null || $targetIds === []) {
        return;
    }

    $placeholders = [];
    $parameters = [':voter_key' => $voterKey];

    foreach (array_values($targetIds) as $index => $targetId) {
        $placeholder = ':target_' . $index;
        $placeholders[] = $placeholder;
        $parameters[$placeholder] = $targetId;
    }

    $statement = $pdo->prepare(sprintf(
        'SELECT %1$s AS target_id, vote FROM %2$s WHERE voter_key = :voter_key AND %1$s IN (%3$s)',
        $targetColumn,
        $configuration['table'],
        implode(', ', $placeholders)
    ));
    $statement->execute($parameters);
    $votesByTarget = [];

    foreach ($statement->fetchAll() as $row) {
        $votesByTarget[(int)$row['target_id']] = (string)$row['vote'];
    }

    foreach ($items as &$item) {
        $item['own_vote'] = $votesByTarget[(int)($item[$targetColumn] ?? 0)] ?? null;
    }
    unset($item);
}

function lcnVoterKey(): string
{
    $secret = lcnEnv('LCN_VOTER_SECRET');

    if ($secret === null || strlen($secret) < 32) {
        throw new RuntimeException('LCN voter secret is missing or too short.');
    }

    return hash_hmac('sha256', lcnVotingToken(), $secret);
}

function lcnSendVoteJson(array $payload, int $statusCode = 200): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function lcnReadJsonBody(): array
{
    $rawBody = (string)file_get_contents('php://input');

    if (strlen($rawBody) > 4096) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Request body is too large.'], 413);
    }

    $decoded = json_decode($rawBody, true);

    return is_array($decoded) ? $decoded : [];
}
