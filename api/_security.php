<?php

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');

function lcnLogApiError(string $endpoint, Throwable $error): void
{
    error_log($endpoint . ' failed: ' . $error->getMessage());
}
