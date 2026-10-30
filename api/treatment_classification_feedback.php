<?php
declare(strict_types=1);
require_once __DIR__.'/_treatments_nd.php';
require_once __DIR__.'/_treatment_discovery.php';
require_once __DIR__.'/_voting.php';
require_once __DIR__.'/_vote_abuse.php';
require_once __DIR__.'/../components/treatment_relationship_stages.php';
header('Cache-Control: private, no-store');
try {
    $p=lcnTreatmentsNdDatabase();
    $write=($_SERVER['REQUEST_METHOD']??'GET')==='POST';
    if($write){lcnRequireVotingRequest();$input=lcnReadJsonBody();$id=(int)($input['id']??0);}
    else $id=(int)($_GET['id']??0);
    $graph=lcnTreatmentDiscoveryGraph($p);
    if(!isset($graph['entries'][$id]))throw new InvalidArgumentException('Therapie nicht gefunden.');
    $model=ndRelationshipStages($graph,$id);
    if(!$model['drug'])throw new InvalidArgumentException('Diese Einordnung ist nur für Medikamente verfügbar.');
    $roles=['group','ingredient','brand'];
    $keys=array_map(fn($role)=>'classification:'.$id.':'.$role,$roles);
    if($write){
        $choice=$input['choice']??null;
        if(!is_string($choice)||($choice!==''&&!in_array($choice,$roles,true)))throw new InvalidArgumentException('Bitte eine gültige Einordnung auswählen.');
        $user=lcnVoterKey();
        lcnBeginVoteSecurity($p,'treatment',$id,'neutral',$user);
        // Serialize each person's choice so concurrent requests cannot select two roles.
        $lock='classification:'.substr(hash('sha256',$id.':'.$user),0,48);
        $query=$p->prepare('SELECT GET_LOCK(?,10)');$query->execute([$lock]);
        if((int)$query->fetchColumn()!==1)throw new RuntimeException('Rückmeldung wird gerade gespeichert.');
        try {
            $p->beginTransaction();
            $p->prepare('DELETE FROM catalog_relation_feedback WHERE respondent_key=? AND relation_key IN (?,?,?)')->execute(array_merge([$user],$keys));
            if($choice!=='')$p->prepare('INSERT INTO catalog_relation_feedback(relation_key,respondent_key,stance) VALUES(?,?,1)')->execute(['classification:'.$id.':'.$choice,$user]);
            $p->commit();
        } finally {
            if($p->inTransaction())$p->rollBack();
            $p->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]);
        }
    }
    $user=lcnExistingVoterKey();$result=[];
    $query=$p->prepare('SELECT relation_key,COUNT(*) votes,MAX(respondent_key=?) own FROM catalog_relation_feedback WHERE relation_key IN (?,?,?) AND stance=1 GROUP BY relation_key');
    $query->execute(array_merge([$user??''],$keys));
    foreach($roles as $role)$result[$role]=['count'=>0,'own'=>false];
    foreach($query as $row){$role=substr($row['relation_key'],strrpos($row['relation_key'],':')+1);$result[$role]=['count'=>(int)$row['votes'],'own'=>(bool)$row['own']];}
    lcnSendVoteJson(['ok'=>true,'choices'=>$result]);
} catch(InvalidArgumentException $error){lcnSendVoteJson(['ok'=>false,'error'=>$error->getMessage()],400);}
catch(Throwable $error){lcnLogApiError('treatment_classification_feedback',$error);lcnSendVoteJson(['ok'=>false,'error'=>'Die Einordnung konnte nicht geladen oder gespeichert werden.'],500);}
