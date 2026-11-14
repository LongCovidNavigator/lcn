<?php
if(PHP_SAPI==='cli'){http_response_code(404);exit;}
header('Cache-Control: no-store');
if(!in_array(strtolower($_SERVER['HTTPS']??''),['on','1'],true)||($_SERVER['QUERY_STRING']??'')!==''){
 http_response_code(404);
 exit;
}
if(($_SERVER['REQUEST_METHOD']??'')!=='GET'){
 header('Allow: GET');
 http_response_code(405);
 exit;
}
require_once dirname(__DIR__).'/api/_feedback_archive_reminders.php';

try{
 $user=lcnEnv('LCN_FEEDBACK_ARCHIVE_CRON_USERNAME');
 $hash=lcnEnv('LCN_FEEDBACK_ARCHIVE_CRON_PASSWORD_HASH');
 if(!$user||!$hash||!hash_equals($user,(string)($_SERVER['PHP_AUTH_USER']??''))||!password_verify((string)($_SERVER['PHP_AUTH_PW']??''),$hash)){
  header('WWW-Authenticate: Basic realm="LCN feedback archive cron"');
  http_response_code(401);
  exit;
 }
 if(!str_starts_with(lcnDatabaseProfile()??'','ONLINE_')){
  http_response_code(404);
  exit;
 }
 fbRunArchiveReminders(lcnDatabase());
 http_response_code(204);
}catch(Throwable $error){
 lcnLogApiError('feedback_archive_reminders_http',$error);
 http_response_code(500);
}
