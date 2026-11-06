<?php
require_once __DIR__.'/_lcn_db.php';
require_once __DIR__.'/_feedback_smtp.php';

/** The transport can be replaced in tests; a true result only confirms handoff. */
function fbNotifyPrivateReport(int $id, string $message, ?string $replyTo, string $page, ?callable $transport=null): bool {
 try{
 $to=lcnEnv('LCN_FEEDBACK_NOTIFY_TO','feedback@lcnavi.de');
 $from=lcnEnv('LCN_FEEDBACK_NOTIFY_FROM',lcnEnv('LCN_SUBMISSION_NOTIFY_FROM',lcnEnv('LCN_MONITOR_FROM','feedback@lcnavi.de')));
 }catch(Throwable $error){error_log('LCN feedback notification: configuration unavailable for report #'.$id);return false;}
 foreach([$to,$from] as $address){if(!is_string($address)||preg_match('/[\r\n]/',$address)||!filter_var($address,FILTER_VALIDATE_EMAIL)){error_log('LCN feedback notification: invalid mail configuration for report #'.$id);return false;}}
 $headers=['From: '.$from,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 8bit'];
 if($replyTo!==null&&filter_var($replyTo,FILTER_VALIDATE_EMAIL)&&!preg_match('/[\r\n]/',$replyTo))$headers[]='Reply-To: '.$replyTo;
 $subject='LCN: Vertrauliches Feedback #'.$id;
 $body="Neues vertrauliches Feedback #".$id."\n\n".$message."\n\nSeitenbezug: ".($page!==''?$page:'Ohne Seitenbezug')."\nKontakt für Rückfragen: ".($replyTo?:'Nicht angegeben')."\n";
 try{$sent=$transport? $transport($to,$subject,$body,implode("\r\n",$headers)) : fbSmtpSend($to,$subject,$body,implode("\r\n",$headers));}
 catch(Throwable $error){$sent=false;}
 if(!$sent)error_log('LCN feedback notification: mail handoff failed for report #'.$id.'; message remains in feedback administration.');
 return (bool)$sent;
}
