<?php

function lcnDoctorSocialProfiles($profiles): array {
    if (!is_array($profiles) || array_values($profiles) !== $profiles || count($profiles) > 10) {
        throw new InvalidArgumentException('Bitte gib höchstens zehn Social-Media-Profile an.');
    }
    $valid = [];
    foreach ($profiles as $profile) {
        $platform = $profile['platform'] ?? null;
        $url = $profile['url'] ?? null;
        $owner = $profile['owner'] ?? '';
        $label = $profile['label'] ?? '';
        if (!in_array($platform, ['instagram', 'facebook', 'youtube', 'linkedin', 'other'], true)
            || !in_array($owner, ['', 'provider', 'practice'], true)
            || !is_string($label) || mb_strlen($label) > 50 || ($platform === 'other' && trim($label) === '')
            || !is_string($url) || strlen($url) > 500 || !filter_var($url, FILTER_VALIDATE_URL)
            || !in_array(strtolower((string)parse_url($url, PHP_URL_SCHEME)), ['http', 'https'], true)
            || parse_url($url, PHP_URL_USER) !== null) {
            throw new InvalidArgumentException('Bitte prüfe Plattform, Profilname und vollständige http(s)-Adresse.');
        }
        $valid[$url] ??= ['platform' => $platform, 'url' => $url, 'owner' => $owner, 'label' => $platform === 'other' ? trim($label) : ''];
    }
    return array_values($valid);
}

function lcnDoctorSocialProfilesFromPayload(string $payload): array {
    try {
        return lcnDoctorSocialProfiles(json_decode($payload, true)['social_profiles'] ?? []);
    } catch (InvalidArgumentException $error) {
        return [];
    }
}

function lcnApprovedDoctorSocialProfiles(PDO $pdo, int $doctorId): array {
    // Keep approved links available when the original catalog profile was merged.
    $query = $pdo->prepare("
        WITH RECURSIVE doctor_ids (id) AS (
            SELECT CAST(? AS SIGNED)
            UNION DISTINCT
            SELECT m.source_id FROM catalog_merges m JOIN doctor_ids d ON m.target_id=d.id
            WHERE m.entity_type='doctor' AND m.source_id>0
        )
        SELECT s.payload FROM community_submissions s JOIN doctor_ids d ON s.approved_target_id=d.id
        WHERE s.entity_type='doctor' AND s.review_status='approved'
          AND JSON_CONTAINS_PATH(s.payload, 'one', '$.social_profiles')
        ORDER BY s.submission_id
    ");
    $query->execute([$doctorId]);
    $profiles = [];
    foreach ($query->fetchAll(PDO::FETCH_COLUMN) as $payload) {
        foreach (lcnDoctorSocialProfilesFromPayload($payload) as $profile) {
            $profiles[$profile['url']] ??= $profile;
        }
    }
    return array_values($profiles);
}
