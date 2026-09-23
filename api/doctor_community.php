<?php
require_once __DIR__ . '/_doctor_community_answers.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        header('Allow: GET'); http_response_code(405);
        echo json_encode(['ok' => false, 'message' => 'Method not allowed.']); exit;
    }
    $id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id || !in_array($id, LCN_PRIORITY_DOCTOR_IDS, true)) {
        http_response_code(404); echo json_encode(['ok' => false, 'message' => 'Behandler nicht gefunden.']); exit;
    }
    echo json_encode(['ok' => true, 'dr_id' => $id, 'own_answers' => lcnDoctorOwnAnswers(lcnDoctorDatabase(), $id, lcnExistingVoterKey()), 'community' => lcnDoctorCommunity(lcnDoctorDatabase(), $id)], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    lcnLogApiError('doctor_community', $error);
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Community-Daten konnten nicht geladen werden.']);
}
