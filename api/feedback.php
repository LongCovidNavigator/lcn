<?php
require_once __DIR__.'/_feedback_images.php';
require_once __DIR__.'/_feedback_page_reference.php';
require_once __DIR__.'/_feedback_notifications.php';
require_once __DIR__.'/_search_normalization.php';
header('Cache-Control: private, no-store');
try {
 $method=$_SERVER['REQUEST_METHOD']??'GET';$write=$method==='POST';
 if(!in_array($method,['GET','POST'],true)){header('Allow: GET, POST');lcnSendVoteJson(['ok'=>false,'error'=>'Methode nicht erlaubt.'],405);}
 if($write){lcnRequireVotingRequest();$raw=(string)file_get_contents('php://input');if(strlen($raw)>50000)lcnSendVoteJson(['ok'=>false,'error'=>'Die Nachricht ist zu groß.'],413);$in=json_decode($raw,true);if(!is_array($in)||array_is_list($in))throw new InvalidArgumentException('Ungültige JSON-Anfrage.');}else $in=$_GET;
 $action=$in['action']??'list';if(!is_string($action))throw new InvalidArgumentException('Ungültige Aktion.');
 $admin=str_starts_with($action,'admin_');if($admin)lcnRequireAdminJson();
 // The web server's existing HTTP authentication protects the online beta;
 // additionally fail closed for unauthenticated requests to this new subsystem.
 if(lcnCurrentSiteRole()==='guest')lcnSendVoteJson(['ok'=>false,'error'=>'Bitte zuerst bei der Beta anmelden.'],403);
 if($action==='config'&&!$write){lcnVotingToken();lcnSendVoteJson(['ok'=>true,'categories'=>LCN_FEEDBACK_CATEGORIES,'statuses'=>LCN_FEEDBACK_STATUSES,'report_categories'=>LCN_FEEDBACK_REPORTS,'admin'=>lcnCurrentSiteRole()==='admin','image_generation'=>fbImageEnabled() && fbImagesReady(lcnDatabase()),'image_selection'=>fbImagesReady(lcnDatabase())]);}
 $p=lcnDatabase();
 if(!$write&&$action==='reference_info'){$type=fbChoice($in,'entity_type',['doctor'=>1,'treatment'=>1,'symptom'=>1]);$id=fbId($in['entity_id']??null);lcnSendVoteJson(['ok'=>true,'id'=>$id,'label'=>fbReferenceLabel($p,$type,$id)]);}
 if(!$write&&$action==='reference_search'){
  $type=fbChoice($in,'type',['doctor'=>1,'treatment'=>1]);$term=lcnNormalizeSearchTerm(fbText($in,'q',100));
  if($type==='doctor'){
   $base='SELECT lcn_id id,anzeigename label FROM tbl_entities_nd WHERE aktiv=1';
   $label=lcnNormalizedSearchSql('anzeigename');$alternate=lcnNormalizedSearchSql('organisationsname');
   $predicate="$label LIKE ? ESCAPE '!' OR $alternate LIKE ? ESCAPE '!'";
   $candidates="SELECT anzeigename term FROM tbl_entities_nd WHERE aktiv=1 UNION SELECT organisationsname FROM tbl_entities_nd WHERE aktiv=1";
  }else{
   $base="SELECT t.treat_nd_id id,t.treatmentname label FROM tbl_treatments_nd t WHERE t.review_status<>'rejected_group'";
   $label=lcnNormalizedSearchSql('t.treatmentname');$alternate=lcnNormalizedSearchSql('a.alias');
   $aliases='FROM tbl_cpl_treatments_nd2aliases c JOIN tbl_aliases_03 a ON a.alias_id=c.alias_id';
   $predicate="$label LIKE ? ESCAPE '!' OR EXISTS(SELECT 1 $aliases WHERE c.treat_nd_id=t.treat_nd_id AND $alternate LIKE ? ESCAPE '!')";
   $candidates="SELECT t.treatmentname term FROM tbl_treatments_nd t WHERE t.review_status<>'rejected_group' UNION SELECT a.alias $aliases JOIN tbl_treatments_nd t ON t.treat_nd_id=c.treat_nd_id WHERE t.review_status<>'rejected_group'";
  }
  $find=static function(array $terms)use($p,$base,$predicate,$label): array {
   $where=$terms?' AND ('.implode(' OR ',array_fill(0,count($terms),$predicate)).')':'';
   $order=$terms?"CASE WHEN $label=? THEN 0 WHEN $label LIKE ? ESCAPE '!' THEN 1 ELSE 2 END, ":'';
   $params=[];
   foreach($terms as $value){
    $like='%'.strtr($value,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';
    array_push($params,$like,$like);
   }
   if($terms)array_push($params,$terms[0],strtr($terms[0],['!'=>'!!','%'=>'!%','_'=>'!_']).'%');
   $q=$p->prepare("$base$where ORDER BY {$order}label,id LIMIT 10");
   $q->execute($params);return $q->fetchAll();
  };
  $items=$find($term===''?[]:[$term]);
  if(!$items&&mb_strlen($term)>=4){
   $matches=lcnFuzzySearchTerms($term,$p->query($candidates)->fetchAll(PDO::FETCH_COLUMN));
   if($matches)$items=$find(array_map('lcnNormalizeSearchTerm',$matches));
  }
  lcnSendVoteJson(['ok'=>true,'items'=>$items]);
 }
 if($write){
  $allowed=['create','comment','vote','report','admin_idea','admin_idea_reject','admin_idea_classify','admin_comment','admin_report','admin_merge'];
  if(!in_array($action,$allowed,true))throw new InvalidArgumentException('Unbekannte Schreibaktion.');
  fbRate($p,$admin?'admin':$action,$admin?100:($action==='vote'?60:8));
  if($action==='create'){
   $title=fbText($in,'title',180,5);$body=fbText($in,'description',8000,15);$cat=fbChoice($in+['category'=>'general'],'category',LCN_FEEDBACK_CATEGORIES);[$type,$entity]=fbContext($p,$in);
   $image=fbText($in,'image_id',32);$choice=$in['image_choice']??'';
   if($image!==''||$choice!==''){if(!fbImagesReady($p))throw new InvalidArgumentException('Die Bildauswahl ist noch nicht verfügbar.');}
   $email=fbEmail($in);$display=fbText($in,'display_name',80)?:null;$page=fbReferencePath($in);$section=fbText($in,'page_section',180);$element=fbText($in,'page_element',180);
   $p->beginTransaction();
   $p->prepare('INSERT INTO tbl_feedback_ideas(title,description,category,display_name,email,entity_type,entity_id) VALUES(?,?,?,?,?,?,?)')->execute([$title,$body,$cat,$display,$email,$type,$entity]);$id=(int)$p->lastInsertId();
   if($page!=='')$p->prepare('INSERT INTO tbl_feedback_page_references(idea_id,page_path,section_label,element_label) VALUES(?,?,?,?)')->execute([$id,$page,$section?:null,$element?:null]);
   if($image!=='')fbImageAttach($p,$image,$id);
   elseif($choice!==''){
    $choice=filter_var($choice,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>9]]);if(!$choice)throw new InvalidArgumentException('Ungültiges Motiv.');
    $binary=file_get_contents(__DIR__.'/../assets/images/feedback/motif-'.str_pad((string)$choice,2,'0',STR_PAD_LEFT).'.webp');if($binary===false)throw new RuntimeException('Missing cover');
    $p->prepare('INSERT INTO tbl_feedback_images(id,owner_key,idea_id,mime_type,image_data) VALUES(?,?,?,?,?)')->execute([bin2hex(random_bytes(16)),lcnVoterKey(),$id,'image/webp',$binary]);
   }
   $p->commit();
   lcnSendVoteJson(['ok'=>true,'id'=>$id,'message'=>'Danke! Deine Idee wird geprüft und nach Freigabe veröffentlicht.'],201);
  }
  if($action==='report'){
   [$type,$entity]=fbContext($p,$in);$page=isset($in['reference_mode'])?fbReferencePath($in):fbText($in,'page_path',500);if($page!==''&&(str_contains($page,'://')||str_starts_with($page,'//')||preg_match('/[\x00-\x1f]/',$page)))throw new InvalidArgumentException('Bitte einen lokalen Seitenbezug angeben.');
   $message=fbText($in,'body',8000,10);$title=fbText($in,'title',180);if($title!=='')$message=$title."\n\n".$message;if(isset($in['reference_mode'])&&$page!==''){$section=fbText($in,'page_section',180);$element=fbText($in,'page_element',180);$lines=array_filter([$section!==''?'Reiter: '.$section:null,$element!==''?'Bereich: '.$element:null]);if($lines)$message.="\n\n— Seitenbezug —\n".implode("\n",$lines);}
   $p->prepare('INSERT INTO tbl_feedback_reports(category,body,email,page_path,entity_type,entity_id) VALUES(?,?,?,?,?,?)')->execute([fbChoice($in+['category'=>'general'],'category',LCN_FEEDBACK_REPORTS),$message,fbEmail($in),$page?:null,$type,$entity]);
   $reportId=(int)$p->lastInsertId();$mailAccepted=fbNotifyPrivateReport($reportId,$message,fbEmail($in),$page);
   lcnSendVoteJson(['ok'=>true,'message'=>$mailAccepted?'Danke! Deine vertrauliche Nachricht wurde gespeichert und zur E-Mail-Weiterleitung übergeben.':'Danke! Deine vertrauliche Nachricht wurde gespeichert. Die E-Mail-Weiterleitung ist derzeit nicht verfügbar; das LCN-Team kann sie im Adminbereich lesen.'],201);
  }
  $p->beginTransaction();
  if($action==='admin_merge'){fbMerge($p,fbId($in['id']??null),fbId($in['target_id']??null));}
  elseif($action==='admin_comment'){
   $id=fbId($in['id']??null);$state=fbChoice($in,'moderation',['pending'=>1,'approved'=>1,'rejected'=>1,'archived'=>1,'hidden'=>1,'deleted'=>1]);
   if($state==='deleted')$p->prepare('DELETE FROM tbl_feedback_comments WHERE id=?')->execute([$id]);else $p->prepare('UPDATE tbl_feedback_comments SET moderation=? WHERE id=?')->execute([$state,$id]);
  }elseif($action==='admin_report'){
   $id=fbId($in['id']??null);$state=fbChoice($in,'status',['open'=>1,'done'=>1,'rejected'=>1,'archived'=>1,'deleted'=>1]);
   if($state==='deleted')$p->prepare('DELETE FROM tbl_feedback_reports WHERE id=?')->execute([$id]);
   elseif($state==='archived')$p->prepare("UPDATE tbl_feedback_reports SET status='archived', email=NULL WHERE id=?")->execute([$id]);
   else $p->prepare('UPDATE tbl_feedback_reports SET status=? WHERE id=?')->execute([$state,$id]);
  }else{
   $id=fbId($in['id']??null);$idea=fbIdea($p,$id,true);
   if($action==='vote'||$action==='comment')fbPublic($idea);
   if($action==='vote'){
    if(!isset($in['supported'])||!is_bool($in['supported']))throw new InvalidArgumentException('Ungültiger Unterstützungszustand.');
    $key=lcnVoterKey();if($in['supported'])$p->prepare('INSERT IGNORE INTO tbl_feedback_votes(idea_id,voter_key) VALUES(?,?)')->execute([$id,$key]);else $p->prepare('DELETE FROM tbl_feedback_votes WHERE idea_id=? AND voter_key=?')->execute([$id,$key]);
    $q=$p->prepare('SELECT COUNT(*) FROM tbl_feedback_votes WHERE idea_id=?');$q->execute([$id]);$count=(int)$q->fetchColumn();
    $p->commit();lcnSendVoteJson(['ok'=>true,'votes'=>$count,'supported'=>$in['supported']]);
   }elseif($action==='comment'){
    $p->prepare('INSERT INTO tbl_feedback_comments(idea_id,body,display_name) VALUES(?,?,?)')->execute([$id,fbText($in,'body',4000,5),fbText($in,'display_name',80)?:null]);
   }elseif($action==='admin_idea_reject'){
    if($idea['merged_into']||$idea['moderation']!=='pending')throw new InvalidArgumentException('Diese Idee steht nicht mehr zur Prüfung.');
    $p->prepare("UPDATE tbl_feedback_ideas SET moderation='rejected' WHERE id=?")->execute([$id]);
    fbHistory($p,$id,'moderation','pending','rejected');
   }elseif($action==='admin_idea_classify'){
    if($idea['merged_into'])throw new InvalidArgumentException('Bitte den Zielvorschlag bearbeiten.');
    if(isset($in['status'])){
     if($idea['moderation']!=='approved')throw new InvalidArgumentException('Bitte die Idee zuerst freigeben.');
     $status=fbChoice($in,'status',LCN_FEEDBACK_STATUSES);
     if($status!==$idea['status']){
      $p->prepare('UPDATE tbl_feedback_ideas SET status=? WHERE id=?')->execute([$status,$id]);
      fbHistory($p,$id,'status',$idea['status'],$status,fbText($in,'reason',2000));
     }
    }else{
     $mod=fbChoice($in,'moderation',['pending'=>1,'approved'=>1,'rejected'=>1,'archived'=>1]);
     if($mod!==$idea['moderation']){
      $p->prepare('UPDATE tbl_feedback_ideas SET moderation=? WHERE id=?')->execute([$mod,$id]);
      fbHistory($p,$id,'moderation',$idea['moderation'],$mod);
     }
    }
   }elseif($action==='admin_idea'){
    if($idea['merged_into'])throw new InvalidArgumentException('Bitte den Zielvorschlag bearbeiten.');
    $status=fbChoice($in+['status'=>$idea['status']],'status',LCN_FEEDBACK_STATUSES);$mod=fbChoice($in+['moderation'=>$idea['moderation']],'moderation',['pending'=>1,'approved'=>1,'rejected'=>1,'archived'=>1]);$reason=fbText($in,'reason',2000);
    $p->prepare('UPDATE tbl_feedback_ideas SET title=?,description=?,category=?,status=?,moderation=?,team_reply=? WHERE id=?')->execute([fbText($in,'title',180,5),fbText($in,'description',8000,15),fbChoice($in+['category'=>'general'],'category',LCN_FEEDBACK_CATEGORIES),$status,$mod,fbText($in,'team_reply',4000),$id]);
    if($status!==$idea['status'])fbHistory($p,$id,'status',$idea['status'],$status,$reason);
    if($mod!==$idea['moderation'])fbHistory($p,$id,'moderation',$idea['moderation'],$mod);
   }
  }
  $p->commit();lcnSendVoteJson(['ok'=>true,'message'=>$action==='comment'?'Danke für deinen Kommentar!':'Gespeichert.']);
 }
 if($action==='list'){
  $where=["i.moderation='approved'","i.merged_into IS NULL"];$args=[];
  if(!empty($in['category'])){$where[]='i.category=?';$args[]=fbChoice($in+['category'=>'general'],'category',LCN_FEEDBACK_CATEGORIES);}
  if(!empty($in['status'])){$where[]='i.status=?';$args[]=fbChoice($in,'status',LCN_FEEDBACK_STATUSES);}
  $search=fbText($in,'q',180);if($search!==''){
   // Match meaningful words for pragmatic duplicate suggestions as well as full searches.
   $words=array_slice(preg_split('/\s+/u',$search,-1,PREG_SPLIT_NO_EMPTY),0,8);$parts=[];
   foreach($words as $word){if(mb_strlen($word)<3)continue;$parts[]='(i.title LIKE ? OR i.description LIKE ?)';$term='%'.strtr($word,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';$args[]=$term;$args[]=$term;}
   if($parts)$where[]='('.implode(' OR ',array_map(fn($v)=>str_replace('LIKE ?',"LIKE ? ESCAPE '!'",$v),$parts)).')';else $where[]='1=0';
  }
  $where=implode(' AND ',$where);$page=max(1,min(10000,(int)($in['page']??1)));$size=15;$offset=($page-1)*$size;
  $q=$p->prepare("SELECT COUNT(*) FROM tbl_feedback_ideas i WHERE $where");$q->execute($args);$total=(int)$q->fetchColumn();
  $sort=[
   'votes'=>'votes DESC,i.id DESC',
   'comments'=>'comments DESC,votes DESC,i.id DESC',
   'new'=>'i.created_at DESC,i.id DESC',
   'updated'=>'i.updated_at DESC,i.id DESC',
  ][$in['sort']??'votes']??'votes DESC,i.id DESC';
  $q=$p->prepare("SELECT i.id,i.title,i.description,i.category,i.status,i.created_at,i.updated_at,i.entity_type,i.entity_id,i.seed_key,
   (SELECT COUNT(*) FROM tbl_feedback_votes v WHERE v.idea_id=i.id) votes,
   (SELECT COUNT(*) FROM tbl_feedback_comments c WHERE c.idea_id=i.id AND c.moderation='approved') comments,
   EXISTS(SELECT 1 FROM tbl_feedback_votes v WHERE v.idea_id=i.id AND v.voter_key=?) supported
   FROM tbl_feedback_ideas i WHERE $where ORDER BY $sort LIMIT $size OFFSET $offset");$q->execute(array_merge([lcnExistingVoterKey()??''],$args));
  $items=$q->fetchAll();$images=fbImageIds($p,array_column($items,'id'));foreach($items as &$item)$item['image_id']=$images[$item['id']]??null;unset($item);
  lcnSendVoteJson(['ok'=>true,'items'=>$items,'total'=>$total,'page'=>$page,'offset'=>$offset,'pages'=>(int)ceil($total/$size)]);
 }
 if($action==='detail'){
  $id=fbId($in['id']??null);$r=fbIdea($p,$id);$seen=[];
  while($r['merged_into']){if(isset($seen[$r['id']]))throw new RuntimeException('Merge cycle');$seen[$r['id']]=true;$r=fbIdea($p,(int)$r['merged_into']);}
  fbPublic($r);$id=(int)$r['id'];$r['image_id']=fbImageIds($p,[$id])[$id]??null;unset($r['email'],$r['moderation']);$r['page_reference']=fbReadPageReference($p,$id);
  $q=$p->prepare('SELECT COUNT(*) FROM tbl_feedback_votes WHERE idea_id=?');$q->execute([$id]);$r['votes']=(int)$q->fetchColumn();
  $q=$p->prepare('SELECT 1 FROM tbl_feedback_votes WHERE idea_id=? AND voter_key=?');$q->execute([$id,lcnExistingVoterKey()??'']);$r['supported']=(bool)$q->fetchColumn();
  $page=max(1,min(10000,(int)($in['page']??1)));$offset=($page-1)*30;
  $q=$p->prepare("SELECT id,body,display_name,created_at FROM tbl_feedback_comments WHERE idea_id=? AND moderation='approved' ORDER BY created_at,id LIMIT 30 OFFSET $offset");$q->execute([$id]);$comments=$q->fetchAll();
  $q=$p->prepare("SELECT COUNT(*) FROM tbl_feedback_comments WHERE idea_id=? AND moderation='approved'");$q->execute([$id]);$total=(int)$q->fetchColumn();
  $q=$p->prepare("SELECT old_value,new_value,reason,created_at FROM tbl_feedback_history WHERE idea_id=? AND event_type='status' ORDER BY id DESC LIMIT 100");$q->execute([$id]);
  lcnSendVoteJson(['ok'=>true,'idea'=>$r,'comments'=>$comments,'comment_total'=>$total,'page'=>$page,'history'=>$q->fetchAll(),'merged'=>count($seen)>0]);
 }
 if($action==='admin_queue'){
  $kind=$in['kind']??'ideas';$tables=['ideas'=>'tbl_feedback_ideas','comments'=>'tbl_feedback_comments','reports'=>'tbl_feedback_reports'];if(!is_string($kind)||!isset($tables[$kind]))throw new InvalidArgumentException('Ungültiger Bereich.');
  $page=max(1,min(10000,(int)($in['page']??1)));$table=$tables[$kind];
  $filter='1=1';$args=[];if(!empty($in['state'])){$state=fbText($in,'state',16);$filter=($kind==='reports'?'status':'moderation').'=?';$args[]=$state;}
  if($kind==='ideas'&&!empty($in['status'])){$filter.=' AND status=?';$args[]=fbChoice($in,'status',LCN_FEEDBACK_STATUSES);}
  if(isset($in['focus_id'])){
   $focusId=fbId($in['focus_id']);
   $q=$p->prepare("SELECT COUNT(*) FROM $table WHERE $filter AND id>?");
   $q->execute([...$args,$focusId]);
   $page=intdiv((int)$q->fetchColumn(),30)+1;
  }
  $offset=($page-1)*30;
  $q=$p->prepare("SELECT * FROM $table WHERE $filter ORDER BY id DESC LIMIT 30 OFFSET $offset");$q->execute($args);$items=$q->fetchAll();if($kind==='ideas'){$images=fbImageIds($p,array_column($items,'id'));foreach($items as &$item)$item['image_id']=$images[$item['id']]??null;unset($item);}
  if($kind==='ideas'){foreach($items as &$item)$item['page_reference']=fbReadPageReference($p,(int)$item['id'],true);unset($item);}
  $q=$p->prepare("SELECT COUNT(*) FROM $table WHERE $filter");$q->execute($args);$total=(int)$q->fetchColumn();
  $stats=[];foreach(['pending_ideas'=>"SELECT COUNT(*) FROM tbl_feedback_ideas WHERE moderation='pending' AND merged_into IS NULL",'pending_comments'=>"SELECT COUNT(*) FROM tbl_feedback_comments WHERE moderation='pending'",'open_reports'=>"SELECT COUNT(*) FROM tbl_feedback_reports WHERE status='open'",'published'=>"SELECT COUNT(*) FROM tbl_feedback_ideas WHERE moderation='approved' AND merged_into IS NULL",'rejected_ideas'=>"SELECT COUNT(*) FROM tbl_feedback_ideas WHERE moderation='rejected'",'all_reports'=>"SELECT COUNT(*) FROM tbl_feedback_reports",'done_reports'=>"SELECT COUNT(*) FROM tbl_feedback_reports WHERE status='done'",'archived_reports'=>"SELECT COUNT(*) FROM tbl_feedback_reports WHERE status='archived'",'rejected_reports'=>"SELECT COUNT(*) FROM tbl_feedback_reports WHERE status='rejected'",'all_ideas'=>"SELECT COUNT(*) FROM tbl_feedback_ideas",'archived_ideas'=>"SELECT COUNT(*) FROM tbl_feedback_ideas WHERE moderation='archived'"] as $k=>$sql)$stats[$k]=(int)$p->query($sql)->fetchColumn();
  lcnSendVoteJson(['ok'=>true,'items'=>$items,'stats'=>$stats,'page'=>$page,'pages'=>(int)ceil($total/30),'total'=>$total]);
 }
 lcnSendVoteJson(['ok'=>false,'error'=>'Unbekannte Aktion.'],400);
}catch(InvalidArgumentException $e){if(isset($p)&&$p->inTransaction())$p->rollBack();lcnSendVoteJson(['ok'=>false,'error'=>$e->getMessage()],http_response_code()===404?404:400);}
catch(Throwable $e){if(isset($p)&&$p->inTransaction())$p->rollBack();lcnLogApiError('feedback',$e);lcnSendVoteJson(['ok'=>false,'error'=>'Die Anfrage konnte nicht verarbeitet werden. Bitte versuche es erneut.'],500);}
