<?php
require_once __DIR__.'/_search_normalization.php';
function lcnDuplicateNameKey(string $name): string {
 return preg_replace('/[^\pL\pN]+/u','',lcnNormalizeSearchTerm($name));
}
/** Identity names only: typed group, ingredient and brand relationships are not synonyms. */
function lcnTreatmentDuplicateCandidates(PDO $p,string $name,int $excludeId=0): array {
 $needle=lcnDuplicateNameKey($name);if($needle==='')return [];$items=[];
 $rows=$p->query("SELECT t.treat_nd_id,t.treatmentname,t.typ,t.review_status,a.alias,a.alias_type FROM tbl_treatments_nd t LEFT JOIN tbl_cpl_treatments_nd2aliases c ON c.treat_nd_id=t.treat_nd_id LEFT JOIN tbl_aliases_03 a ON a.alias_id=c.alias_id AND a.alias_type IN ('primary_name','abbreviation','alternate_name','long_name','long_form') WHERE t.review_status<>'rejected_group'");
 foreach($rows as $row){
  $id=(int)$row['treat_nd_id'];if($id===$excludeId)continue;$key=lcnDuplicateNameKey($row['treatmentname']);$kind=null;$rank=9;
  if($key===$needle){$kind='Gleiche Benennung';$rank=0;}
  elseif($row['alias']!==null&&lcnDuplicateNameKey($row['alias'])===$needle&&(!preg_match('/\s[+&]\s|\bKombi(?:nation)?\b/iu',$row['treatmentname'])||preg_match('/[+&]|\bKombi(?:nation)?\b/iu',$row['alias']))){$kind='Hinterlegter Name / Abkürzung: '.$row['alias'];$rank=1;}
  elseif(mb_strlen($needle)>=5&&abs(mb_strlen($needle)-mb_strlen($key))<=1&&levenshtein($needle,$key)===1){$kind='Ähnliche Schreibweise – bitte prüfen';$rank=2;}
  if($kind===null||isset($items[$id])&&$items[$id]['rank']<=$rank)continue;
  $items[$id]=['id'=>$id,'label'=>$row['treatmentname'],'meta'=>implode(' · ',array_filter([$kind,$row['typ'],$row['review_status']==='pending_group'?'Prüfung ausstehend':null])),'match_kind'=>$rank===2?'spelling':'identity','rank'=>$rank,'detail_url'=>'therapie_detail.php?treatment_id='.$id];
 }
 $items=array_values($items);usort($items,fn($a,$b)=>($a['rank']<=>$b['rank'])?:strnatcasecmp($a['label'],$b['label']));return array_slice($items,0,8);
}
