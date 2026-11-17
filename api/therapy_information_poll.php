<?php
require_once __DIR__.'/_voting.php';
require_once __DIR__.'/_doctor_hybrid.php';
require_once __DIR__.'/_vote_abuse.php';
header('Cache-Control: private, no-store');
try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST');
        lcnSendVoteJson(['ok'=>false, 'error'=>'Methode nicht erlaubt.'], 405);
    }
    if ($method === 'POST') lcnRequireVotingRequest();
    $input = $method === 'POST' ? lcnReadJsonBody() : $_GET;
    $id = filter_var($input['treatment_id'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
    if (!$id) throw new InvalidArgumentException('Ungültige Therapie.');
    $question = $input['question'] ?? null;
    if (!in_array($question, ['helpful', 'more'], true)) throw new InvalidArgumentException('Ungültige Frage.');
    $pdo = lcnDoctorDatabase();
    $query = $pdo->prepare('SELECT 1 FROM tbl_treatments_nd WHERE treat_nd_id=?');
    $query->execute([$id]);
    if (!$query->fetchColumn()) throw new InvalidArgumentException('Therapie nicht gefunden.');
    $own = lcnExistingVoterKey();
    if ($method === 'POST') {
        $answer = $input['answer'] ?? null;
        if (!array_key_exists('answer', $input) || !in_array($answer, ['yes', 'no', null], true)) throw new InvalidArgumentException('Ungültige Antwort.');
        $own = lcnVoterKey();
        lcnBeginVoteSecurity($pdo, 'treatment', $id, 'neutral', $own);
        if ($answer === null) {
            $pdo->prepare('DELETE FROM therapy_orientation_poll WHERE treatment_id=? AND question=? AND respondent_key=?')->execute([$id, $question, $own]);
        } else {
            $pdo->prepare('INSERT INTO therapy_orientation_poll(treatment_id,question,respondent_key,answer) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE answer=VALUES(answer)')->execute([$id, $question, $own, $answer]);
        }
    }
    $counts = ['yes'=>0, 'no'=>0];
    $query = $pdo->prepare('SELECT answer,COUNT(*) total FROM therapy_orientation_poll WHERE treatment_id=? AND question=? GROUP BY answer');
    $query->execute([$id, $question]);
    foreach ($query as $row) if (isset($counts[$row['answer']])) $counts[$row['answer']] = (int)$row['total'];
    $answer = null;
    if ($own) {
        $query = $pdo->prepare('SELECT answer FROM therapy_orientation_poll WHERE treatment_id=? AND question=? AND respondent_key=?');
        $query->execute([$id, $question, $own]);
        $answer = $query->fetchColumn() ?: null;
    }
    lcnSendVoteJson(['ok'=>true, 'counts'=>$counts, 'own'=>$answer]);
} catch (InvalidArgumentException $error) {
    lcnSendVoteJson(['ok'=>false, 'error'=>$error->getMessage()], 400);
} catch (Throwable $error) {
    lcnLogApiError('therapy_information_poll', $error);
    lcnSendVoteJson(['ok'=>false, 'error'=>'Die Abstimmung ist gerade nicht verfügbar. Bitte versuche es später erneut.'], 500);
}
