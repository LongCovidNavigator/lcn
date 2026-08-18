<?php
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
    $aggregateColumns=['pro'=>'vote_improved','neutral'=>'vote_neutral','contra'=>'vote_worsened'];
    foreach($votes as $row){
        if($entityType==='doctor'){
            $insert=$pdo->prepare('INSERT IGNORE INTO doctor_votes(voter_key,dr_id,vote) VALUES(:key,:id,:vote)');
            $insert->execute([':key'=>$row['voter_key'],':id'=>$targetId,':vote'=>$row['vote']]);
            if($insert->rowCount()>0){$column=$aggregateColumns[$row['vote']];$pdo->prepare("INSERT INTO tbl_drs_votes_03(dr_id,$column) VALUES(:id,1) ON DUPLICATE KEY UPDATE $column=$column+1")->execute([':id'=>$targetId]);}
        }else{
            $insert=$pdo->prepare('INSERT IGNORE INTO treatment_votes(voter_key,treat_id,vote) VALUES(:key,:id,:vote)');
            $insert->execute([':key'=>$row['voter_key'],':id'=>$targetId,':vote'=>$row['vote']]);
            if($insert->rowCount()>0){$column=$row['vote'];$pdo->prepare("INSERT INTO lcn_votes(Behandlung,$column) VALUES(:name,1) ON DUPLICATE KEY UPDATE $column=$column+1")->execute([':name'=>$treatmentName]);}
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
    $check = $pdo->prepare('SELECT 1 FROM tbl_treatments_03 WHERE slug = :slug');
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
        $exists=$pdo->prepare('SELECT 1 FROM tbl_drs_03 WHERE dr_id=:id');$exists->execute([':id'=>$drId]);if(!$exists->fetchColumn())throw new DomainException('Der zu ergänzende Arzt-/Praxiseintrag existiert nicht mehr.');
        $update=$pdo->prepare("UPDATE tbl_drs_03 SET dr_website=COALESCE(NULLIF(dr_website,''),:website),dr_email=COALESCE(NULLIF(dr_email,''),:email),dr_accepts_gkv=IF(:gkv='yes','yes',dr_accepts_gkv),dr_accepts_pkv=IF(:pkv='yes','yes',dr_accepts_pkv),dr_notes=CONCAT_WS('\n',dr_notes,:notes) WHERE dr_id=:id");
        $update->execute([':website'=>$row['website']?:null,':email'=>$row['email']?:null,':gkv'=>in_array('gkv',$insurance,true)?'yes':'unknown',':pkv'=>in_array('pkv',$insurance,true)?'yes':'unknown',':notes'=>'Community-Ergänzung #'.$row['submission_id'].' geprüft.',':id'=>$drId]);
    }else{
        $duplicate=$pdo->prepare("SELECT dr_id FROM tbl_drs_03 WHERE LOWER(TRIM(dr_display_name))=LOWER(TRIM(:name)) OR (:website<>'' AND dr_website IS NOT NULL AND LOWER(TRIM(dr_website))=LOWER(TRIM(:website))) LIMIT 1");$duplicate->execute([':name'=>$row['name'],':website'=>$row['website']]);if($duplicate->fetchColumn())throw new DomainException('Ein Arzt-/Praxiseintrag mit diesem Namen oder dieser Website existiert bereits.');
        $stmt=$pdo->prepare('INSERT INTO tbl_drs_03 (dr_type,dr_is_dr,dr_title_raw,dr_firstname,dr_lastname,dr_org_name,dr_display_name,dr_website,dr_email,dr_accepts_gkv,dr_accepts_pkv,dr_notes) VALUES (:type,:is_dr,:title,:firstname,:lastname,:org,:name,:website,:email,:gkv,:pkv,:notes)');
        $stmt->execute([':type'=>$typeMap[$providerType]??'other',':is_dr'=>$providerType==='doctor'?1:0,':title'=>lcnNullable($payload,'title'),':firstname'=>lcnNullable($payload,'firstname'),':lastname'=>lcnNullable($payload,'lastname'),':org'=>lcnNullable($payload,'organization')??($providerType==='doctor'?null:$row['name']),':name'=>$row['name'],':website'=>$row['website']?:null,':email'=>$row['email']?:null,':gkv'=>in_array('gkv',$insurance,true)?'yes':'unknown',':pkv'=>in_array('pkv',$insurance,true)?'yes':'unknown',':notes'=>'Community-Vorschlag #'.$row['submission_id'].'; vor Veröffentlichung geprüft.']);$drId=(int)$pdo->lastInsertId();
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
    $treatmentIds = array_values(array_filter(array_map('intval', is_array($payload['treatment_ids'] ?? null) ? $payload['treatment_ids'] : [])));
    if ($treatmentIds) {
        $marks=implode(',',array_fill(0,count($treatmentIds),'?'));
        $valid=$pdo->prepare("SELECT treat_id FROM tbl_treatments_03 WHERE treat_id IN ($marks)");$valid->execute($treatmentIds);
        $link=$pdo->prepare('INSERT IGNORE INTO tbl_cpl_drs2treatments_03 (dr_id,treat_id,note) VALUES (:dr,:treat,:note)');
        foreach($valid->fetchAll(PDO::FETCH_COLUMN) as $treatId)$link->execute([':dr'=>$drId,':treat'=>$treatId,':note'=>'Community-Vorschlag #'.$row['submission_id']]);
    }
    lcnMigrateCommunitySubmissionVotes($pdo,(int)$row['submission_id'],'doctor',$drId);
    return $drId;
}

function lcnApproveTreatmentSubmission(PDO $pdo, array $row, array $payload): int {
    $id=(int)($row['existing_target_id']??0);
    if($id>0){$exists=$pdo->prepare('SELECT 1 FROM tbl_treatments_03 WHERE treat_id=:id');$exists->execute([':id'=>$id]);if(!$exists->fetchColumn())throw new DomainException('Die zu ergänzende Behandlung existiert nicht mehr.');
        $update=$pdo->prepare("UPDATE tbl_treatments_03 SET typ=COALESCE(NULLIF(typ,''),:type),aufwand=COALESCE(NULLIF(aufwand,''),:effort),crashrisiko=COALESCE(NULLIF(crashrisiko,''),:risk),kosten=COALESCE(NULLIF(kosten,''),:cost),wirkgeschwindigkeit=COALESCE(NULLIF(wirkgeschwindigkeit,''),:speed),wirkmechanismus=COALESCE(NULLIF(wirkmechanismus,''),:mechanism),indikationen_anwendungsgebiete=COALESCE(NULLIF(indikationen_anwendungsgebiete,''),:indications),weitere_hinweise=CONCAT_WS('\n',weitere_hinweise,:notes),notes_internal=CONCAT_WS('\n',notes_internal,:internal) WHERE treat_id=:id");
        $update->execute([':type'=>lcnNullable($payload,'treatment_category'),':effort'=>lcnNullable($payload,'effort'),':risk'=>lcnNullable($payload,'crash_risk'),':cost'=>lcnNullable($payload,'cost'),':speed'=>lcnNullable($payload,'speed'),':mechanism'=>lcnNullable($payload,'mechanism'),':indications'=>lcnNullable($payload,'indications'),':notes'=>lcnNullable($payload,'offerings'),':internal'=>'Community-Ergänzung #'.$row['submission_id'].' geprüft.',':id'=>$id]);
    }else{$duplicate=$pdo->prepare('SELECT treat_id FROM tbl_treatments_03 WHERE LOWER(TRIM(behandlung))=LOWER(TRIM(:name)) LIMIT 1');$duplicate->execute([':name'=>$row['name']]);if($duplicate->fetchColumn())throw new DomainException('Eine Behandlung mit diesem Namen existiert bereits.');$stmt=$pdo->prepare('INSERT INTO tbl_treatments_03 (slug,behandlung,typ,aufwand,crashrisiko,kosten,wirkgeschwindigkeit,wirkmechanismus,indikationen_anwendungsgebiete,weitere_hinweise,notes_internal,wiki_url_path) VALUES (:slug,:name,:type,:effort,:risk,:cost,:speed,:mechanism,:indications,:notes,:internal,:url)');$stmt->execute([':slug'=>lcnUniqueTreatmentSlug($pdo,$row['name']),':name'=>$row['name'],':type'=>lcnNullable($payload,'treatment_category'),':effort'=>lcnNullable($payload,'effort'),':risk'=>lcnNullable($payload,'crash_risk'),':cost'=>lcnNullable($payload,'cost'),':speed'=>lcnNullable($payload,'speed'),':mechanism'=>lcnNullable($payload,'mechanism'),':indications'=>lcnNullable($payload,'indications'),':notes'=>lcnNullable($payload,'offerings'),':internal'=>'Community-Vorschlag #'.$row['submission_id'].'; vor Veröffentlichung geprüft.',':url'=>$row['website']]);$id=(int)$pdo->lastInsertId();}
    $doctorIds = array_values(array_filter(array_map('intval', is_array($payload['doctor_ids'] ?? null) ? $payload['doctor_ids'] : [])));
    if ($doctorIds) {
        $marks=implode(',',array_fill(0,count($doctorIds),'?'));
        $valid=$pdo->prepare("SELECT dr_id FROM tbl_drs_03 WHERE dr_id IN ($marks)");$valid->execute($doctorIds);
        $link=$pdo->prepare('INSERT IGNORE INTO tbl_cpl_drs2treatments_03 (dr_id,treat_id,note) VALUES (:dr,:treat,:note)');
        foreach($valid->fetchAll(PDO::FETCH_COLUMN) as $drId)$link->execute([':dr'=>$drId,':treat'=>$id,':note'=>'Community-Vorschlag #'.$row['submission_id']]);
    }
    $nameStmt=$pdo->prepare('SELECT behandlung FROM tbl_treatments_03 WHERE treat_id=:id');$nameStmt->execute([':id'=>$id]);
    lcnMigrateCommunitySubmissionVotes($pdo,(int)$row['submission_id'],'treatment',$id,(string)$nameStmt->fetchColumn());
    return $id;
}
