<?php

require_once __DIR__ . '/_security.php';

function lcnEnvFilePath(): string
{
    $configuredPath = getenv('LCN_ENV_FILE');

    if (is_string($configuredPath) && trim($configuredPath) !== '') {
        return trim($configuredPath);
    }

    return dirname(__DIR__, 2) . '/private/lcn.env';
}

function lcnLoadEnvFile(): void
{
    static $loaded = false;

    if ($loaded) {
        return;
    }

    $path = lcnEnvFilePath();

    if (!is_file($path) || !is_readable($path)) {
        throw new RuntimeException('LCN environment file is missing or unreadable.');
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    if ($lines === false) {
        throw new RuntimeException('LCN environment file could not be read.');
    }

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $separatorPosition = strpos($line, '=');

        if ($separatorPosition === false) {
            continue;
        }

        $key = trim(substr($line, 0, $separatorPosition));
        $value = trim(substr($line, $separatorPosition + 1));

        if ($key === '') {
            continue;
        }

        if (
            (str_starts_with($value, '"') && str_ends_with($value, '"'))
            || (str_starts_with($value, "'") && str_ends_with($value, "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        if (getenv($key) === false) {
            putenv($key . '=' . $value);
        }

        $_ENV[$key] = getenv($key) !== false ? (string)getenv($key) : $value;
    }

    $loaded = true;
}

function lcnEnv(string $key, ?string $default = null): ?string
{
    lcnLoadEnvFile();

    $value = getenv($key);

    if ($value === false || trim((string)$value) === '') {
        return $default;
    }

    return (string)$value;
}

function lcnDatabase(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = lcnEnv('LCN_DB_HOST', '127.0.0.1');
    $port = lcnEnv('LCN_DB_PORT', '3306');
    $database = lcnEnv('LCN_DB_DATABASE');
    $username = lcnEnv('LCN_DB_USERNAME');
    $password = lcnEnv('LCN_DB_PASSWORD', '');

    if ($database === null || $username === null) {
        throw new RuntimeException('LCN database configuration is incomplete.');
    }

    if (in_array(strtolower(trim($database)), ['bookstack_db', 'bookstack', 'bookstackdb'], true)) {
        throw new RuntimeException('Unsafe LCN database configuration rejected.');
    }

    if (!ctype_digit((string)$port) || (int)$port < 1 || (int)$port > 65535) {
        throw new RuntimeException('LCN database port is invalid.');
    }

    $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";

    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => true,
    ]);

    return $pdo;
}
