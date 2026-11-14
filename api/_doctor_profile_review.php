<?php
require_once __DIR__.'/_doctor_profile_items.php';
require_once __DIR__.'/_profile_countries.php';

const LCN_PROFILE_REVIEW_FIELDS = [
    'identity'=>['name'=>'Name','organization'=>'Praxis / Organisation','type'=>'Einordnung'],
    'medical'=>['specialty'=>'Fachrichtungen','specializations'=>'Spezialisierungen','qualifications'=>'Zusatzqualifikationen'],
    'location'=>['address'=>'Adresse','country'=>'Land','additional'=>'Weitere Standorte'],
    'contact'=>['phone'=>'Telefon','email'=>'E-Mail','website'=>'Website'],
];
const LCN_PROFILE_REVIEW_TERMS = [
    'specialty'=>['tbl_fachrichtungen_nd','fachrichtung'],
    'specializations'=>['tbl_spezialisierungen_nd','spezialisierung'],
    'qualifications'=>['tbl_zusatzqualifikationen_nd','zusatzqualifikation'],
];
const LCN_PROFILE_REVIEW_COLUMNS = [
    'name'=>['anzeigename',255], 'organization'=>['organisationsname',255],
    'phone'=>['telefon',80], 'email'=>['email',255], 'website'=>['website',500],
];

function lcnProfileReviewGroups(PDO $pdo, ?int $doctorId = null): array {
    $where=$doctorId===null?'':' WHERE dr_id=?';
    $lock=$doctorId===null?'':' FOR UPDATE';
    $params=$doctorId===null?[]:[$doctorId];
    $legacy=$pdo->prepare('SELECT dr_id,section_key,respondent_key,stance,corrections,updated_at FROM doctor_profile_feedback'.$where.$lock);
    $legacy->execute($params);
    $fields=$pdo->prepare('SELECT dr_id,section_key,field_key,respondent_key,stance,correction,updated_at FROM doctor_profile_field_feedback'.$where.$lock);
    $fields->execute($params);
    $votes=[];
    foreach($legacy as $row){
        $values=json_decode($row['corrections']??'{}',true);
        if((int)$row['stance']===1)$values=array_fill_keys(array_keys(LCN_PROFILE_REVIEW_FIELDS[$row['section_key']]??[]),'');
        foreach(is_array($values)?$values:[] as $field=>$value){
            if(!is_string($value))continue;
            $key=implode(':',[$row['dr_id'],$row['section_key'],$field,$row['respondent_key']]);
            $votes[$key]=$row+['field_key'=>$field,'correction'=>$value];
        }
    }
    foreach($fields as $row){
        $key=implode(':',[$row['dr_id'],$row['section_key'],$row['field_key'],$row['respondent_key']]);
        $votes[$key]=$row;
    }
    $groups=[];
    foreach($votes as $row){
        $section=$row['section_key'];$field=$row['field_key'];$id=(int)$row['dr_id'];
        if(!isset(LCN_PROFILE_REVIEW_FIELDS[$section][$field]))continue;
        $key="$id:$section:$field";
        if((int)$row['stance']===1){
            $groups[$key]['confirm']=($groups[$key]['confirm']??0)+1;
        }elseif((int)$row['stance']===-1){
            $value=trim((string)$row['correction']);
            $hash=hash('sha256',$key.':'.mb_strtolower($value));
            $groups[$key]['proposals'][$hash]??=[
                'proposal_key'=>$hash,'existing_target_id'=>$id,'field'=>$field,
                'field_label'=>LCN_PROFILE_REVIEW_FIELDS[$section][$field],
                'correction'=>$value,'created_at'=>$row['updated_at'],'support'=>0
            ];
            $groups[$key]['proposals'][$hash]['support']++;
            $groups[$key]['proposals'][$hash]['created_at']=min($groups[$key]['proposals'][$hash]['created_at'],$row['updated_at']);
        }
    }
    $proposals=[];
    foreach($groups as $group)foreach($group['proposals']??[] as $key=>$proposal){
        $proposal['confirm_current']=$group['confirm']??0;
        $proposals[$key]=$proposal;
    }
    return $proposals;
}

function lcnProfileReviewCurrent(array $research,string $field): string {
    $entity=$research['entity'];
    $location=$research['locations'][0]??[];
    if(isset(LCN_PROFILE_REVIEW_TERMS[$field]))return implode("\n",array_unique(array_column($research[$field],'term_label')));
    if(isset(LCN_PROFILE_REVIEW_COLUMNS[$field])){
        $column=LCN_PROFILE_REVIEW_COLUMNS[$field][0];
        return (string)(($entity[$column]??'')?:($location['loc_'.$field]??''));
    }
    return match($field){
        'type'=>implode("\n",array_map('lcnProfileTypeValue',lcnProfileListValues((string)($entity['behandlertyp']??$entity['institutionstyp']??$entity['datensatztyp']??'')))),
        'country'=>(string)($location['loc_country']??''),
        'address'=>implode(', ',array_filter([
            trim(($location['loc_street']??'').' '.($location['loc_housenumber']??'')),
            trim(($location['loc_plz']??'').' '.($location['loc_city']??''))
        ])),
        'additional'=>implode("\n",array_map(static fn($loc)=>implode(', ',array_filter([
            $loc['loc_label'],$loc['loc_street'],$loc['loc_plz'],$loc['loc_city'],$loc['loc_country']
        ])),array_slice($research['locations'],1))),
    };
}

function lcnProfileReviewItem(array $proposal, array $research): array {
    $field=$proposal['field'];$current=lcnProfileReviewCurrent($research,$field);
    $proposal['name']=$research['entity']['anzeigename'];
    $proposal['current']=$current;
    $proposal['version']=hash('sha256',json_encode([$current,$research['locations'][0]['loc_id']??null],JSON_THROW_ON_ERROR));
    $proposal['can_apply']=isset(LCN_PROFILE_REVIEW_COLUMNS[$field])||isset(LCN_PROFILE_REVIEW_TERMS[$field])||($field==='country'&&!empty($research['locations']));
    if($field==='address'&&!empty($research['locations'])){
        $proposal['address_fields']=array_intersect_key($research['locations'][0],array_flip(['loc_street','loc_housenumber','loc_plz','loc_city']));
        $proposal['can_apply']=true;
    }
    return $proposal;
}

function lcnProfileReviewList(PDO $pdo): array {
    $groups=lcnProfileReviewGroups($pdo);
    $undoKeys=lcnReviewSnapshotKeys($pdo,'doctor_profile');
    $items=[];$research=[];
    foreach($pdo->query('SELECT proposal_key,decision,proposal,reviewed_at FROM doctor_profile_review_decisions') as $decision){
        unset($groups[$decision['proposal_key']]);
        $items[]=json_decode($decision['proposal'],true,512,JSON_THROW_ON_ERROR)+[
            'review_status'=>$decision['decision'],'reviewed_at'=>$decision['reviewed_at'],
            'can_reopen'=>isset($undoKeys[$decision['proposal_key']])
        ];
    }
    foreach($groups as $proposal){
        $id=$proposal['existing_target_id'];
        $research[$id]??=lcnDoctorResearch($pdo,$id);
        if(empty($research[$id]['entity']['aktiv']))continue;
        $items[]=lcnProfileReviewItem($proposal,$research[$id])+['review_status'=>'pending'];
    }
    return $items;
}

function lcnApplyProfileReview(PDO $pdo, array $item, array $research, array $input = []): void {
    $field=$item['field'];$value=$item['correction'];$id=$item['existing_target_id'];
    $locationId=$research['locations'][0]['loc_id']??null;
    if(isset(LCN_PROFILE_REVIEW_COLUMNS[$field])){
        [$column,$max]=LCN_PROFILE_REVIEW_COLUMNS[$field];
        $valid=mb_strlen($value)<=$max&&($field!=='name'||$value!=='');
        if($field==='email'&&$value!=='')$valid=$valid&&filter_var($value,FILTER_VALIDATE_EMAIL);
        if($field==='website'&&$value!=='')$valid=$valid&&filter_var($value,FILTER_VALIDATE_URL)&&in_array(strtolower(parse_url($value,PHP_URL_SCHEME)),['http','https'],true);
        if(!$valid)throw new DomainException('Der vorgeschlagene Wert ist für dieses Feld ungültig.');
        $stored=$value===''?null:$value;
        $pdo->prepare("UPDATE tbl_entities_nd SET $column=? WHERE lcn_id=?")->execute([$stored,$id]);
        if($locationId&&in_array($field,['phone','email','website'],true)){
            $pdo->prepare("UPDATE tbl_drs_locations_03 SET loc_$field=? WHERE loc_id=?")->execute([$stored,$locationId]);
        }
    }elseif(isset(LCN_PROFILE_REVIEW_TERMS[$field])){
        [$table,$column]=LCN_PROFILE_REVIEW_TERMS[$field];
        $desired=lcnProfileListValues($value);
        foreach($desired as $term)if(mb_strlen($term)>255)throw new DomainException('Ein vorgeschlagener Begriff ist zu lang.');
        $existing=$research[$field];
        $delete=$pdo->prepare("DELETE FROM $table WHERE id=? AND lcn_id=?");
        foreach($existing as $term)if(!in_array($term['term_label'],$desired,true))$delete->execute([$term['term_id'],$id]);
        $insert=$pdo->prepare("INSERT INTO $table (lcn_id,$column) VALUES (?,?)");
        foreach(array_diff($desired,array_column($existing,'term_label')) as $term)$insert->execute([$id,$term]);
    }elseif($field==='country'){
        if(!$locationId||!in_array($value,lcnProfileCountryCodes(),true))throw new DomainException('Für diese Änderung ist ein vorhandener Standort mit gültigem Ländercode erforderlich.');
        if($value!==$item['current'])$pdo->prepare('UPDATE tbl_drs_locations_03 SET loc_country=?,loc_lat=NULL,loc_lng=NULL,loc_geo_type=NULL WHERE loc_id=?')->execute([$value,$locationId]);
    }elseif($field==='address'&&$locationId){
        $address=$input['address']??null;
        if(!is_array($address))throw new DomainException('Bitte die Adresse in die einzelnen Felder eintragen.');
        $values=[];
        foreach(['loc_street'=>255,'loc_housenumber'=>40,'loc_plz'=>20,'loc_city'=>120] as $key=>$max){
            $part=$address[$key]??null;
            if(!is_string($part)||mb_strlen(trim($part))>$max)throw new DomainException('Bitte die Angaben zur Adresse prüfen.');
            $values[]=trim($part)?:null;
        }
        if(!array_filter($values))throw new DomainException('Bitte eine Adresse eintragen.');
        $pdo->prepare('UPDATE tbl_drs_locations_03 SET loc_street=?,loc_housenumber=?,loc_plz=?,loc_city=?,loc_lat=NULL,loc_lng=NULL,loc_geo_type=NULL WHERE loc_id=?')->execute([...$values,$locationId]);
    }else{
        throw new DomainException('Für dieses Feld ist eine strukturierte redaktionelle Änderung erforderlich.');
    }
}

function lcnDecideProfileReview(PDO $pdo, array $input): string {
    $id=filter_var($input['doctor_id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
    $key=$input['proposal_key']??'';
    $action=$input['action']??'';
    if(!$id||!is_string($key)||!preg_match('/^[a-f0-9]{64}$/D',$key)||!in_array($action,['approve','reject','reopen'],true))throw new DomainException('Ungültige Entscheidung.');
    $pdo->beginTransaction();
    $doctor=$pdo->prepare('SELECT lcn_id FROM tbl_entities_nd WHERE lcn_id=? AND aktiv=1 FOR UPDATE');
    $doctor->execute([$id]);
    if(!$doctor->fetchColumn())throw new DomainException('Das Behandlerprofil ist nicht mehr verfügbar.');
    $decided=$pdo->prepare('SELECT decision,proposal,reviewed_at,reviewed_by FROM doctor_profile_review_decisions WHERE proposal_key=? AND dr_id=?');
    $decided->execute([$key,$id]);
    $decision=$decided->fetch();
    if($action==='reopen'&&!$decision)throw new DomainException('Der Vorschlag ist bereits offen.');
    if($action!=='reopen'&&$decision)throw new DomainException('Der Vorschlag wurde bereits entschieden. Bitte lade die Übersicht neu.');
    $proposal=lcnProfileReviewGroups($pdo,$id)[$key]??null;
    if(!$proposal)throw new DomainException('Der Vorschlag wurde geändert oder zurückgenommen. Bitte lade die Übersicht neu.');
    if($action==='reopen'){
        if($decision['decision']==='approved')$decision['catalog_changes']=lcnUndoReviewApproval($pdo,'doctor_profile',$key);
        lcnRecordReviewReopen($pdo,'doctor_profile',$key,$decision);
        $pdo->prepare('DELETE FROM doctor_profile_review_decisions WHERE proposal_key=?')->execute([$key]);
        $pdo->commit();
        return 'pending';
    }
    $locations=$pdo->prepare('SELECT loc_id FROM tbl_drs_locations_03 WHERE dr_id=? FOR UPDATE');
    $locations->execute([$id]);
    $locations->fetchAll();
    $research=lcnDoctorResearch($pdo,$id);
    $item=lcnProfileReviewItem($proposal,$research);
    if($action==='approve'){
        if($item['version']!==($input['version']??null))throw new DomainException('Der hinterlegte Wert wurde geändert. Bitte lade die Übersicht neu.');
        $field=$item['field'];
        $scopes=[];
        if(isset(LCN_PROFILE_REVIEW_COLUMNS[$field]))$scopes[]=['tbl_entities_nd',['lcn_id'],['lcn_id'=>$id]];
        if(isset(LCN_PROFILE_REVIEW_TERMS[$field]))$scopes[]=[LCN_PROFILE_REVIEW_TERMS[$field][0],['id'],['lcn_id'=>$id]];
        if(in_array($field,['address','country','phone','email','website'],true)&&isset($research['locations'][0]['loc_id'])){
            $scopes[]=['tbl_drs_locations_03',['loc_id'],['loc_id'=>(int)$research['locations'][0]['loc_id']]];
        }
        $before=lcnReviewSnapshot($pdo,$scopes);
        lcnApplyProfileReview($pdo,$item,$research,$input);
        lcnSaveReviewSnapshot($pdo,'doctor_profile',$key,$scopes,$before);
        $item['applied_value']=lcnProfileReviewCurrent(lcnDoctorResearch($pdo,$id),$item['field']);
    }
    $status=$action==='approve'?'approved':'rejected';
    $pdo->prepare('INSERT INTO doctor_profile_review_decisions (proposal_key,dr_id,decision,proposal,reviewed_by) VALUES (?,?,?,?,?)')
        ->execute([$key,$id,$status,json_encode($item,JSON_THROW_ON_ERROR),lcnAuthenticatedWebUser()??'local-admin']);
    $pdo->commit();
    return $status;
}
