<?php
require_once __DIR__ . '/_submission_treatments.php';
require_once __DIR__ . '/_voting.php';
require_once __DIR__ . '/_site_auth.php';

function lcnRequireReviewAccess(): void {
    lcnRequireAdminJson();
}

function lcnSubmissionPayload(array $row): array {
    $payload = json_decode((string)($row['payload'] ?? '{}'), true);
    return is_array($payload) ? $payload : [];
}

function lcnNullable(array $payload, string $key): ?string {
    $value = trim((string)($payload[$key] ?? ''));
    return $value === '' ? null : $value;
}

function lcnMigrateCommunitySubmissionVotes(PDO $pdo, int $submissionId, string $entityType, int $targetId, ?string $treatmentName = null): void {
    $votes=$pdo->prepare('SELECT voter_key,vote FROM community_submission_votes WHERE submission_id=:id AND migrated_target_id IS NULL FOR UPDATE');
    $votes->execute([':id'=>$submissionId]);
    foreach($votes as $row){
        if($entityType==='doctor'){
            $insert=$pdo->prepare("INSERT IGNORE INTO doctor_community_answers(dr_id,respondent_key,question_key,context_key,option_value) VALUES(?,?,'effect','',?)");
            $insert->execute([$targetId,$row['voter_key'],['contra'=>1,'neutral'=>2,'pro'=>3][$row['vote']]]);
        }else{
            $insert=$pdo->prepare("INSERT IGNORE INTO tbl_treatment_community_answers_nd(treat_nd_id,respondent_key,question_key,context_key,answer_value) VALUES(?,?,'effect','',?)");
            $insert->execute([$targetId,$row['voter_key'],['contra'=>'Verschlechterung','neutral'=>'Keine Veränderung','pro'=>'Verbesserung'][$row['vote']]]);
        }
    }
    $mark=$pdo->prepare('UPDATE community_submission_votes SET migrated_entity_type=:type,migrated_target_id=:target,migrated_at=NOW() WHERE submission_id=:id AND migrated_target_id IS NULL');
    $mark->execute([':type'=>$entityType,':target'=>$targetId,':id'=>$submissionId]);
}

function lcnUniqueTreatmentSlug(PDO $pdo, string $name): string {
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name) ?: $name;
    $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($ascii)), '-');
    $base = $base !== '' ? substr($base, 0, 220) : 'behandlung';
    $slug = $base;
    $counter = 2;
    $check = $pdo->prepare('SELECT 1 FROM v_lcn_treatments WHERE slug = :slug');
    while (true) {
        $check->execute([':slug' => $slug]);
        if (!$check->fetchColumn()) return $slug;
        $slug = $base . '-' . $counter++;
    }
}

function lcnApproveDoctorSubmission(PDO $pdo, array $row, array $payload): int {
    $typeMap = ['doctor'=>'physician','practice'=>'practice','clinic'=>'clinic','therapy_center'=>'practice','other'=>'other'];
    $providerType = (string)($payload['provider_type'] ?? 'doctor');
    $insurance = is_array($payload['insurance'] ?? null) ? $payload['insurance'] : [];
    $drId=(int)($row['existing_target_id']??0);
    if($drId>0){
        if(!lcnDoctorExists($drId))throw new DomainException('Anbieter nicht gefunden.');
        $stmt=$pdo->prepare("UPDATE tbl_entities_nd SET website=COALESCE(NULLIF(website,''),:website),email=COALESCE(NULLIF(email,''),:email),sprechstunde_gkv=IF(:gkv='GKV','GKV',sprechstunde_gkv),sprechstunde_pkv=IF(:pkv='PKV','PKV',sprechstunde_pkv),legacy_notes=CONCAT_WS('\n',legacy_notes,:notes) WHERE lcn_id=:id");
        $stmt->execute([':website'=>$row['website']?:null,':email'=>$row['email']?:null,':gkv'=>in_array('gkv',$insurance,true)?'GKV':null,':pkv'=>in_array('pkv',$insurance,true)?'PKV':null,':notes'=>'Geprüfte Community-Ergänzung #'.$row['submission_id'],':id'=>$drId]);
    }else{
        $check=$pdo->prepare('SELECT lcn_id FROM tbl_entities_nd WHERE LOWER(TRIM(anzeigename))=LOWER(TRIM(?))');$check->execute([$row['name']]);if($check->fetchColumn())throw new DomainException('Anbieter bereits vorhanden.');
        $stmt=$pdo->prepare("INSERT INTO tbl_entities_nd(datensatztyp,behandlertyp,institutionstyp,titel,vorname,nachname,organisationsname,anzeigename,website,email,sprechstunde_gkv,sprechstunde_pkv,review_status,legacy_notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'approved',?)");
        $institution=in_array($providerType,['practice','clinic','therapy_center'],true);
        $stmt->execute([$institution?'Institution':($providerType==='doctor'?'Behandler':null),$providerType==='doctor'?'Arzt':null,$institution?(['practice'=>'Praxis','clinic'=>'Klinik','therapy_center'=>'Therapiezentrum'][$providerType]):null,lcnNullable($payload,'title'),lcnNullable($payload,'firstname'),lcnNullable($payload,'lastname'),lcnNullable($payload,'organization')??($institution?$row['name']:null),$row['name'],$row['website']?:null,$row['email']?:null,in_array('gkv',$insurance,true)?'GKV':null,in_array('pkv',$insurance,true)?'PKV':null,'Geprüfter Community-Vorschlag #'.$row['submission_id']]);$drId=(int)$pdo->lastInsertId();
    }
    $hasLocation = array_filter([$payload['street']??'', $payload['postal_code']??'', $payload['city']??'', $row['phone']??'']);
    if ($hasLocation) {
        $country = strtoupper(trim((string)($payload['country'] ?? ''))); $country = in_array($country,['DE','DEUTSCHLAND','GERMANY'],true)?'DE':null;
        $lat=filter_var($payload['lat']??null,FILTER_VALIDATE_FLOAT);$lng=filter_var($payload['lng']??null,FILTER_VALIDATE_FLOAT);
        $locationParams=[':id'=>$drId,':label'=>$row['name'],':country'=>$country,':plz'=>lcnNullable($payload,'postal_code'),':city'=>lcnNullable($payload,'city'),':street'=>lcnNullable($payload,'street'),':house'=>lcnNullable($payload,'house_number'),':phone'=>$row['phone']?:null,':email'=>$row['email']?:null,':website'=>$row['website']?:null,':lat'=>$lat===false?null:$lat,':lng'=>$lng===false?null:$lng];
        if((int)($row['existing_target_id']??0)>0){
            $loc=$pdo->prepare("UPDATE tbl_drs_locations_03 SET loc_country=COALESCE(NULLIF(loc_country,''),:country),loc_plz=COALESCE(NULLIF(loc_plz,''),:plz),loc_city=COALESCE(NULLIF(loc_city,''),:city),loc_street=COALESCE(NULLIF(loc_street,''),:street),loc_housenumber=COALESCE(NULLIF(loc_housenumber,''),:house),loc_phone=COALESCE(NULLIF(loc_phone,''),:phone),loc_email=COALESCE(NULLIF(loc_email,''),:email),loc_website=COALESCE(NULLIF(loc_website,''),:website),loc_lat=COALESCE(loc_lat,:lat),loc_lng=COALESCE(loc_lng,:lng) WHERE dr_id=:id ORDER BY loc_is_primary DESC,loc_id ASC LIMIT 1");unset($locationParams[':label']);$loc->execute($locationParams);
        }else{$loc=$pdo->prepare('INSERT INTO tbl_drs_locations_03 (dr_id,loc_label,loc_is_primary,loc_country,loc_plz,loc_city,loc_street,loc_housenumber,loc_phone,loc_email,loc_website,loc_lat,loc_lng,loc_address_visibility) VALUES (:id,:label,1,:country,:plz,:city,:street,:house,:phone,:email,:website,:lat,:lng,\'public\')');$loc->execute($locationParams);}
    }
    $features = is_array($payload['features'] ?? null) ? array_values(array_unique($payload['features'])) : [];
    if ($features) {
        $marks = implode(',', array_fill(0,count($features),'?'));
        $terms = $pdo->prepare("SELECT term_id FROM tbl_terms_03 WHERE term_code IN ($marks)"); $terms->execute($features);
        $link = $pdo->prepare("INSERT IGNORE INTO tbl_cpl_drs2terms_03 (dr_id,term_id,confidence) VALUES (:dr,:term,'medium')");
        foreach ($terms->fetchAll(PDO::FETCH_COLUMN) as $termId) $link->execute([':dr'=>$drId,':term'=>$termId]);
    }
    $specialtyIds = array_values(array_filter(array_map('intval', is_array($payload['specialty_ids'] ?? null) ? $payload['specialty_ids'] : [])));
    if ($specialtyIds) {
        $marks=implode(',',array_fill(0,count($specialtyIds),'?'));
        $terms=$pdo->prepare("SELECT term_id FROM tbl_terms_03 WHERE term_type='specialty' AND term_id IN ($marks)");$terms->execute($specialtyIds);
        $link=$pdo->prepare("INSERT IGNORE INTO tbl_cpl_drs2terms_03 (dr_id,term_id,confidence) VALUES (:dr,:term,'medium')");
        foreach($terms->fetchAll(PDO::FETCH_COLUMN) as $termId)$link->execute([':dr'=>$drId,':term'=>$termId]);
    }
    $treatmentIds = lcnSubmissionTreatmentIds($payload);
    if ($treatmentIds) {
        $marks=implode(',',array_fill(0,count($treatmentIds),'?'));
        $valid=$pdo->prepare("SELECT treat_id FROM v_lcn_treatments WHERE treat_id IN ($marks)");$valid->execute($treatmentIds);
        $link=$pdo->prepare('INSERT INTO tbl_cpl_entities2treatments_nd (lcn_id,treat_nd_id,note,anbieter_label,dedupe_hash) SELECT :dr,:treat,:note,e.anzeigename,SHA2(CONCAT(CHAR(112,114,111,118,105,100,101,114,58),:dr),256) FROM tbl_entities_nd e WHERE e.lcn_id=:dr AND NOT EXISTS(SELECT 1 FROM tbl_cpl_entities2treatments_nd c WHERE c.lcn_id=:dr AND c.treat_nd_id=:treat)');
        foreach($valid->fetchAll(PDO::FETCH_COLUMN) as $treatId)$link->execute([':dr'=>$drId,':treat'=>$treatId,':note'=>'Community-Vorschlag #'.$row['submission_id']]);
    }
    lcnMigrateCommunitySubmissionVotes($pdo,(int)$row['submission_id'],'doctor',$drId);
    return $drId;
}

function lcnApproveTreatmentSubmission(PDO $pdo, array $row, array $payload): int {
    $id=(int)($row['existing_target_id']??0);
    if($id>0){$exists=$pdo->prepare('SELECT 1 FROM v_lcn_treatments WHERE treat_id=:id');$exists->execute([':id'=>$id]);if(!$exists->fetchColumn())throw new DomainException('Die zu ergänzende Behandlung existiert nicht mehr.');
        $update=$pdo->prepare("UPDATE v_lcn_treatments SET typ=COALESCE(NULLIF(typ,''),:type),aufwand=COALESCE(NULLIF(aufwand,''),:effort),crashrisiko=COALESCE(NULLIF(crashrisiko,''),:risk),kosten=COALESCE(NULLIF(kosten,''),:cost),wirkgeschwindigkeit=COALESCE(NULLIF(wirkgeschwindigkeit,''),:speed),wirkmechanismus=COALESCE(NULLIF(wirkmechanismus,''),:mechanism),indikationen_anwendungsgebiete=COALESCE(NULLIF(indikationen_anwendungsgebiete,''),:indications),weitere_hinweise=CONCAT_WS('\n',weitere_hinweise,:notes),notes_internal=CONCAT_WS('\n',notes_internal,:internal) WHERE treat_id=:id");
        $update->execute([':type'=>lcnNullable($payload,'treatment_category'),':effort'=>lcnNullable($payload,'effort'),':risk'=>lcnNullable($payload,'crash_risk'),':cost'=>lcnNullable($payload,'cost'),':speed'=>lcnNullable($payload,'speed'),':mechanism'=>lcnNullable($payload,'mechanism'),':indications'=>lcnNullable($payload,'indications'),':notes'=>lcnNullable($payload,'offerings'),':internal'=>'Community-Ergänzung #'.$row['submission_id'].' geprüft.',':id'=>$id]);
    }else{$duplicate=$pdo->prepare('SELECT treat_id FROM v_lcn_treatments WHERE LOWER(TRIM(behandlung))=LOWER(TRIM(:name)) LIMIT 1');$duplicate->execute([':name'=>$row['name']]);if($duplicate->fetchColumn())throw new DomainException('Eine Behandlung mit diesem Namen existiert bereits.');$stmt=$pdo->prepare('INSERT INTO v_lcn_treatments (slug,behandlung,typ,aufwand,crashrisiko,kosten,wirkgeschwindigkeit,wirkmechanismus,indikationen_anwendungsgebiete,weitere_hinweise,notes_internal,wiki_url_path) VALUES (:slug,:name,:type,:effort,:risk,:cost,:speed,:mechanism,:indications,:notes,:internal,:url)');$stmt->execute([':slug'=>lcnUniqueTreatmentSlug($pdo,$row['name']),':name'=>$row['name'],':type'=>lcnNullable($payload,'treatment_category'),':effort'=>lcnNullable($payload,'effort'),':risk'=>lcnNullable($payload,'crash_risk'),':cost'=>lcnNullable($payload,'cost'),':speed'=>lcnNullable($payload,'speed'),':mechanism'=>lcnNullable($payload,'mechanism'),':indications'=>lcnNullable($payload,'indications'),':notes'=>lcnNullable($payload,'offerings'),':internal'=>'Community-Vorschlag #'.$row['submission_id'].'; vor Veröffentlichung geprüft.',':url'=>$row['website']]);$id=(int)$pdo->lastInsertId();}
    $pdo->prepare("UPDATE tbl_treatments_nd SET review_status='approved',datenstand=CURRENT_DATE WHERE treat_nd_id=?")->execute([$id]);
    $doctorIds = array_values(array_filter(array_map('intval', is_array($payload['doctor_ids'] ?? null) ? $payload['doctor_ids'] : [])));
    if ($doctorIds) {
        $marks=implode(',',array_fill(0,count($doctorIds),'?'));
        $valid=$pdo->prepare("SELECT dr_id FROM v_lcn_doctors WHERE dr_id IN ($marks)");$valid->execute($doctorIds);
        $link=$pdo->prepare('INSERT INTO tbl_cpl_entities2treatments_nd (lcn_id,treat_nd_id,note,anbieter_label,dedupe_hash) SELECT :dr,:treat,:note,e.anzeigename,SHA2(CONCAT(CHAR(112,114,111,118,105,100,101,114,58),:dr),256) FROM tbl_entities_nd e WHERE e.lcn_id=:dr AND NOT EXISTS(SELECT 1 FROM tbl_cpl_entities2treatments_nd c WHERE c.lcn_id=:dr AND c.treat_nd_id=:treat)');
        foreach($valid->fetchAll(PDO::FETCH_COLUMN) as $drId)$link->execute([':dr'=>$drId,':treat'=>$id,':note'=>'Community-Vorschlag #'.$row['submission_id']]);
    }
    $nameStmt=$pdo->prepare('SELECT behandlung FROM v_lcn_treatments WHERE treat_id=:id');$nameStmt->execute([':id'=>$id]);
    lcnMigrateCommunitySubmissionVotes($pdo,(int)$row['submission_id'],'treatment',$id,(string)$nameStmt->fetchColumn());
    return $id;
}
