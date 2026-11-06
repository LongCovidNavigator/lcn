<?php
require_once __DIR__.'/../api/_feedback_notifications.php';
$envFile=tempnam(sys_get_temp_dir(),'lcn-feedback-test-');file_put_contents($envFile,"# Isolated notification test\n");putenv('LCN_ENV_FILE='.$envFile);register_shutdown_function(static fn()=>unlink($envFile));
putenv('LCN_FEEDBACK_NOTIFY_TO=feedback@example.org');putenv('LCN_FEEDBACK_NOTIFY_FROM=sender@example.org');
function verify($value){if(!$value)throw new RuntimeException('Notification test failed');}
$calls=[];$transport=function(...$args)use(&$calls){$calls[]=$args;return true;};
verify(fbNotifyPrivateReport(42,"Ein Titel\n\nEine Nachricht",'visitor@example.org','index.html',$transport));
verify(count($calls)===1);verify($calls[0][0]==='feedback@example.org');verify(str_contains($calls[0][2],"Ein Titel\n\nEine Nachricht"));verify(str_contains($calls[0][2],'index.html'));verify(str_contains($calls[0][3],'Reply-To: visitor@example.org'));
verify(!fbNotifyPrivateReport(43,'Test',null,'',fn()=>false));
putenv("LCN_FEEDBACK_NOTIFY_TO=bad\r\nBcc: injected@example.org");verify(!fbNotifyPrivateReport(44,'Test',null,'',$transport));verify(count($calls)===1);
echo "PASS: recipient, sender, title, message, context, reply-to, mail failure and header injection checks. No mail sent.\n";
