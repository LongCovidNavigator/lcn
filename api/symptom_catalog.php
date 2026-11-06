<?php
require_once __DIR__.'/_symptom_catalog.php';
header('Cache-Control: private, no-store');
try {
    if(lcnCurrentSiteRole()==='guest')lcnSendVoteJson(['ok'=>false,'error'=>'Bitte zuerst bei der Beta anmelden.'],403);
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if(!in_array($method,['GET','POST'],true)){header('Allow: GET, POST');lcnSendVoteJson(['ok'=>false,'error'=>'Methode nicht erlaubt.'],405);}
    $p=lcnDatabase();
    if($method==='GET'){
        $search=symText($_GET,'q',100,2);$term='%'.strtr($search,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';
        $q=$p->prepare("SELECT sym_id,sym_name,sym_category FROM tbl_symptoms WHERE sym_name LIKE ? ESCAPE '!' ORDER BY sym_name LIMIT 8");$q->execute([$term]);
        $exact=$p->prepare('SELECT sym_id FROM tbl_symptoms WHERE LOWER(TRIM(sym_name))=LOWER(?) LIMIT 1');$exact->execute([$search]);
        lcnSendVoteJson(['ok'=>true,'items'=>$q->fetchAll(),'exists'=>(bool)$exact->fetchColumn()]);
    }
    lcnRequireVotingRequest();$in=lcnReadJsonBody();$action=symText($in,'action',20,1);
    if($action==='review'){
        lcnRequireAdminJson();$id=filter_var($in['id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
        if(!$id||!isset($in['approve'])||!is_bool($in['approve']))throw new InvalidArgumentException('Ungültige Entscheidung.');
        $p->beginTransaction();symReview($p,$id,$in['approve']);$p->commit();lcnSendVoteJson(['ok'=>true,'message'=>'Prüfung gespeichert.']);
    }
    if(!in_array($action,['vote','category','add'],true))throw new InvalidArgumentException('Unbekannte Aktion.');
    $key=lcnVoterKey();
    $q=$p->prepare("SELECT COUNT(*) FROM tbl_symptom_requests WHERE voter_key=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 HOUR)");$q->execute([$key]);
    if($action!=='vote'&&(int)$q->fetchColumn()>=10)lcnSendVoteJson(['ok'=>false,'error'=>'Bitte warte eine Stunde, bevor du weitere Vorschläge sendest.'],429);
    $p->beginTransaction();$sym=null;
    if($action!=='add'){
        $id=filter_var($in['id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);if(!$id)throw new InvalidArgumentException('Ungültiges Symptom.');
        $sym=symRecord($p,$id,true);
        if(symText($in,'snapshot',255)!==$sym['sym_category'])throw new InvalidArgumentException('Die Kategorie wurde geändert. Bitte lade die Seite neu.');
    }
    if($action==='vote'){
        $vote=symText($in,'vote',10);if(!in_array($vote,['confirm','disagree'],true))throw new InvalidArgumentException('Ungültige Stimme.');
        if(trim($sym['sym_category'])==='')throw new InvalidArgumentException('Bitte schlage zuerst eine Kategorie vor.');
        $p->prepare('INSERT INTO tbl_symptom_category_votes(sym_id,voter_key,category_snapshot,vote) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE category_snapshot=VALUES(category_snapshot),vote=VALUES(vote)')->execute([$id,$key,$sym['sym_category'],$vote]);
        $counts=symVoteCounts($p,$id,$sym['sym_category']);$p->commit();lcnSendVoteJson(['ok'=>true,'counts'=>$counts,'message'=>$vote==='confirm'?'Kategorisierung bestätigt.':'Widerspruch gespeichert. Du kannst eine passendere Kategorie vorschlagen.','vote'=>$vote]);
    }
    $name=$sym?$sym['sym_name']:symText($in,'name',100,2);$category=symText($in,'category',100);$reason=symText($in,'reason',2000);
    if($action==='category'&&($category===''||$category===trim($sym['sym_category'])))throw new InvalidArgumentException('Bitte eine angepasste Kategorie angeben.');
    if($action==='add'){
        $q=$p->prepare('SELECT sym_id FROM tbl_symptoms WHERE LOWER(TRIM(sym_name))=LOWER(?) LIMIT 1');$q->execute([$name]);
        if($q->fetchColumn())throw new InvalidArgumentException('Dieses Symptom ist bereits vorhanden.');
    }
    $q=$p->prepare("SELECT id FROM tbl_symptom_requests WHERE voter_key=? AND COALESCE(sym_id,0)=? AND LOWER(name)=LOWER(?) AND category=? AND status='pending' LIMIT 1");$q->execute([$key,$sym?(int)$sym['sym_id']:0,$name,$category]);
    if($q->fetchColumn())throw new InvalidArgumentException('Dein gleicher Vorschlag wartet bereits auf Prüfung.');
    $p->prepare('INSERT INTO tbl_symptom_requests(sym_id,name,category,category_snapshot,reason,voter_key) VALUES(?,?,?,?,?,?)')->execute([$sym?$sym['sym_id']:null,$name,$category,$sym?$sym['sym_category']:'',$reason,$key]);
    $p->commit();lcnSendVoteJson(['ok'=>true,'message'=>'Danke! Dein Vorschlag wurde gespeichert und wird vor der Übernahme geprüft.'],201);
}catch(InvalidArgumentException $e){if(isset($p)&&$p->inTransaction())$p->rollBack();lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],400);}
catch(Throwable $e){if(isset($p)&&$p->inTransaction())$p->rollBack();lcnLogApiError('symptom_catalog',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Die Anfrage konnte gerade nicht gespeichert werden. Bitte versuche es später erneut.'],503);}
