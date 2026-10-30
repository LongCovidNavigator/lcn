<?php
/** Exercise the real search endpoint with and without coupling metadata, without committing writes. */
if(($argv[1]??'')==='--probe'){
 require_once __DIR__.'/../api/_treatments_nd.php';
 $p=lcnTreatmentsNdDatabase();
 if(($argv[4]??'')==='without'){
  $p->beginTransaction();$p->exec('UPDATE tbl_cpl_treatments_nd2aliases SET relation_type=NULL');
  register_shutdown_function(static function()use($p){if($p->inTransaction())$p->rollBack();});
 }
 $_GET=($argv[3]==='suggestions')?['alias_suggest'=>'1','q'=>$argv[2]]:['search'=>$argv[2],'search_mode'=>$argv[3],'limit'=>'100'];
 require __DIR__.'/../api/treatments_search.php';exit;
}
function searchProbe(string $term,string $mode,string $metadata): array {
 $process=proc_open([PHP_BINARY,__FILE__,'--probe',$term,$mode,$metadata],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
 $out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
 if(proc_close($process)!==0)throw new RuntimeException($err);
 $data=json_decode($out,true,512,JSON_THROW_ON_ERROR);
 if(empty($data['ok']))throw new RuntimeException($out);
 return $data;
}
$count=0;
foreach(['Magnesium','Psychotherapie','NAD','Allergoval'] as $term)foreach(['basic','alias_direct','alias_extended','suggestions'] as $mode){
 $with=searchProbe($term,$mode,'with');$without=searchProbe($term,$mode,'without');
 if($with!==$without)throw new RuntimeException('Search response changed: '.$term.' / '.$mode);
 $count++;
}
echo "PASS: $count full search responses identical with/without coupling metadata (basic, direct, extended, suggestions); all changes rolled back.\n";
