<?php
declare(strict_types=1);
// CLI-only, idempotent creation of the group pages requested on 2026-10-21.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../api/_treatments_nd.php';
require_once __DIR__.'/../api/_treatment_discovery.php';
$pdo=lcnTreatmentsNdDatabase();
$apply=in_array('--apply',$argv,true);
$requested=[85=>'Kortikosteroide',178=>'Steroid trial',203=>'Wearables',179=>'Stimulanzien',215=>'stimulanznahe Ansätze',1578=>'Aminosäuren',1576=>'Achtsamkeit',1349=>'Expressives Schreiben / Journaling',1436=>'Folat'];
$result=[];
$pdo->beginTransaction();
try {
    foreach($requested as $aliasId=>$name) {
        $aliases=lcnNdRows($pdo,'SELECT alias,alias_type FROM tbl_aliases_03 WHERE alias_id=?',[$aliasId]);
        if(count($aliases)!==1 || $aliases[0]['alias']!==$name || $aliases[0]['alias_type']!=='umbrella_term') throw new RuntimeException('Unexpected alias: '.$aliasId);
        $pageName=$name==='Folat' ? 'Folat (Supplementierung)' : $name;
        $existing=lcnNdRows($pdo,'SELECT treat_nd_id FROM tbl_treatments_nd WHERE treatmentname=?',[$pageName]);
        $created=false;
        if($existing) $id=(int)$existing[0]['treat_nd_id'];
        else {
            $pdo->prepare("INSERT INTO tbl_treatments_nd(treatmentname,legacy_match_status,review_status,datenstand,notes_internal) VALUES(?,'new','vor_review',CURRENT_DATE,?)")
                ->execute([$pageName,'Gruppeneintrag auf Nutzerwunsch vom 2026-10-21; vorhandener umbrella_term Alias '.$aliasId.'. Keine medizinischen Angaben ergänzt.']);
            $id=(int)$pdo->lastInsertId(); $created=true;
            $primary=lcnNdRows($pdo,"SELECT alias_id FROM tbl_aliases_03 WHERE alias=? AND alias_type='primary_name' ORDER BY alias_id",[$pageName]);
            if($primary) $primaryId=(int)$primary[0]['alias_id'];
            else { $pdo->prepare("INSERT INTO tbl_aliases_03(alias,alias_type) VALUES(?,'primary_name')")->execute([$pageName]); $primaryId=(int)$pdo->lastInsertId(); }
            $pdo->prepare('INSERT INTO tbl_cpl_treatments_nd2aliases(treat_nd_id,alias_id,note) VALUES(?,?,?)')->execute([$id,$primaryId,'Gruppenseite angelegt auf Nutzerwunsch 2026-10-21.']);
        }
        if(!lcnNdRows($pdo,'SELECT id FROM tbl_cpl_treatments_nd2aliases WHERE treat_nd_id=? AND alias_id=?',[$id,$aliasId])) {
            $pdo->prepare('INSERT INTO tbl_cpl_treatments_nd2aliases(treat_nd_id,alias_id,note) VALUES(?,?,?)')->execute([$id,$aliasId,'Eigene Detailseite der vorhandenen Alias-Gruppe; Nutzerwunsch 2026-10-21.']);
        }
        $result[]=['alias'=>$name,'id'=>$id,'page'=>$pageName,'created'=>$created];
    }
    $graph=lcnTreatmentDiscoveryGraph($pdo);
    foreach($result as $row) {
        $aliasId=array_search($row['alias'],$requested,true);
        if(($graph['groups'][$aliasId]['root']??null)!==$row['id']) throw new RuntimeException('Group page did not resolve: '.$row['alias']);
    }
    if($apply) $pdo->commit(); else $pdo->rollBack();
    echo json_encode(['applied'=>$apply,'pages'=>$result],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE).PHP_EOL;
} catch(Throwable $e) { if($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
