<?php
declare(strict_types=1);

function lcnSendSearchResults(array $payload): void
{
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if (!is_string($json) || strlen($json) < 4096 || !function_exists('gzencode') || ini_get('zlib.output_compression')) {
        echo $json;
        return;
    }

    header('Vary: Accept-Encoding', false);
    $quality = [];
    foreach (explode(',', strtolower($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '')) as $entry) {
        [$encoding, $weight] = array_pad(explode(';', $entry, 2), 2, 'q=1');
        $encoding = trim($encoding);
        if (in_array($encoding, ['gzip', '*'], true) &&
            preg_match('/^q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/D', trim($weight), $match)) {
            $quality[$encoding] = (float)$match[1];
        }
    }

    if (($quality['gzip'] ?? $quality['*'] ?? 0) > 0) {
        $compressed = gzencode($json, 4);
        if ($compressed !== false && strlen($compressed) < strlen($json)) {
            header('Content-Encoding: gzip');
            echo $compressed;
            return;
        }
    }
    echo $json;
}
