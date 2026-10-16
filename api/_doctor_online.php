<?php
require_once __DIR__.'/_doctor_hybrid.php';

function lcnDoctorOnlineAccess(PDO $pdo,bool $dummy=false): array {
    $result=[];
    foreach($pdo->query('SELECT lcn_id,ersttermin_video,folgetermin_video FROM tbl_entities_nd WHERE aktiv=1') as $row){
        $result[(int)$row['lcn_id']]=['first'=>mb_strtolower(trim((string)$row['ersttermin_video']))==='ja','follow'=>mb_strtolower(trim((string)$row['folgetermin_video']))==='ja'];
    }
    $counts=[];
    foreach($dummy?['doctor_community_answers','doctor_community_dummy_answers']:['doctor_community_answers'] as $table){
        foreach($pdo->query("SELECT dr_id,question_key,option_value,COUNT(*) n FROM $table WHERE question_key IN ('appointment_first_video','appointment_followup_video') GROUP BY dr_id,question_key,option_value") as $row){
            $kind=$row['question_key']==='appointment_first_video'?'first':'follow';
            $counts[(int)$row['dr_id']][$kind][(int)$row['option_value']]=($counts[(int)$row['dr_id']][$kind][(int)$row['option_value']]??0)+(int)$row['n'];
        }
    }
    foreach($counts as $id=>$questions){
        $result[$id]??=['first'=>false,'follow'=>false];
        foreach($questions as $kind=>$options){$yes=$options[1]??0;$no=$options[2]??0;if($yes+$no>=10)$result[$id][$kind]=$yes>$no;}
    }
    foreach($result as &$row)$row['complete']=$row['first']&&$row['follow'];unset($row);
    return $result;
}
