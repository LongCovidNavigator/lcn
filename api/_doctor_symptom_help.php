<?php
require_once __DIR__.'/_treatments_nd.php';
require_once __DIR__.'/_symptom_catalog.php';

function lcnDirectSymptomProviders(PDO $pdo, array $symptomIds): array
{
    if (!$symptomIds) return [];
    $placeholders = implode(',', array_fill(0, count($symptomIds), '?'));
    $providers = [];
    try {
        $rows = lcnNdRows($pdo, "SELECT l.sym_id, d.dr_id, d.dr_display_name, COUNT(v.dr_id) AS experience_count
            FROM tbl_doctor_symptom_help_links l
            JOIN v_lcn_doctors d ON d.dr_id=l.dr_id
            LEFT JOIN tbl_doctor_symptom_help_votes v
                ON v.dr_id=l.dr_id AND v.sym_id=l.sym_id AND v.review_status IN ('active','approved')
            WHERE l.sym_id IN ($placeholders)
            GROUP BY l.sym_id, d.dr_id, d.dr_display_name
            ORDER BY experience_count DESC, d.dr_display_name, d.dr_id", $symptomIds);
        foreach ($rows as $row) {
            $providers[$row['sym_id']][$row['dr_id']] = [
                'dr_id' => (int)$row['dr_id'], 'dr_display_name' => $row['dr_display_name'],
                'experience_count' => (int)$row['experience_count'],
            ];
        }
    } catch (PDOException $e) {
        if ($e->getCode() !== '42S02') throw $e;
    }
    return $providers;
}

function lcnSymptomProviderLocations(PDO $pdo, array $providersBySymptom): array
{
    $providers = [];
    foreach ($providersBySymptom as $matches) $providers += $matches;
    if (!$providers) return [];
    $placeholders = implode(',', array_fill(0, count($providers), '?'));
    $rows = lcnNdRows($pdo, "SELECT dr_id, loc_plz, loc_city, loc_street, loc_housenumber, loc_lat, loc_lng
        FROM tbl_drs_locations_03 WHERE dr_id IN ($placeholders)
        ORDER BY loc_is_primary DESC, loc_id", array_keys($providers));
    $locations = [];
    foreach ($rows as $row) {
        $id = (int)$row['dr_id'];
        $locations[$id][] = $row + ['dr_display_name' => $providers[$id]['dr_display_name']];
    }
    return $locations;
}

function lcnDoctorSymptomHelp(PDO $pdo,int $treatment,?string $respondent): array {
    $catalog=lcnSymptomHelpCatalog($pdo);
    $defaults=['Fatigue','Brain Fog','Schlafstörungen','Belastungsintoleranz'];$editorial=[];foreach($defaults as $name)foreach($catalog as $symptom)if($symptom['name']===$name)$editorial[]=(int)$symptom['id'];
    $linked=array_map('intval',array_column(lcnNdRows($pdo,'SELECT sym_id FROM tbl_doctor_symptom_help_links WHERE dr_id=?',[$treatment]),'sym_id'));
    $counts=[];$own=[];
    foreach(lcnNdRows($pdo,"SELECT sym_id,COUNT(*) AS n FROM tbl_doctor_symptom_help_votes WHERE dr_id=? AND review_status IN ('active','approved') GROUP BY sym_id",[$treatment]) as $row)$counts[(int)$row['sym_id']]=(int)$row['n'];
    if($respondent!==null)$own=array_map('intval',array_column(lcnNdRows($pdo,"SELECT sym_id FROM tbl_doctor_symptom_help_votes WHERE dr_id=? AND respondent_key=?",[$treatment,$respondent]),'sym_id'));
    $ids=array_unique(array_merge($editorial,$linked));$symptoms=[];
    foreach($catalog as $symptom){
        if($symptom['pinned']||in_array($symptom['id'],$ids,true))$symptoms[]=$symptom+['count'=>$counts[$symptom['id']]??0,'selected'=>in_array($symptom['id'],$own,true),'suggested'=>in_array($symptom['id'],$editorial,true),'default_order'=>array_search($symptom['id'],$editorial,true)===false?99:array_search($symptom['id'],$editorial,true)];
    }
    return ['symptoms'=>$symptoms,'catalog'=>$catalog];
}

function lcnSaveDoctorSymptomHelp(PDO $pdo,int $treatment,int $symptom,string $respondent,bool $helped): void {
    if(!lcnNdRows($pdo,'SELECT 1 FROM tbl_symptoms WHERE sym_id=?',[$symptom]))throw new InvalidArgumentException('Dieses Symptom ist nicht verfügbar.');
    if(!$helped){
        $query=$pdo->prepare('DELETE FROM tbl_doctor_symptom_help_votes WHERE dr_id=? AND sym_id=? AND respondent_key=?');
        $query->execute([$treatment,$symptom,$respondent]);return;
    }
    $query=$pdo->prepare('INSERT INTO tbl_doctor_symptom_help_links(dr_id,sym_id) VALUES(?,?) ON DUPLICATE KEY UPDATE sym_id=VALUES(sym_id)');
    $query->execute([$treatment,$symptom]);
    $query=$pdo->prepare('INSERT INTO tbl_doctor_symptom_help_votes(dr_id,sym_id,respondent_key) VALUES(?,?,?) ON DUPLICATE KEY UPDATE respondent_key=VALUES(respondent_key)');
    $query->execute([$treatment,$symptom,$respondent]);
}
