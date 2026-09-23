<?php
require_once __DIR__ . '/_doctor_community_answers.php';
header('Cache-Control: private, no-store');
lcnRequireVotingRequest();
try {
    $body = lcnReadJsonBody();
    $id = $body['dr_id'] ?? null;
    if (!is_int($id) || !in_array($id, LCN_PRIORITY_DOCTOR_IDS, true)) lcnSendVoteJson(['ok' => false, 'error' => 'Behandler nicht gefunden.'], 404);
    $action = $body['action'] ?? 'answer';
    if (!in_array($action, ['answer', 'reset', 'clear'], true)) lcnSendVoteJson(['ok' => false, 'error' => 'Ungültige Aktion.'], 400);
    $key = $body['question'] ?? null;
    $value = $body['value'] ?? null;
    if ($action === 'answer' && (!is_string($key) || !isset(lcnDoctorCommunityQuestions()[$key]) || !is_int($value) || $value < 1 || $value > count(lcnDoctorCommunityQuestions()[$key]['labels']))) lcnSendVoteJson(['ok' => false, 'error' => 'Ungültige Antwort.'], 400);
    if ($action === 'clear' && (!is_string($key) || !isset(lcnDoctorCommunityQuestions()[$key]))) lcnSendVoteJson(['ok'=>false,'error'=>'Ungültige Frage.'],400);
    $pdo = lcnDoctorDatabase();
    $respondent = lcnVoterKey();
    if ($action === 'reset') {
        $query = $pdo->prepare('DELETE FROM doctor_community_answers WHERE dr_id = ? AND respondent_key = ?');
        $query->execute([$id, $respondent]);
    } elseif ($action === 'clear') {
        $definition = lcnDoctorCommunityQuestions()[$key];
        $query = $pdo->prepare('DELETE FROM doctor_community_answers WHERE dr_id=? AND respondent_key=? AND question_key=? AND context_key=?');
        $query->execute([$id,$respondent,$definition['question'],$definition['context']]);
    } else {
        lcnSaveDoctorAnswer($pdo, $id, $respondent, $key, $value);
    }
    lcnSendVoteJson(['ok' => true, 'own_answers' => lcnDoctorOwnAnswers($pdo, $id, $respondent), 'community' => lcnDoctorCommunity($pdo, $id)]);
} catch (Throwable $error) {
    lcnLogApiError('doctor_community_answer', $error);
    lcnSendVoteJson(['ok' => false, 'error' => 'Speichern konnte nicht bestätigt werden. Bitte erneut versuchen.'], 500);
}
