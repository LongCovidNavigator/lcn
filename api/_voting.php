<?php

require_once __DIR__ . '/_lcn_db.php';

const LCN_VOTER_COOKIE = 'lcn_voter';
const LCN_VOTER_COOKIE_LIFETIME = 31536000;

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
    $decoded = json_decode((string)file_get_contents('php://input'), true);

    return is_array($decoded) ? $decoded : [];
}
