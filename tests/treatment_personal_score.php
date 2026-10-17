<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../api/_treatment_answers.php';
$p=lcnDoctorDatabase();$profiles=lcnTreatmentComparisonProfiles($p);
$allowed=[];foreach($p->query("SELECT c.treat_nd_id,c.lcn_id FROM tbl_cpl_entities2treatments_nd c JOIN tbl_entities_nd e ON e.lcn_id=c.lcn_id AND e.aktiv=1 WHERE c.relation_status IN ('bestand','belegt')") as $r)$allowed[$r['treat_nd_id']][$r['lcn_id']]=true;
$count=0;foreach($profiles as $profile){if(!array_key_exists('providers',$profile))throw new RuntimeException('Provider locations missing');foreach($profile['providers'] as $provider){if(empty($allowed[$profile['id']][$provider['id']]))throw new RuntimeException('Unconfirmed provider included in score');if(!array_key_exists('lat',$provider)||!array_key_exists('lng',$provider))throw new RuntimeException('Coordinates missing');$count++;}}
echo 'PASS: '.count($profiles).' comparison profiles; '.$count.' confirmed provider locations; pending associations excluded. No writes.'.PHP_EOL;
