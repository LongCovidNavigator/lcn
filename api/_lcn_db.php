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

        $environmentValue = getenv($key);

        // An empty process variable is equivalent to "not configured". This
        // matters with Apache/XAMPP, which may expose a declared but empty
        // variable and would otherwise mask the value from the protected file.
        // A non-empty deployment variable still takes precedence.
        if ($environmentValue === false || trim((string)$environmentValue) === '') {
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

function lcnDatabaseProfile(): ?string
{
    $profile = strtoupper(trim((string)lcnEnv('LCN_DB_ACTIVE_PROFILE', '')));

    if ($profile === '') {
        return null;
    }

    $allowedProfiles = [
        'LOCAL_MAIN',
        'LOCAL_TEST',
        'LOCAL_DUMMY',
        'ONLINE_TEST',
        'ONLINE_DUMMY',
    ];

    if (!in_array($profile, $allowedProfiles, true)) {
        throw new RuntimeException(
            'Invalid LCN database profile: ' . $profile
        );
    }

    return $profile;
}

function lcnDatabaseConfig(): array
{
    $profile = lcnDatabaseProfile();

    if ($profile === null) {
        $host = lcnEnv('LCN_DB_HOST', 'localhost');
        $database = lcnEnv('LCN_DB_DATABASE');
        $username = lcnEnv('LCN_DB_USERNAME');
        $password = lcnEnv('LCN_DB_PASSWORD', '');
        $configurationName = 'legacy';
    } else {
        $prefix = 'LCN_DB_' . $profile . '_';
        $host = lcnEnv($prefix . 'HOST');
        $database = lcnEnv($prefix . 'DATABASE');
        $username = lcnEnv($prefix . 'USERNAME', lcnEnv($prefix . 'USER'));
        $password = lcnEnv($prefix . 'PASSWORD', '');
        $configurationName = $profile;
    }

    $port = lcnEnv('LCN_DB_PORT', '3306');

    if (
        $host === null ||
        $database === null ||
        $username === null
    ) {
        throw new RuntimeException(
            'LCN database configuration is incomplete for profile: ' . $configurationName
        );
    }

    if (in_array(strtolower(trim($database)), ['bookstack_db', 'bookstack', 'bookstackdb'], true)) {
        throw new RuntimeException('Unsafe LCN database configuration rejected.');
    }

    if (!ctype_digit((string)$port) || (int)$port < 1 || (int)$port > 65535) {
        throw new RuntimeException('LCN database port is invalid.');
    }

    return [
        'profile' => $configurationName,
        'host' => $host,
        'port' => $port,
        'database' => $database,
        'username' => $username,
        'password' => $password,
    ];
}

function lcnDatabase(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = lcnDatabaseConfig();

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $config['host'],
        $config['port'],
        $config['database']
    );

    $pdo = new PDO(
        $dsn,
        $config['username'],
        $config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => true,
        ]
    );

    return $pdo;
}
