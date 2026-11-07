<?php
require_once __DIR__.'/_treatments_nd.php';

function lcnDoctorOnlineAccess(PDO $pdo,bool $dummy=false): array {
    $result=[];
    foreach($pdo->query('SELECT lcn_id,ersttermin_video,ersttermin_telefon,folgetermin_video,folgetermin_telefon FROM tbl_entities_nd WHERE aktiv=1') as $row){
        $yes=static fn($value)=>mb_strtolower(trim((string)$value))==='ja';
        $verified=in_array((int)$row['lcn_id'],LCN_VERIFIED_ONLINE_ONLY_DOCTOR_IDS,true);
        $editorial=in_array((int)$row['lcn_id'],LCN_VERIFIED_ONLINE_APPOINTMENT_DOCTOR_IDS,true);
        $first=$editorial||$verified&&($yes($row['ersttermin_video'])||$yes($row['ersttermin_telefon']));
        $follow=$editorial||$verified&&($yes($row['folgetermin_video'])||$yes($row['folgetermin_telefon']));
        $result[(int)$row['lcn_id']]=['first'=>$first,'follow'=>$follow,'researchedFirst'=>$first,'researchedFollow'=>$follow,'researchedComplete'=>$first&&$follow];
    }
    $counts=[];
    foreach(($dummy && lcnDummyDataAllowed())?['doctor_community_answers','doctor_community_dummy_answers']:['doctor_community_answers'] as $table){
        foreach($pdo->query("SELECT dr_id,question_key,option_value,COUNT(*) n FROM $table WHERE question_key IN ('appointment_first_video','appointment_followup_video') GROUP BY dr_id,question_key,option_value") as $row){
            $kind=$row['question_key']==='appointment_first_video'?'first':'follow';
            $counts[(int)$row['dr_id']][$kind][(int)$row['option_value']]=($counts[(int)$row['dr_id']][$kind][(int)$row['option_value']]??0)+(int)$row['n'];
        }
    }
    foreach($counts as $id=>$questions){
        $result[$id]??=['first'=>false,'follow'=>false];
        foreach($questions as $kind=>$options){$yes=$options[1]??0;$no=$options[2]??0;if($yes+$no>=10)$result[$id][$kind]=($result[$id][$kind==='first'?'researchedFirst':'researchedFollow']??false)||$yes>$no;}
    }
    foreach($result as &$row)$row['complete']=$row['first']&&$row['follow'];unset($row);
    return $result;
}

/** Therapies deliverable at home with a listed provider offering both remote appointments. */
function lcnTreatmentOnlineIds(PDO $pdo, bool $acceptsGkv = false): array
{
    $remote = lcnDoctorOnlineAccess($pdo);
    $rows = $pdo->query("SELECT t.treat_nd_id, t.typ, t.durchfuehrungssetting, c.lcn_id
        FROM tbl_treatments_nd t
        JOIN tbl_cpl_entities2treatments_nd c ON c.treat_nd_id = t.treat_nd_id
        WHERE c.relation_status IN ('bestand','belegt') AND c.lcn_id IS NOT NULL"
        . ($acceptsGkv ? " AND EXISTS (SELECT 1 FROM v_lcn_doctors d WHERE d.dr_id = c.lcn_id AND d.dr_accepts_gkv = 'yes')" : ''));
    $ids = [];
    foreach ($rows as $row) {
        if (($remote[(int)$row['lcn_id']]['complete'] ?? false) && lcnNdCanTreatAtHome($row)) {
            $ids[(int)$row['treat_nd_id']] = true;
        }
    }
    return $ids;
}
