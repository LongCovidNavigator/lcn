<?php
require_once __DIR__.'/_treatments_nd.php';

function lcnTreatmentSymptomHelp(PDO $pdo,int $treatment,?string $respondent): array {
    $catalog=lcnNdRows($pdo,'SELECT sym_id AS id,sym_name AS name FROM tbl_symptoms ORDER BY sym_name,sym_id');
    $editorial=array_map('intval',array_column(lcnNdRows($pdo,'SELECT DISTINCT sym_id FROM tbl_cpl_treatments_nd2symptoms WHERE treat_nd_id=? AND aktiv=1 AND sym_id IS NOT NULL',[$treatment]),'sym_id'));
    $linked=array_map('intval',array_column(lcnNdRows($pdo,'SELECT sym_id FROM tbl_treatment_symptom_help_links WHERE treat_nd_id=?',[$treatment]),'sym_id'));
    $counts=[];$own=[];
    foreach(lcnNdRows($pdo,"SELECT sym_id,COUNT(*) AS n FROM tbl_treatment_symptom_help_votes WHERE treat_nd_id=? AND review_status IN ('active','approved') GROUP BY sym_id",[$treatment]) as $row)$counts[(int)$row['sym_id']]=(int)$row['n'];
    if($respondent!==null)$own=array_map('intval',array_column(lcnNdRows($pdo,"SELECT sym_id FROM tbl_treatment_symptom_help_votes WHERE treat_nd_id=? AND respondent_key=?",[$treatment,$respondent]),'sym_id'));
    $ids=array_unique(array_merge($editorial,$linked));$symptoms=[];
    foreach($catalog as &$symptom){
        $symptom['id']=(int)$symptom['id'];
        if(in_array($symptom['id'],$ids,true))$symptoms[]=$symptom+['count'=>$counts[$symptom['id']]??0,'selected'=>in_array($symptom['id'],$own,true),'editorial'=>in_array($symptom['id'],$editorial,true)];
    }unset($symptom);
    return ['symptoms'=>$symptoms,'catalog'=>$catalog];
}

function lcnSaveTreatmentSymptomHelp(PDO $pdo,int $treatment,int $symptom,string $respondent,bool $helped): void {
    if(!lcnNdRows($pdo,'SELECT 1 FROM tbl_symptoms WHERE sym_id=?',[$symptom]))throw new InvalidArgumentException('Dieses Symptom ist nicht verfügbar.');
    if(!$helped){
        $query=$pdo->prepare('DELETE FROM tbl_treatment_symptom_help_votes WHERE treat_nd_id=? AND sym_id=? AND respondent_key=?');
        $query->execute([$treatment,$symptom,$respondent]);return;
    }
    $query=$pdo->prepare('INSERT INTO tbl_treatment_symptom_help_links(treat_nd_id,sym_id) VALUES(?,?) ON DUPLICATE KEY UPDATE sym_id=VALUES(sym_id)');
    $query->execute([$treatment,$symptom]);
    $query=$pdo->prepare('INSERT INTO tbl_treatment_symptom_help_votes(treat_nd_id,sym_id,respondent_key) VALUES(?,?,?) ON DUPLICATE KEY UPDATE respondent_key=VALUES(respondent_key)');
    $query->execute([$treatment,$symptom,$respondent]);
}
