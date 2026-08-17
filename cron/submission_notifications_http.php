<?php
require_once dirname(__DIR__) . '/api/_submission_notifications.php';
if(PHP_SAPI==='cli'){http_response_code(404);exit;}
$expectedUser=lcnEnv('LCN_CRON_USERNAME');$expectedPasswordHash=lcnEnv('LCN_CRON_PASSWORD_HASH');$user=(string)($_SERVER['PHP_AUTH_USER']??'');$password=(string)($_SERVER['PHP_AUTH_PW']??'');
if($expectedUser===null||$expectedPasswordHash===null||!hash_equals($expectedUser,$user)||!password_verify($password,$expectedPasswordHash)){header('WWW-Authenticate: Basic realm="LCN internal cron"');http_response_code(401);exit;}
try{$result=lcnRunSubmissionNotifications(false);header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>true,'run_id'=>$result['run_id'],'delivery_status'=>$result['delivery_status'],'new_count'=>$result['new_count'],'pending_count'=>$result['pending_count']],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);}catch(Throwable $error){lcnLogApiError('submission_notifications_http',$error);http_response_code(500);header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>false,'error'=>'Notification failed.']);}
