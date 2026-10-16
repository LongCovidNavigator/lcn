<?php
require_once __DIR__ . '/_doctor_community.php';
require_once __DIR__ . '/_voting.php';
require_once __DIR__ . '/_vote_abuse.php';

function lcnDoctorOwnAnswers(PDO $pdo, int $doctorId, ?string $respondent): object
{
    $answers = [];
    if ($respondent !== null) {
        $query = $pdo->prepare('SELECT question_key, context_key, option_value FROM doctor_community_answers WHERE dr_id = ? AND respondent_key = ?');
        $query->execute([$doctorId, $respondent]);
        foreach ($query as $row) foreach (lcnDoctorCommunityQuestions() as $key => $definition) {
            if ($row['question_key'] === $definition['question'] && $row['context_key'] === $definition['context']) $answers[$key] = (int)$row['option_value'];
        }
    }
    return (object)$answers;
}

function lcnSaveDoctorAnswer(PDO $pdo, int $doctorId, string $respondent, string $key, int $value): void
{
    $definition = lcnDoctorCommunityQuestions()[$key] ?? null;
    if (!lcnDoctorExists($doctorId) || !$definition || $value < 1 || $value > count($definition['labels'])) throw new InvalidArgumentException('Ungültige Antwort.');
    $query = $pdo->prepare('INSERT INTO doctor_community_answers (dr_id, respondent_key, question_key, context_key, option_value) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE question_key=VALUES(question_key),context_key=VALUES(context_key),option_value = VALUES(option_value)');
    $query->execute([$doctorId, $respondent, $definition['question'], $definition['context'], $value]);
}

function lcnMoveDoctorCostContext(PDO $pdo,int $id,string $respondent,string $key): void {
 $definition=lcnDoctorCommunityQuestions()[$key]??null;if(!$definition||$definition['question']!=='costs_total_v2')throw new InvalidArgumentException('Ungültiger Versicherungskontext.');
 $own=!$pdo->inTransaction();if($own)$pdo->beginTransaction();
 try{$query=$pdo->prepare("SELECT option_value,question_key FROM doctor_community_answers WHERE dr_id=? AND respondent_key=? AND question_key IN ('costs','costs_total_v2') FOR UPDATE");$query->execute([$id,$respondent]);$row=$query->fetch();if($row){if($row['question_key']==='costs'&&(int)$row['option_value']>2)throw new InvalidArgumentException('Bitte die bisherigen ungenauen Kosten erneut einordnen.');lcnSaveDoctorAnswer($pdo,$id,$respondent,$key,(int)$row['option_value']);}if($own)$pdo->commit();}catch(Throwable $e){if($own)$pdo->rollBack();throw $e;}
}
