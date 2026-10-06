<?php
// User's editorial selection from 2026-08-16, plus IHHT. Order is not efficacy.
// `all` requires every component. Partial matches never count as confirmed.
function lcnEditorialTreatments(): array {
    require_once __DIR__.'/_doctor_hybrid.php';
    $rows=lcnDoctorDatabase()->query('SELECT treat_nd_id,treatmentname FROM tbl_treatments_nd WHERE is_top_treatment=1 ORDER BY treat_nd_id')->fetchAll();
    return array_map(fn($r)=>['label'=>$r['treatmentname'],'ids'=>[(int)$r['treat_nd_id']],'mode'=>'any','partial_ids'=>[]],$rows);
}

function lcnEditorialMatches(array $treatments): array {
    $ids=array_map('intval',array_column($treatments,'treat_id'));
    $matches=[]; $partial=[];
    foreach(lcnEditorialTreatments() as $index=>$entry){
        $found=array_values(array_intersect($entry['ids'],$ids));
        $confirmed=count($found)>0 && ($entry['mode']!=='all' || count($found)===count($entry['ids']));
        if($confirmed) $matches[]=['position'=>$index+1,'label'=>$entry['label'],'treat_ids'=>$found];
        else {
            $related=array_values(array_unique(array_merge($found,array_intersect($entry['partial_ids'],$ids))));
            if($related) $partial[]=['position'=>$index+1,'label'=>$entry['label'],'treat_ids'=>$related];
        }
    }
    return ['total'=>count(lcnEditorialTreatments()),'matched_count'=>count($matches),'matches'=>$matches,'partial'=>$partial];
}
