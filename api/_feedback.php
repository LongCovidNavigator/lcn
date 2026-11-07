<?php
require_once __DIR__.'/_site_auth.php';
require_once __DIR__.'/_voting.php';
const LCN_FEEDBACK_CATEGORIES = ['providers'=>'Behandler:innen','treatments'=>'Behandlungen','symptoms'=>'Symptome','navigation'=>'Suche und Navigation','reviews'=>'Bewertungen und Erfahrungen','general'=>'Allgemeine Verbesserungen'];
const LCN_FEEDBACK_STATUSES = ['open'=>'Offen','planned'=>'Geplant','progress'=>'In Arbeit','done'=>'Umgesetzt','deferred'=>'Zurückgestellt','declined'=>'Nicht vorgesehen'];
const LCN_FEEDBACK_REPORTS = ['error'=>'Fehler entdeckt','missing'=>'Fehlende Information','technical'=>'Technisches Problem','general'=>'Allgemeine Rückmeldung','other'=>'Sonstiges'];
function fbText(array $in,string $key,int $max,int $min=0): string {
 $v=$in[$key]??'';if(!is_string($v)||mb_strlen(trim($v))<$min||mb_strlen($v)>$max)throw new InvalidArgumentException('Bitte das Feld „'.$key.'“ prüfen ('.$min.'–'.$max.' Zeichen).');return trim($v);
}
function fbChoice(array $in,string $key,array $choices): string {
 $v=$in[$key]??null;if(!is_string($v)||!array_key_exists($v,$choices))throw new InvalidArgumentException('Ungültige Auswahl: '.$key);return $v;
}
function fbId($v): int {$id=filter_var($v,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);if(!$id)throw new InvalidArgumentException('Ungültige ID.');return $id;}
function fbEmail(array $in): ?string {$v=fbText($in,'email',254);if($v!==''&&!filter_var($v,FILTER_VALIDATE_EMAIL))throw new InvalidArgumentException('Bitte eine gültige E-Mail-Adresse eingeben.');return $v?:null;}
function fbContext(PDO $p,array $in): array {
 $type=$in['entity_type']??null;$id=$in['entity_id']??null;if(!$type&&!$id)return [null,null];
 $tables=['doctor'=>['tbl_entities_nd','lcn_id'],'treatment'=>['tbl_treatments_nd','treat_nd_id'],'symptom'=>['tbl_symptoms','sym_id']];
 if(!is_string($type)||!isset($tables[$type]))throw new InvalidArgumentException('Ungültiger Seitenbezug.');
 $id=fbId($id);[$table,$column]=$tables[$type];$q=$p->prepare("SELECT 1 FROM `$table` WHERE `$column`=?");$q->execute([$id]);if(!$q->fetchColumn())throw new InvalidArgumentException('Der zugeordnete Eintrag existiert nicht.');return [$type,$id];
}
function fbIdea(PDO $p,int $id,bool $lock=false): array {
 $q=$p->prepare('SELECT * FROM tbl_feedback_ideas WHERE id=?'.($lock?' FOR UPDATE':''));$q->execute([$id]);$r=$q->fetch();if(!$r)throw new InvalidArgumentException('Vorschlag nicht gefunden.');return $r;
}
function fbPublic(array $r): void {if($r['moderation']!=='approved'||$r['merged_into']){http_response_code(404);throw new InvalidArgumentException('Vorschlag nicht veröffentlicht.');}}
function fbHistory(PDO $p,int $id,string $type,?string $old,?string $new,string $reason=''): void {
 $p->prepare('INSERT INTO tbl_feedback_history(idea_id,event_type,old_value,new_value,reason,admin_name) VALUES(?,?,?,?,?,?)')->execute([$id,$type,$old,$new,$reason,lcnAuthenticatedWebUser()??'local-admin']);
}
function fbRate(PDO $p,string $action,int $maximum): void {
 $secret=lcnEnv('LCN_VOTER_SECRET');if(!$secret||strlen($secret)<32)throw new RuntimeException('Missing voter secret');
 $keys=[lcnVoterKey(),hash_hmac('sha256',$_SERVER['REMOTE_ADDR']??'local',$secret)];
 foreach($keys as $key){$bucket=hash('sha256',$action.':'.$key.':'.floor(time()/600));
 $p->prepare('INSERT INTO tbl_feedback_limits(bucket_key,hits,expires_at) VALUES(?,1,DATE_ADD(NOW(),INTERVAL 20 MINUTE)) ON DUPLICATE KEY UPDATE hits=hits+1')->execute([$bucket]);
 $q=$p->prepare('SELECT hits FROM tbl_feedback_limits WHERE bucket_key=?');$q->execute([$bucket]);if((int)$q->fetchColumn()>$maximum){header('Retry-After: 600');lcnSendVoteJson(['ok'=>false,'error'=>'Bitte warte einige Minuten, bevor du weitere Beiträge sendest.'],429);}}
 $p->exec('DELETE FROM tbl_feedback_limits WHERE expires_at<NOW()');
}
function fbMerge(PDO $p,int $source,int $target): void {
 if($source===$target)throw new InvalidArgumentException('Bitte zwei unterschiedliche Vorschläge wählen.');
 // Always lock in ID order; votes and comments acquire the same parent lock.
 $ids=[$source,$target];sort($ids);foreach($ids as $id)$rows[$id]=fbIdea($p,$id,true);
 if($rows[$source]['merged_into']||$rows[$target]['merged_into'])throw new InvalidArgumentException('Bereits zusammengeführte Vorschläge können nicht erneut gewählt werden.');
 $p->prepare('INSERT IGNORE INTO tbl_feedback_votes(idea_id,voter_key,created_at) SELECT ?,voter_key,created_at FROM tbl_feedback_votes WHERE idea_id=?')->execute([$target,$source]);
 $p->prepare('DELETE FROM tbl_feedback_votes WHERE idea_id=?')->execute([$source]);
 $p->prepare('UPDATE tbl_feedback_comments SET idea_id=? WHERE idea_id=?')->execute([$target,$source]);
 $p->prepare('UPDATE tbl_feedback_ideas SET merged_into=? WHERE id=?')->execute([$target,$source]);
 fbHistory($p,$source,'merge',null,(string)$target);fbHistory($p,$target,'merge',(string)$source,null,'Kommentare und Unterstützungen übernommen.');
}
