<?php
require_once __DIR__.'/_doctor_hybrid.php';
require_once __DIR__.'/_voting.php';
require_once __DIR__.'/_vote_abuse.php';
require_once __DIR__.'/_profile_countries.php';
require_once __DIR__.'/_doctor_profile_items.php';
header('Cache-Control: private, no-store');
try {
    $write=($_SERVER['REQUEST_METHOD']??'GET')==='POST';
    if($write){lcnRequireVotingRequest();$input=lcnReadJsonBody();}else $input=$_GET;
    $id=filter_var($input['id']??null,FILTER_VALIDATE_INT);
    if(!$id||!lcnDoctorExists($id))throw new InvalidArgumentException('Behandler nicht gefunden.');
    $fields=['identity'=>['name','organization','type'],'medical'=>['specialty','specializations','qualifications'],'location'=>['address','country','additional'],'contact'=>['phone','email','website']];
    $pdo=lcnDoctorDatabase();$listItems=lcnProfileListItems($pdo,$id);
    if($write){
        $section=$input['section']??'';$stance=$input['stance']??null;$field=$input['field']??null;
        if(!is_string($section)||!isset($fields[$section])||!in_array($stance,[-1,0,1],true)||($field!==null&&(!is_string($field)||!in_array($field,$fields[$section],true))))throw new InvalidArgumentException('Ungültige Rückmeldung.');
        $entry=$input['entry']??null;
        if($entry!==null&&(!is_string($entry)||!isset($listItems[$section][$field??''])||!in_array($entry,$listItems[$section][$field],true)||!in_array($stance,[0,1],true)||!empty($input['corrections'])||!empty($input['clear_fields'])))throw new InvalidArgumentException('Ungültiger Listeneintrag.');
        $corrections=$input['corrections']??[];$clear=$input['clear_fields']??[];
        if(!is_array($corrections)||count($corrections)>3||!is_array($clear)||count($clear)>3)throw new InvalidArgumentException('Ungültige Korrekturen.');
        foreach($corrections as $f=>$value){
            if(!in_array($f,$fields[$section],true)||!is_string($value)||mb_strlen($value)>2000||($field!==null&&$field!==$f))throw new InvalidArgumentException('Ungültiges Korrekturfeld.');
            $corrections[$f]=trim($value);
            if($f==='country'){$code=strtoupper(trim($value));if(!in_array($code,lcnProfileCountryCodes(),true))throw new InvalidArgumentException('Bitte ein Land aus der Länderauswahl auswählen.');$corrections[$f]=$code;}
            if($f==='type'){$types=array_values(array_unique(array_filter(array_map('trim',explode("\n",$value)),fn($v)=>$v!=='')));sort($types,SORT_STRING);if(!$types)throw new InvalidArgumentException('Bitte mindestens eine Einordnung auswählen.');$corrections[$f]=implode("\n",$types);}
        }
        foreach($clear as $f)if(!is_string($f)||!in_array($f,$fields[$section],true)||isset($corrections[$f]))throw new InvalidArgumentException('Ungültiges Feld zum Zurücknehmen.');
        if($stance===-1&&!count($corrections)&&!count($clear))throw new InvalidArgumentException('Bitte das zu korrigierende Feld wählen.');
        $user=lcnVoterKey();lcnBeginVoteSecurity($pdo,'doctor',$id,'neutral',$user);
        $lock='doctor-profile:'.substr(hash('sha256',$id.':'.$section.':'.$user),0,48);
        $q=$pdo->prepare('SELECT GET_LOCK(?,10)');$q->execute([$lock]);if((int)$q->fetchColumn()!==1)throw new RuntimeException('Rückmeldung wird gerade gespeichert.');
        $pdo->beginTransaction();
        // Expand the earlier whole-box vote once, preserving unaffected fields.
        $q=$pdo->prepare('SELECT stance,corrections FROM doctor_profile_feedback WHERE dr_id=? AND section_key=? AND respondent_key=? FOR UPDATE');$q->execute([$id,$section,$user]);
        if($legacy=$q->fetch(PDO::FETCH_ASSOC)){
            $values=json_decode($legacy['corrections']??'{}',true)?:[];
            foreach($fields[$section] as $f){$vote=(int)$legacy['stance']===1?1:(array_key_exists($f,$values)?-1:0);if($vote){$q=$pdo->prepare('INSERT IGNORE INTO doctor_profile_field_feedback(dr_id,section_key,field_key,respondent_key,stance,correction) VALUES(?,?,?,?,?,?)');$q->execute([$id,$section,$f,$user,$vote,$vote===-1?$values[$f]:null]);}}
            $pdo->prepare('DELETE FROM doctor_profile_feedback WHERE dr_id=? AND section_key=? AND respondent_key=?')->execute([$id,$section,$user]);
        }
        $delete=$pdo->prepare('DELETE FROM doctor_profile_field_feedback WHERE dr_id=? AND section_key=? AND field_key=? AND respondent_key=?');
        $save=$pdo->prepare('INSERT INTO doctor_profile_field_feedback(dr_id,section_key,field_key,respondent_key,stance,correction) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE stance=VALUES(stance),correction=VALUES(correction)');
        if($entry!==null){
            $q=$pdo->prepare('INSERT INTO doctor_profile_item_feedback(dr_id,section_key,field_key,item_hash,item_label,respondent_key,stance) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE stance=VALUES(stance)');
            $q->execute([$id,$section,$field,hash('sha256',$entry),$entry,$user,$stance]);
        }elseif($stance===-1){
            foreach($clear as $f){$delete->execute([$id,$section,$f,$user]);$pdo->prepare('DELETE FROM doctor_profile_item_feedback WHERE dr_id=? AND section_key=? AND field_key=? AND respondent_key=?')->execute([$id,$section,$f,$user]);}
            foreach($corrections as $f=>$value){
                $q=$pdo->prepare('SELECT stance FROM doctor_profile_field_feedback WHERE dr_id=? AND section_key=? AND field_key=? AND respondent_key=?');$q->execute([$id,$section,$f,$user]);
                if((int)$q->fetchColumn()===1)foreach($listItems[$section][$f]??[] as $item){$q=$pdo->prepare('INSERT IGNORE INTO doctor_profile_item_feedback(dr_id,section_key,field_key,item_hash,item_label,respondent_key,stance) VALUES(?,?,?,?,?,?,1)');$q->execute([$id,$section,$f,hash('sha256',$item),$item,$user]);}
            }
            foreach($corrections as $f=>$value)$save->execute([$id,$section,$f,$user,-1,$value]);
        }else foreach($field===null?$fields[$section]:[$field] as $f){
            $pdo->prepare('DELETE FROM doctor_profile_item_feedback WHERE dr_id=? AND section_key=? AND field_key=? AND respondent_key=?')->execute([$id,$section,$f,$user]);
            if($stance===0)$delete->execute([$id,$section,$f,$user]);else $save->execute([$id,$section,$f,$user,1,null]);
        }
        $pdo->commit();$pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]);unset($lock);
    }
    $pdo->beginTransaction(); // Read counters and proposals from one consistent snapshot.
    $viewer=lcnExistingVoterKey()??'';$people=[];
    $q=$pdo->prepare('SELECT section_key,respondent_key,stance,corrections FROM doctor_profile_feedback WHERE dr_id=?');$q->execute([$id]);
    foreach($q as $row){$values=json_decode($row['corrections']??'{}',true)?:[];foreach($fields[$row['section_key']]??[] as $f){$vote=(int)$row['stance']===1?1:(array_key_exists($f,$values)?-1:0);if($vote)$people[$row['respondent_key']][$row['section_key']][$f]=['stance'=>$vote,'correction'=>$vote===-1?$values[$f]:null];}}
    $q=$pdo->prepare('SELECT section_key,field_key,respondent_key,stance,correction FROM doctor_profile_field_feedback WHERE dr_id=?');$q->execute([$id]);
    foreach($q as $row)if(in_array($row['field_key'],$fields[$row['section_key']]??[],true))$people[$row['respondent_key']][$row['section_key']][$row['field_key']]=['stance'=>(int)$row['stance'],'correction'=>$row['correction']];
    $q=$pdo->prepare('SELECT section_key,field_key,item_label,respondent_key,stance FROM doctor_profile_item_feedback WHERE dr_id=?');$q->execute([$id]);$overrides=[];
    foreach($q as $row)if(in_array($row['item_label'],$listItems[$row['section_key']][$row['field_key']]??[],true))$overrides[$row['respondent_key']][$row['section_key']][$row['field_key']][$row['item_label']]=(int)$row['stance'];
    $itemVotes=lcnProfileApplyItemVotes($people,$listItems,$overrides,$viewer);
    $own=[];$totals=[];$fieldVotes=[];$proposals=[];
    foreach($fields as $section=>$keys){$totals[$section]=['confirm'=>0,'oppose'=>0];$own[$section]=['stance'=>0,'corrections'=>(object)[]];foreach($keys as $f)$fieldVotes[$section][$f]=['confirm'=>0,'oppose'=>0,'own'=>0];}
    foreach($people as $person=>$sections)foreach($sections as $section=>$values){
        $stances=array_column($values,'stance');$overall=in_array(-1,$stances,true)?-1:(count($values)===count($fields[$section])&&count(array_filter($stances,fn($v)=>$v===1))===count($fields[$section])?1:0);
        if($overall)$totals[$section][$overall===1?'confirm':'oppose']++;
        $corrections=[];
        foreach($values as $f=>$value){
            $vote=$value['stance'];if($vote!==0)$fieldVotes[$section][$f][$vote===1?'confirm':'oppose']++;
            if($person===$viewer)$fieldVotes[$section][$f]['own']=$vote;
            if($vote===-1){
                $choice=(string)$value['correction'];$corrections[$f]=$choice;$key=hash('sha256',$section.':'.$f.':'.mb_strtolower($choice));
                if(!isset($proposals[$key]))$proposals[$key]=['section'=>$section,'field'=>$f,'value'=>$choice,'count'=>0,'others'=>0,'own'=>false];
                $proposals[$key]['count']++;if($person===$viewer)$proposals[$key]['own']=true;else $proposals[$key]['others']++;
            }
        }
        if($person===$viewer)$own[$section]=['stance'=>$overall,'corrections'=>(object)$corrections];
    }
    $options=[];
    foreach(['specialty'=>['tbl_fachrichtungen_nd','fachrichtung'],'specializations'=>['tbl_spezialisierungen_nd','spezialisierung'],'qualifications'=>['tbl_zusatzqualifikationen_nd','zusatzqualifikation']] as $f=>[$table,$column])$options[$f]=$pdo->query("SELECT DISTINCT `$column` FROM `$table` WHERE `$column` IS NOT NULL AND TRIM(`$column`)<>'' ORDER BY `$column`")->fetchAll(PDO::FETCH_COLUMN);
    foreach($proposals as $proposal)if(isset($options[$proposal['field']]))foreach(explode("\n",$proposal['value']) as $term)if(trim($term)!=='')$options[$proposal['field']][]=trim($term);
    foreach($options as &$values){$values=array_values(array_unique($values));sort($values,SORT_NATURAL|SORT_FLAG_CASE);}unset($values);
    $proposals=array_values($proposals);usort($proposals,fn($a,$b)=>$b['count']<=>$a['count']);
    $pdo->commit();
    lcnSendVoteJson(['ok'=>true,'own'=>(object)$own,'totals'=>(object)$totals,'item_votes'=>$itemVotes,'country_codes'=>lcnProfileCountryCodes(),'field_votes'=>$fieldVotes,'options'=>$options,'proposals'=>$proposals]);
}catch(InvalidArgumentException $e){if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();if(isset($lock))$pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]);lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],400);}
catch(Throwable $e){if(isset($pdo)&&$pdo->inTransaction())$pdo->rollBack();if(isset($lock))$pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]);lcnLogApiError('doctor_profile_feedback',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Die Rückmeldung konnte nicht gespeichert werden. Bitte erneut versuchen.'],500);}
