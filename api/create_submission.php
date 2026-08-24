<?php
require_once __DIR__ . '/_search_normalization.php';
require_once __DIR__ . '/_voting.php';

lcnRequireVotingRequest();

function submissionString(array $input, string $key, int $max): string {
    $value = trim((string)($input[$key] ?? ''));
    if (mb_strlen($value) > $max) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Eine Angabe ist zu lang.'], 422);
    }
    return $value;
}

function buildSubmissionTriage(PDO $pdo,string $type,string $name,string $website,?int $existingTargetId,array $input): array {
    if($existingTargetId!==null)return ['kind'=>'change','status'=>'needs_review','score'=>10,'duplicate_id'=>$existingTargetId,'reasons'=>['Gezielte Ergänzung oder Änderung eines bestehenden Eintrags.']];
    $reasons=[];$score=0;$duplicateId=null;
    if($type==='doctor'){$stmt=$pdo->prepare("SELECT dr_id FROM tbl_drs_03 WHERE ".lcnNormalizedSearchSql('TRIM(dr_display_name)')."=:name OR (:website<>'' AND LOWER(TRIM(COALESCE(dr_website,'')))=LOWER(TRIM(:website))) LIMIT 1");}
    else{$stmt=$pdo->prepare("SELECT treat_id FROM tbl_treatments_03 WHERE ".lcnNormalizedSearchSql('TRIM(behandlung)')."=:name OR (:website<>'' AND LOWER(TRIM(COALESCE(wiki_url_path,'')))=LOWER(TRIM(:website))) LIMIT 1");}
    $stmt->execute([':name'=>lcnNormalizeSearchTerm($name),':website'=>$website]);$match=$stmt->fetchColumn();
    if($match!==false){$duplicateId=(int)$match;$score=95;$reasons[]='Name oder Website stimmt mit einem bestehenden Eintrag überein.';}
    if($duplicateId===null&&mb_strlen($name)>=5){
        $candidateSql=$type==='doctor'?'SELECT dr_id AS id,dr_display_name AS label FROM tbl_drs_03':'SELECT treat_id AS id,behandlung AS label FROM tbl_treatments_03';
        $needle=(string)preg_replace('/[^\pL\pN]+/u','',lcnNormalizeSearchTerm($name));$bestPercent=0.0;$bestId=null;
        foreach($pdo->query($candidateSql) as $candidate){$candidateName=(string)preg_replace('/[^\pL\pN]+/u','',lcnNormalizeSearchTerm((string)$candidate['label']));if($candidateName==='')continue;similar_text($needle,$candidateName,$percent);if($percent>$bestPercent){$bestPercent=$percent;$bestId=(int)$candidate['id'];}}
        if($bestPercent>=88){$duplicateId=$bestId;$score=max($score,75);$reasons[]='Der Name ist einem bestehenden Eintrag sehr ähnlich ('.round($bestPercent).' %).';}
    }
    $pending=$pdo->prepare("SELECT submission_id FROM community_submissions WHERE entity_type=:type AND review_status IN ('pending','reviewing') AND LOWER(TRIM(name))=LOWER(TRIM(:name)) ORDER BY created_at DESC LIMIT 1");$pending->execute([':type'=>$type,':name'=>$name]);
    if($pending->fetchColumn()){$score=max($score,80);$reasons[]='Ein gleichnamiger Vorschlag wartet bereits auf Prüfung.';}
    $contactCount=count(array_filter([$website,$input['email']??'',$input['phone']??'',$input['city']??'',$input['source_url']??'']));
    if($contactCount===0){$score=max($score,25);$reasons[]='Nur ein Name, keine Quelle oder Kontaktdaten angegeben.';}
    if(mb_strlen($name)<4){$score=max($score,60);$reasons[]='Der Name ist ungewöhnlich kurz.';}
    $status=$score>=75?'possible_duplicate':($score>=50?'suspicious':($score>0?'needs_review':'clear'));
    return ['kind'=>'new','status'=>$status,'score'=>$score,'duplicate_id'=>$duplicateId,'reasons'=>$reasons];
}

try {
    $raw = (string)file_get_contents('php://input');
    if (strlen($raw) > 65536) lcnSendVoteJson(['ok' => false, 'error' => 'Die Anfrage ist zu groß.'], 413);
    $input = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($input)) throw new InvalidArgumentException('Ungültige Anfrage.');
    if (trim((string)($input['company'] ?? '')) !== '') lcnSendVoteJson(['ok' => true, 'submission_id' => 0]);

    $type = (string)($input['type'] ?? '');
    $name = submissionString($input, 'name', 180);
    $website = submissionString($input, 'website', 500);
    $email = submissionString($input, 'email', 254);
    $phone = submissionString($input, 'phone', 60);
    $city = submissionString($input, 'city', 120);
    $experience = (string)($input['experience'] ?? '');
    $existingTargetId = filter_var($input['existing_target_id'] ?? null, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
    $existingTargetId = $existingTargetId === false ? null : $existingTargetId;

    if (!in_array($type, ['doctor', 'treatment'], true) || $name === '') {
        lcnSendVoteJson(['ok' => false, 'error' => 'Bitte gib mindestens einen Namen an.'], 422);
    }
    if ($website !== '' && (filter_var($website, FILTER_VALIDATE_URL) === false || !in_array(strtolower((string)parse_url($website, PHP_URL_SCHEME)), ['http', 'https'], true))) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Bitte gib eine vollständige http(s)-Adresse an.'], 422);
    }
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Die E-Mail-Adresse ist ungültig.'], 422);
    }
    if ($experience !== '' && !in_array($experience, ['pro', 'neutral', 'contra'], true)) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Die Bewertung ist ungültig.'], 422);
    }
    if (($input['confirmation'] ?? '') !== 'on') {
        lcnSendVoteJson(['ok' => false, 'error' => 'Bitte bestätige die Richtigkeit deiner Angaben.'], 422);
    }

    $allowed = ['type','existing_target_id','name','website','title','firstname','lastname','organization','provider_type','treatment_category','aliases','email','phone','street','house_number','postal_code','city','country','lat','lng','source_url','known_providers','features','insurance','specialty_ids','treatment_ids','doctor_ids','indications','mechanism','effort','cost','speed','crash_risk','offerings','experience','experience_note','relationship','review_note',
        'billing_model','statutory_seat','cost_initial','cost_followup','cost_typical_total','first_appointment_wait','first_appointment_wait_unit','waiting_list','availability_updated_at',
        'initial_onsite','initial_video','initial_phone','followup_onsite','followup_video','followup_phone','home_visits','onsite_wait',
        'considers_pem','breaks_possible','appointment_adaptable','quiet_waiting_area','waiting_lying_down','wheelchair_accessible','step_free_access','lying_down_possible','companion_possible',
        'takes_symptoms_seriously','takes_time','listens','explains_clearly','respectful_doctor','thorough_work','considers_previous_findings','shared_decision_making',
        'felt_comfortable','respectful_practice','gender_sensitive_experience','lgbtq_experience','additional_specializations',
        'attestations','social_medical_support','followup_care','regular_prescriptions','off_label_therapy','individual_therapy_trials',
        'diagnoses_mecfs','diagnoses_long_covid','diagnoses_pots','diagnoses_mcas','diagnoses_vaccine_injury','information_source'];
    $payload = array_intersect_key($input, array_flip($allowed));
    $pdo = lcnDatabase();
    $voterKey = lcnVoterKey();

    $recent = $pdo->prepare('SELECT COUNT(*) FROM community_submissions WHERE submitter_key = :key AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)');
    $recent->execute([':key' => $voterKey]);
    if ((int)$recent->fetchColumn() >= 10) lcnSendVoteJson(['ok' => false, 'error' => 'Zu viele Vorschläge in kurzer Zeit. Bitte versuche es später erneut.'], 429);

    if ($existingTargetId !== null) {
        $table=$type==='doctor'?'tbl_drs_03':'tbl_treatments_03';$column=$type==='doctor'?'dr_id':'treat_id';
        $exists=$pdo->prepare("SELECT 1 FROM {$table} WHERE {$column}=:id");$exists->execute([':id'=>$existingTargetId]);
        if(!$exists->fetchColumn())lcnSendVoteJson(['ok'=>false,'error'=>'Der ausgewählte bestehende Eintrag wurde nicht gefunden.'],422);
    }
    $triage=buildSubmissionTriage($pdo,$type,$name,$website,$existingTargetId,$input);
    $stmt = $pdo->prepare('INSERT INTO community_submissions (entity_type,existing_target_id,submission_kind,name,website,email,phone,city,experience,payload,submitter_key,triage_status,triage_score,duplicate_target_id,triage_reasons) VALUES (:type,:existing,:kind,:name,:website,:email,:phone,:city,:experience,:payload,:key,:triage_status,:score,:duplicate_id,:reasons)');
    $stmt->execute([':type'=>$type,':existing'=>$existingTargetId,':kind'=>$triage['kind'],':name'=>$name,':website'=>$website,':email'=>$email?:null,':phone'=>$phone?:null,':city'=>$city?:null,':experience'=>$experience?:null,':payload'=>json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),':key'=>$voterKey,':triage_status'=>$triage['status'],':score'=>$triage['score'],':duplicate_id'=>$triage['duplicate_id'],':reasons'=>json_encode($triage['reasons'],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
    $submissionId=(int)$pdo->lastInsertId();
    if($experience!==''){$initialVote=$pdo->prepare('INSERT INTO community_submission_votes(submission_id,voter_key,vote) VALUES(:id,:key,:vote)');$initialVote->execute([':id'=>$submissionId,':key'=>$voterKey,':vote'=>$experience]);}
    lcnSendVoteJson(['ok'=>true,'submission_id'=>$submissionId,'submission_kind'=>$triage['kind'],'triage_status'=>$triage['status']],201);
} catch (Throwable $error) {
    lcnLogApiError('create_submission', $error);
    lcnSendVoteJson(['ok' => false, 'error' => 'Der Vorschlag konnte derzeit nicht gespeichert werden.'], 500);
}
