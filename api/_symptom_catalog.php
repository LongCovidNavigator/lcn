<?php
require_once __DIR__.'/_site_auth.php';
require_once __DIR__.'/_voting.php';

function symText(array $in,string $key,int $max,int $min=0): string {
    $v=$in[$key]??'';
    if(!is_string($v)||mb_strlen(trim($v))<$min||mb_strlen($v)>$max)throw new InvalidArgumentException('Bitte das Feld „'.$key.'“ prüfen.');
    return trim($v);
}
function symCategories(PDO $p): array {
    return $p->query("SELECT DISTINCT TRIM(sym_category) FROM tbl_symptoms WHERE TRIM(COALESCE(sym_category,''))<>'' ORDER BY 1")->fetchAll(PDO::FETCH_COLUMN);
}
function symRecord(PDO $p,int $id,bool $lock=false): array {
    $q=$p->prepare('SELECT sym_id,sym_name,COALESCE(sym_category,\'\') sym_category FROM tbl_symptoms WHERE sym_id=?'.($lock?' FOR UPDATE':''));$q->execute([$id]);
    $r=$q->fetch();if(!$r)throw new InvalidArgumentException('Symptom nicht gefunden.');return $r;
}
function symReview(PDO $p,int $id,bool $approve): void {
    $q=$p->prepare('SELECT * FROM tbl_symptom_requests WHERE id=? FOR UPDATE');$q->execute([$id]);$r=$q->fetch();
    if(!$r||$r['status']!=='pending')throw new InvalidArgumentException('Dieser Vorschlag wurde bereits geprüft oder existiert nicht.');
    if($approve){
        if($r['sym_id']){
            $sym=symRecord($p,(int)$r['sym_id'],true);
            if($sym['sym_category']!==$r['category_snapshot'])throw new InvalidArgumentException('Die Kategorie wurde inzwischen geändert. Bitte den Vorschlag ablehnen und neu prüfen.');
            $p->prepare('UPDATE tbl_symptoms SET sym_category=? WHERE sym_id=?')->execute([$r['category'],$r['sym_id']]);
        }else{
            $q=$p->prepare('SELECT sym_id FROM tbl_symptoms WHERE LOWER(TRIM(sym_name))=LOWER(?) LIMIT 1');$q->execute([$r['name']]);
            if($q->fetchColumn())throw new InvalidArgumentException('Das Symptom existiert inzwischen. Bitte diesen Vorschlag ablehnen.');
            $p->prepare('INSERT INTO tbl_symptoms(sym_name,sym_category) VALUES(?,?)')->execute([$r['name'],$r['category']]);
        }
    }
    $p->prepare('UPDATE tbl_symptom_requests SET status=?,reviewed_at=NOW(),reviewed_by=? WHERE id=?')->execute([$approve?'approved':'rejected',lcnAuthenticatedWebUser()??'local-admin',$id]);
}

function symVoteCounts(PDO $p,int $id,string $category): array {
    $q=$p->prepare('SELECT vote,COUNT(*) total FROM tbl_symptom_category_votes WHERE sym_id=? AND category_snapshot=? GROUP BY vote');
    $q->execute([$id,$category]);$counts=['confirm'=>0,'disagree'=>0];
    foreach($q as $row)$counts[$row['vote']]=(int)$row['total'];
    return $counts;
}
