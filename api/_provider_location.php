<?php
declare(strict_types=1);

/** Preserve free-form provider addresses while extracting a usable place where possible. */
function lcnProviderLocationPayload(array $payload): array
{
    $address = trim((string)($payload['address'] ?? ''));
    if ($address === '') return $payload;
    $city = trim((string)($payload['city'] ?? ''));
    if ($city === '' && preg_match('/\b(\d{4,5})\s+([^,\r\n]+)/u', $address, $match)) {
        $payload['postal_code'] = $payload['postal_code'] ?? $match[1];
        $city = trim($match[2]);
    }
    if ($city === '') {
        foreach (array_reverse(preg_split('/[,\r\n]+/u', $address)) as $part) {
            $part = trim($part);
            if ($part !== '' && !preg_match('/\d|straße|strasse|str\.|weg|platz|allee|gasse|deutschland|österreich|schweiz/iu', $part)) {
                $city = $part;
                break;
            }
        }
    }
    if ($city !== '') $payload['city'] = $city;
    if (empty($payload['street']) && preg_match('/^\s*([^,\r\n]+?)\s+(\d+\s?[a-z]?)\s*(?=[,\r\n]|$)/iu', $address, $match)) {
        $payload['street'] = trim($match[1]);
        $payload['house_number'] = $payload['house_number'] ?? trim($match[2]);
    }
    return $payload;
}
