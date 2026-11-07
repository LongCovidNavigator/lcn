<?php
require_once __DIR__.'/../scripts/prepare_feedback.php';
require_once __DIR__.'/../api/_feedback_images.php';
$_COOKIE[LCN_VOTER_COOKIE]=str_repeat('1',64);$_SERVER['REMOTE_ADDR']='feedback-image-test';
function ck($value,$message){if(!$value)throw new RuntimeException($message);echo "PASS: $message\n";}
$p=fbLocalDatabase();
$bytes=file_get_contents(__DIR__.'/../assets/images/feedback/idea-01.webp');[$decoded,$mime]=fbImageDecode(json_encode(['success'=>true,'result'=>['image'=>base64_encode($bytes)]]));ck($decoded===$bytes&&$mime==='image/webp','valid provider image decoded and inspected');
foreach(['{}',json_encode(['success'=>true,'result'=>['image'=>base64_encode('<script>bad</script>')]]),json_encode(['success'=>false,'result'=>['image'=>base64_encode($bytes)]])] as $raw){try{fbImageDecode($raw);throw new LogicException('Invalid provider response accepted');}catch(RuntimeException $e){}}
ck(true,'malformed provider responses and non-images rejected');
$p->beginTransaction();try{
$p->exec("INSERT INTO tbl_feedback_ideas(title,description,category) VALUES('Image attachment test','Transactional attachment test','general')");$idea=(int)$p->lastInsertId();$id=bin2hex(random_bytes(16));
$p->prepare('INSERT INTO tbl_feedback_images(id,owner_key,mime_type,image_data) VALUES(?,?,?,?)')->execute([$id,str_repeat('f',64),$mime,$bytes]);
try{fbImageAttach($p,$id,$idea);throw new RuntimeException('Foreign image attached');}catch(InvalidArgumentException $e){ck(true,'another browser cannot attach the image');}
$p->prepare('UPDATE tbl_feedback_images SET owner_key=? WHERE id=?')->execute([lcnVoterKey(),$id]);fbImageAttach($p,$id,$idea);ck(fbImageIds($p,[$idea])[$idea]===$id,'image attaches to idea');
try{fbImageAttach($p,$id,$idea);throw new RuntimeException('Image reused');}catch(InvalidArgumentException $e){ck(true,'image cannot be reused');}
}finally{$p->rollBack();}
echo "All image fixtures rolled back; no external API calls.\n";
