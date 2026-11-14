<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once dirname(__DIR__).'/api/_feedback_archive_reminders.php';
try{
 if($argv===[$argv[0],'--test-mail']){
  if(!fbSendArchiveMail('LCN: Test der Archiv-Erinnerung',"Dies ist eine Testnachricht für die Löschfrist im LCN-Feedback-Archiv.\n"))throw new RuntimeException('Test mail was not accepted.');
  echo "Test mail accepted by SMTP.\n";
 }elseif($argv===[$argv[0],'--dry-run']){
  echo json_encode(fbRunArchiveReminders(lcnDatabase(),true),JSON_THROW_ON_ERROR).PHP_EOL;
 }else{
  fwrite(STDERR,"Use --dry-run or --test-mail. Scheduled reminders run via the HTTPS cron endpoint.\n");
  exit(1);
 }
}catch(Throwable $error){fwrite(STDERR,'Feedback archive reminder failed: '.$error->getMessage().PHP_EOL);exit(1);}
