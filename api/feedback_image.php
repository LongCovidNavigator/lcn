<?php
require_once __DIR__.'/_feedback_images.php';
header('Cache-Control: private, no-store');
try{
 if(lcnCurrentSiteRole()==='guest')lcnSendVoteJson(['ok'=>false,'error'=>'Bitte zuerst bei der Beta anmelden.'],403);
 $p=lcnDatabase();$method=$_SERVER['REQUEST_METHOD']??'GET';
 if($method==='GET'){
  if(!fbImagesReady($p))lcnSendVoteJson(['ok'=>false,'error'=>'Bild nicht gefunden.'],404);
  $id=fbImageToken($_GET['id']??null);$q=$p->prepare('SELECT x.*,i.moderation,i.merged_into FROM tbl_feedback_images x LEFT JOIN tbl_feedback_ideas i ON i.id=x.idea_id WHERE x.id=?');$q->execute([$id]);$r=$q->fetch();
  $public=$r&&$r['idea_id']&&$r['moderation']==='approved'&&!$r['merged_into'];
  $draft=$r&&!$r['idea_id']&&strtotime($r['created_at'])>time()-86400&&hash_equals($r['owner_key'],lcnExistingVoterKey()??'');
  if(!$r||(!$public&&!$draft&&lcnCurrentSiteRole()!=='admin'))lcnSendVoteJson(['ok'=>false,'error'=>'Bild nicht gefunden.'],404);
  header('Content-Type: '.$r['mime_type']);header('X-Content-Type-Options: nosniff');echo $r['image_data'];exit;
 }
 lcnRequireVotingRequest();
 if(!fbImageEnabled()||!fbImagesReady($p))lcnSendVoteJson(['ok'=>false,'error'=>'Die KI-Bilderstellung ist noch nicht eingerichtet. Bitte wähle ein vorhandenes Bild.'],503);
 $raw=(string)file_get_contents('php://input');if(strlen($raw)>5000)throw new InvalidArgumentException('Die Bildbeschreibung ist zu lang.');$in=json_decode($raw,true);if(!is_array($in)||array_is_list($in))throw new InvalidArgumentException('Ungültige Anfrage.');
 $subject=fbText($in,'prompt',500,5);
 [$binary,$mime]=fbImageGenerate($subject);$id=bin2hex(random_bytes(16));
 $p->prepare('DELETE FROM tbl_feedback_images WHERE idea_id IS NULL AND created_at<DATE_SUB(NOW(),INTERVAL 1 DAY)')->execute();
 $p->prepare('INSERT INTO tbl_feedback_images(id,owner_key,mime_type,image_data) VALUES(?,?,?,?)')->execute([$id,lcnVoterKey(),$mime,$binary]);
 lcnSendVoteJson(['ok'=>true,'image_id'=>$id,'url'=>'api/feedback_image.php?id='.$id],201);
}catch(InvalidArgumentException $e){lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],400);}
catch(Throwable $e){lcnLogApiError('feedback_image',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Das Bild konnte nicht erstellt werden. Bitte versuche es später oder wähle ein vorhandenes Bild.'],503);}
