<?php
require_once dirname(__DIR__) . '/api/_submission_notifications.php';
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$dryRun=in_array('--dry-run',$argv??[],true);
try{$result=lcnRunSubmissionNotifications($dryRun);echo $result['body'];echo 'Delivery status: '.$result['delivery_status'].PHP_EOL;exit(0);}catch(Throwable $error){fwrite(STDERR,'Submission notification failed: '.$error->getMessage().PHP_EOL);exit(1);}
