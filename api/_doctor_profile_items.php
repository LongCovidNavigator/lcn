<?php
function lcnProfileListValues(string $value): array {
    return array_values(array_unique(array_filter(array_map('trim',explode("\n",$value)),fn($v)=>$v!=='')));
}
function lcnProfileTypeValue(string $value): string {
    $value=trim($value);
    return ['arzt'=>'doctor','ärztin'=>'doctor','arzt / ärztin'=>'doctor','ärzt:innen'=>'doctor','praxis'=>'practice','klinik'=>'clinic','anlaufstelle'=>'other'][mb_strtolower($value)]??$value;
}
function lcnProfileListItems(PDO $pdo,int $id): array {
    $research=lcnDoctorResearch($pdo,$id);$result=[];
    foreach(['specialty','specializations','qualifications'] as $field)$result['medical'][$field]=array_values(array_unique(array_column($research[$field]??[],'term_label')));
    $entity=$research['entity'];$type=$entity['behandlertyp']??$entity['institutionstyp']??$entity['datensatztyp']??'';
    $result['identity']['type']=array_values(array_unique(array_map('lcnProfileTypeValue',lcnProfileListValues($type))));
    $locations=$research['locations']??[];array_shift($locations);
    $result['location']['additional']=[];
    foreach($locations as $location)$result['location']['additional'][]=implode(', ',array_filter([$location['loc_label']??'',$location['loc_street']??'',$location['loc_plz']??'',$location['loc_city']??'',$location['loc_country']??''],fn($v)=>$v!==''&&$v!==null));
    return $result;
}
// Derive independent entry votes, retaining historical whole-field confirmations.
function lcnProfileApplyItemVotes(array &$people,array $lists,array $overrides,string $viewer): array {
    foreach($overrides as $person=>$sections)foreach($sections as $section=>$fields)foreach($fields as $field=>$items)$people[$person][$section][$field]??=['stance'=>0,'correction'=>null];
    $totals=[];
    foreach($lists as $section=>$fields)foreach($fields as $field=>$items)foreach($items as $item)$totals[$section][$field][$item]=['confirm'=>0,'oppose'=>0,'own'=>0];
    foreach($people as $person=>&$sections)foreach($lists as $section=>$fields)foreach($fields as $field=>$items){
        if(!$items||!isset($sections[$section][$field]))continue;
        $value=&$sections[$section][$field];$all=true;
        $proposed=$value['stance']===-1?lcnProfileListValues((string)$value['correction']):null;
        foreach($items as $item){
            $removed=$proposed!==null&&!in_array($item,$proposed,true);
            $stance=$removed?-1:($overrides[$person][$section][$field][$item]??($value['stance']===1?1:0));
            if($stance===1)$totals[$section][$field][$item]['confirm']++;
            if($stance===-1)$totals[$section][$field][$item]['oppose']++;
            if($person===$viewer)$totals[$section][$field][$item]['own']=$stance;
            if($stance!==1)$all=false;
        }
        if($value['stance']!==-1)$value['stance']=$all?1:0;
        unset($value);
    }
    unset($sections);
    return $totals;
}
