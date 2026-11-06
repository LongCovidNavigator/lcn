<?php
require_once __DIR__.'/_feedback.php';
const FB_REFERENCE_PAGES=[
 'index.html'=>'Startseite','top_behandler.html'=>'Top-Behandler:innen','top_therapien.html'=>'Top-Therapien',
 'hausarzt_suche.html'=>'Hausärzt:innen','behandler_suche.html'=>'Behandler:innen-Suche','therapien_suche.html'=>'Therapie-Suche',
 'behandler_vorschlagen.html'=>'Behandler:in vorschlagen','behandlung_vorschlagen.html'=>'Therapie vorschlagen',
 'mitgestalten.html'=>'Mitgestalten','symptome.php'=>'Symptomübersicht','impressum.html'=>'Impressum','datenschutz.html'=>'Datenschutz',
 'arzt_detail.html'=>'Behandler-Detailseite','therapie_detail.php'=>'Therapie-Detailseite','therapie_detail.html'=>'Therapie-Detailseite'
];
function fbReferencePath(array $in): string {
 $path=fbText($in,'page_path',500);if(isset($in['reference_mode'])){$mode=fbChoice($in,'reference_mode',['confirm'=>1,'none'=>1,'other'=>1]);if($mode==='none'){if($path!==''||!empty($in['entity_type'])||!empty($in['entity_id']))throw new InvalidArgumentException('Bitte den Seitenbezug vollständig entfernen.');return '';}if($path==='')throw new InvalidArgumentException('Bitte den Seitenbezug bestätigen oder entfernen.');}if($path==='')return '';
 $parts=parse_url($path);if(!$parts||isset($parts['scheme'])||isset($parts['host'])||preg_match('/[\x00-\x20\\\\]/',$path))throw new InvalidArgumentException('Bitte eine Seite aus der Auswahl verwenden.');
 $file=$parts['path']??'';if(!isset(FB_REFERENCE_PAGES[$file]))throw new InvalidArgumentException('Unbekannte Seite im Seitenbezug.');
 parse_str($parts['query']??'',$query);$allowed=[];
 $type=$file==='arzt_detail.html'?'doctor':(in_array($file,['therapie_detail.php','therapie_detail.html'],true)?'treatment':null);
 if($type){$key=$type==='doctor'?'id':($file==='therapie_detail.php'?'treatment_id':(isset($query['nd_id'])?'nd_id':'treat_id'));$id=fbId($query[$key]??null);if(($in['entity_type']??null)!==$type||fbId($in['entity_id']??null)!==$id)throw new InvalidArgumentException('Seite und ausgewählter Eintrag passen nicht zusammen.');$allowed[$key]=$id;}
 elseif(!empty($in['entity_type'])&&$in['entity_type']!=='symptom')throw new InvalidArgumentException('Bitte eine passende Detailseite für den Eintrag wählen.');
 $hash=$parts['fragment']??'';if($hash!==''&&!preg_match('/^[a-z][a-z0-9_-]{0,63}$/i',$hash))throw new InvalidArgumentException('Ungültiger Seitenabschnitt.');
 return $file.($allowed?'?'.http_build_query($allowed):'').($hash!==''?'#'.$hash:'');
}
function fbReferenceLabel(PDO $p,string $type,int $id): string {
 fbContext($p,['entity_type'=>$type,'entity_id'=>$id]);
 [$table,$key,$name]=['doctor'=>['tbl_entities_nd','lcn_id','anzeigename'],'treatment'=>['tbl_treatments_nd','treat_nd_id','treatmentname'],'symptom'=>['tbl_symptoms','sym_id','sym_name']][$type];
 $q=$p->prepare("SELECT `$name` FROM `$table` WHERE `$key`=?");$q->execute([$id]);return (string)$q->fetchColumn();
}

function fbReadPageReference(PDO $p,int $id): ?array {
 $q=$p->prepare('SELECT page_path,section_label,element_label FROM tbl_feedback_page_references WHERE idea_id=?');$q->execute([$id]);$row=$q->fetch();if(!$row)return null;
 $file=parse_url($row['page_path'],PHP_URL_PATH);$row['label']=FB_REFERENCE_PAGES[$file]??'Zugehörige Seite';return $row;
}
