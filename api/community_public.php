<?php
require_once __DIR__ . '/_voting.php';
require_once __DIR__ . '/_search_normalization.php';

try {
    $entity = (string)($_GET['entity_type'] ?? '');
    if (!in_array($entity, ['doctor', 'treatment'], true)) {
        lcnSendVoteJson(['ok' => false, 'error' => 'Ungültiger Eintragstyp.'], 422);
    }
    $search = mb_substr(trim((string)($_GET['search'] ?? '')), 0, 180);
    $city = mb_substr(trim((string)($_GET['city'] ?? '')), 0, 120);
    $pdo = lcnDatabase();
    $sql = "SELECT s.submission_id,s.entity_type,s.review_status,s.name,s.website,s.email,s.phone,s.city,s.payload,s.created_at,
                   COALESCE(SUM(v.vote='pro'),0) pro,COALESCE(SUM(v.vote='neutral'),0) neutral,COALESCE(SUM(v.vote='contra'),0) contra,
                   COUNT(v.voter_key) total_votes
            FROM community_submissions s
            LEFT JOIN community_submission_votes v ON v.submission_id=s.submission_id AND v.migrated_target_id IS NULL
            WHERE s.entity_type=:entity AND s.review_status IN ('pending','reviewing')";
    $params = [':entity' => $entity];
    if ($search !== '') { $sql .= " AND ".lcnNormalizedSearchSql('s.name')." LIKE :search"; $params[':search'] = '%'.lcnNormalizeSearchTerm($search).'%'; }
    if ($city !== '') { $sql .= " AND LOWER(COALESCE(s.city,''))=LOWER(:city)"; $params[':city'] = $city; }
    $sql .= ' GROUP BY s.submission_id ORDER BY s.name ASC';
    $stmt = $pdo->prepare($sql); $stmt->execute($params);
    $voterKey = lcnExistingVoterKey();
    $own = [];
    if ($voterKey !== null) {
        $ownStmt=$pdo->prepare("SELECT submission_id,vote FROM community_submission_votes WHERE voter_key=:key AND migrated_target_id IS NULL");
        $ownStmt->execute([':key'=>$voterKey]);
        foreach($ownStmt as $row)$own[(int)$row['submission_id']]=$row['vote'];
    }
    $items=[];
    foreach($stmt as $row){
        $payload=json_decode((string)$row['payload'],true); if(!is_array($payload))$payload=[];
        $pro=(int)$row['pro'];$neutral=(int)$row['neutral'];$contra=(int)$row['contra'];$total=(int)$row['total_votes'];
        $base=['community_submission_id'=>(int)$row['submission_id'],'community_status'=>$row['review_status'],'is_community_preview'=>true,'created_at'=>$row['created_at'],'pro'=>$pro,'neutral'=>$neutral,'contra'=>$contra,'total_votes'=>$total,'positive_ratio'=>$total?round($pro*100/$total):0,'neutral_ratio'=>$total?round($neutral*100/$total):0,'negative_ratio'=>$total?round($contra*100/$total):0,'own_vote'=>$own[(int)$row['submission_id']]??null];
        if($entity==='doctor'){
            $items[]=array_merge($base,['dr_id'=>-(int)$row['submission_id'],'dr_display_name'=>$row['name'],'dr_type'=>$payload['provider_type']??'other','dr_website'=>$row['website'],'dr_email'=>$row['email'],'dr_accepts_gkv'=>in_array('gkv',$payload['insurance']??[],true)?'yes':'unknown','dr_accepts_pkv'=>in_array('pkv',$payload['insurance']??[],true)?'yes':'unknown','loc_label'=>$row['name'],'loc_city'=>$payload['city']??$row['city'],'loc_plz'=>$payload['postal_code']??'','loc_street'=>$payload['street']??'','loc_housenumber'=>$payload['house_number']??'','loc_phone'=>$row['phone'],'loc_email'=>$row['email'],'loc_website'=>$row['website'],'loc_lat'=>isset($payload['lat'])?(float)$payload['lat']:null,'loc_lng'=>isset($payload['lng'])?(float)$payload['lng']:null,'distance_km'=>null,'specialties'=>[]]);
        }else{
            $items[]=array_merge($base,['treat_id'=>-(int)$row['submission_id'],'behandlung'=>$row['name'],'typ'=>$payload['treatment_category']??'','unterkategorie'=>'','aufwand'=>$payload['effort']??'','crashrisiko'=>$payload['crash_risk']??'','kosten'=>$payload['cost']??'','wirkgeschwindigkeit'=>$payload['speed']??'','wirkmechanismus'=>$payload['mechanism']??'','indikationen_anwendungsgebiete'=>$payload['indications']??'','weitere_hinweise'=>$payload['offerings']??'','provider_count'=>0,'total_provider_count'=>0,'matching_provider_count'=>0,'nearest_provider'=>null,'nearest_provider_distance_km'=>null]);
        }
    }
    lcnSendVoteJson(['ok'=>true,'items'=>$items,'count'=>count($items)]);
} catch(Throwable $error){lcnLogApiError('community_public',$error);lcnSendVoteJson(['ok'=>false,'error'=>'Community-Vorschläge konnten nicht geladen werden.'],500);}
