<?php
declare(strict_types=1);
require_once __DIR__.'/../api/_treatments_nd.php';
require_once __DIR__.'/../api/_treatment_discovery.php';
function discoveryCheck(bool $ok,string $message): void { if (!$ok) throw new RuntimeException($message); }
function sectionIds(array $nav,string $label): array {
    $ids=[];
    foreach($nav['sections'] as $s) if($s['label']===$label) foreach($s['entries'] as $e) if($e['treat_nd_id']) $ids[]=$e['treat_nd_id'];
    sort($ids); return $ids;
}
$pdo=lcnTreatmentsNdDatabase(); $graph=lcnTreatmentDiscoveryGraph($pdo);
$nav=fn(int $id)=>lcnTreatmentAliasNavigation($graph,$id);
discoveryCheck(count(sectionIds($nav(169),'Wirkstoff'))===9,'H1: expected nine substances.');
discoveryCheck(sectionIds($nav(84),'Handelsname')===[693],'Desloratadine must show Aerius.');
discoveryCheck(sectionIds($nav(693),'Wirkstoff')===[84] && sectionIds($nav(693),'Handelsname')===[],'Aerius must not show unrelated brands.');
discoveryCheck(sectionIds($nav(461),'Wirkstoff')===[30,31],'H2: use the existing H2-Blocker group.');
discoveryCheck(in_array(515,sectionIds($nav(271),'Verfahren'),true),'Psychotherapy omits EMDR.');
discoveryCheck(in_array(479,sectionIds($nav(176),'Verfahren'),true),'Breathing therapy omits Buteyko.');
discoveryCheck($nav(515)['sections'][0]['root']===271,'EMDR must link to its group.');
discoveryCheck(sectionIds($nav(869),'Anwendungsform')===[64,65,713],'NAD umbrella must show all forms.');
discoveryCheck(sectionIds($nav(65),'Anwendungsform')===[64,713],'NAD oral must omit itself from forms.');
discoveryCheck(sectionIds($nav(23),'Bestandteil')===[22,24],'Maraviroc combination has incorrect components.');
discoveryCheck(in_array(23,sectionIds($nav(22),'Kombinationstherapie'),true),'Missing combination backlink.');
discoveryCheck(sectionIds($nav(94),'Bestandteil')===[1,869],'LDN/NAD should link to canonical base entries.');
discoveryCheck(sectionIds($nav(95),'Bestandteil')===[16,411],'Procedure combination has incorrect components.');
discoveryCheck(sectionIds($nav(98),'Bestandteil')===[73,74,440],'Triple therapy must resolve its three components.');
discoveryCheck(sectionIds($nav(460),'Bestandteil')===[19,20],'Guanfacine/NAC components missing.');
discoveryCheck(sectionIds($nav(451),'Handelsname')===[78],'Combination must show its brand.');
discoveryCheck(sectionIds($nav(78),'Wirkstoffkombination')===[451],'Brand must link to combination.');
$unlinked=[]; foreach($nav(451)['sections'] as $s) if($s['label']==='Bestandteil') $unlinked=$s['entries'];
discoveryCheck(array_column($unlinked,'treatmentname')===['Nirmatrelvir','Ritonavir'] && array_column($unlinked,'treat_nd_id')===[null,null],'Unresolved components must be text, not invented URLs.');
discoveryCheck(sectionIds($nav(447),'Handelsname')===[456],'Lipitor must show Sortis as another brand.');
discoveryCheck($nav(4)['role']!=='trade','Low-dose aripiprazole must not become a brand.');
discoveryCheck(sectionIds($nav(439),'Wirkstoff')===[441],'Abilify should resolve to the base substance.');
$partial=array_filter($nav(397)['sections'],static fn($s)=>$s['label']==='Bestandteil');
discoveryCheck(!empty(array_values($partial)[0]['note']),'Incomplete compound names must not look like a complete ingredient list.');
$unrooted=false;
foreach($graph['groups'] as $g) if($g['name']==='Strategien zur Stressreduktion') {
    foreach($g['members'] as $id) {foreach($nav($id)['sections'] as $s) if($s['group']===$g['name']) $unrooted=true; break;}
}
discoveryCheck($unrooted,'Groups without a detail page must still be usable.');
$counts=['entries'=>0,'with_navigation'=>0,'groups'=>count($graph['groups']),'combination_entries'=>count($graph['comboIds'])];
foreach($graph['entries'] as $id=>$entry) {
    $n=$nav($id); $counts['entries']++; if($n['sections']) $counts['with_navigation']++;
    foreach($n['sections'] as $s) {
        if(!empty($s['feedback_key'])) lcnValidateTreatmentDiscoveryFeedback($pdo,$s['feedback_key'],$graph);
        foreach($s['entries'] as $e) {
            discoveryCheck(!empty($e['feedback_key']),'Missing feedback key on '.$id);
            lcnValidateTreatmentDiscoveryFeedback($pdo,$e['feedback_key'],$graph);
        }
        $ids=array_filter(array_column($s['entries'],'treat_nd_id'));
        discoveryCheck(!in_array($id,$ids,true),'Self-link on '.$id);
        discoveryCheck(count($ids)===count(array_unique($ids)),'Duplicate links on '.$id);
        foreach($ids as $target) discoveryCheck(isset($graph['entries'][$target]),'Dangling target.');
        discoveryCheck($s['root']!==$id,'Group self-link.');
    }
}
foreach(['ag:56:t:693','bn:84:691','cp:23:25','cn:451:'.str_repeat('0',24),'bs:693:84','ag:56:t:0','tr:999999999'] as $invalid) {
    $rejected=false;
    try { lcnValidateTreatmentDiscoveryFeedback($pdo,$invalid,$graph); }
    catch(InvalidArgumentException $e) { $rejected=true; }
    discoveryCheck($rejected,'Forged feedback key accepted: '.$invalid);
}
foreach(lcnNdRows($pdo,'SELECT relation_id FROM tbl_cpl_treatments_nd_relations') as $row) lcnValidateTreatmentDiscoveryFeedback($pdo,'tr:'.$row['relation_id'],$graph);
foreach([169,84,693,461,271,515,176,479,65,869,22,23,94,95,98,451,78,447,1,2] as $id) {
    $html=file_get_contents('http://localhost/lcn/therapie_detail.php?treatment_id='.$id);
    discoveryCheck(str_contains($http_response_header[0],'200'),'HTTP failure: '.$id);
    discoveryCheck(!str_contains($html,'ux-symptom-discovery') && !str_contains($html,'Über gemeinsame Symptome'),'Symptom discovery still visible.');
    discoveryCheck(!str_contains($html,'ux-alias-discovery'),'Unclassified alias discovery remains.');
    discoveryCheck(substr_count($html,'<h3>Alternative Therapien</h3>')===1,'Unified relationships missing.');
    discoveryCheck(!str_contains($html,'treatment_id=0'),'Unresolved target has fake link.');
}
echo 'PASS: medication/group/brand/form/combination logic, missing targets, all graph targets, 20 HTTP details. '.json_encode($counts,JSON_UNESCAPED_UNICODE)."\n";
