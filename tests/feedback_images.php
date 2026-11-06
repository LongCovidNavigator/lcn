<?php
require_once __DIR__.'/../scripts/prepare_feedback.php';
require_once __DIR__.'/../api/_feedback_images.php';
$_COOKIE[LCN_VOTER_COOKIE]=str_repeat('1',64);$_SERVER['REMOTE_ADDR']='feedback-image-test';
function ck($value,$message){if(!$value)throw new RuntimeException($message);echo "PASS: $message\n";}
$p=fbLocalDatabase();
// Temporary counters shadow the real table: quota tests cannot consume production allowances.
$p->exec('CREATE TEMPORARY TABLE tbl_feedback_limits (bucket_key CHAR(64) PRIMARY KEY,hits INT NOT NULL,expires_at DATETIME NOT NULL) ENGINE=InnoDB');
$draft=str_repeat('a',32);ck(fbImageReserve($p,$draft)===1,'first attempt reserved');ck(fbImageReserve($p,$draft)===0,'second attempt reserved');
try{fbImageReserve($p,$draft);throw new RuntimeException('Third attempt accepted');}catch(OverflowException $e){ck(true,'third draft attempt blocked');}
ck((int)$p->query('SELECT MAX(hits) FROM tbl_feedback_limits')->fetchColumn()===2,'failed reservation rolled back all counters');
for($i=0;$i<8;$i++)fbImageReserve($p,md5('draft'.$i));
try{fbImageReserve($p,md5('new'));throw new RuntimeException('Daily owner limit bypassed');}catch(OverflowException $e){ck(true,'daily owner/IP limit enforced');}
$p->exec('TRUNCATE TABLE tbl_feedback_limits');$bucket=hash('sha256','feedback-image:'.gmdate('Y-m-d').':global');$p->prepare('INSERT INTO tbl_feedback_limits VALUES(?,100,DATE_ADD(NOW(),INTERVAL 1 DAY))')->execute([$bucket]);
try{fbImageReserve($p,md5('global'));throw new RuntimeException('Global cap bypassed');}catch(OverflowException $e){ck(true,'global daily cap enforced');}
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
