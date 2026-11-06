<?php
/** Authenticated SMTP with implicit TLS and certificate verification. */
function fbSmtpSend(string $to, string $subject, string $body, string $headers): bool {
    $host=lcnEnv('LCN_FEEDBACK_SMTP_HOST','w021c680.kasserver.com');
    $port=(int)lcnEnv('LCN_FEEDBACK_SMTP_PORT','465');
    $user=lcnEnv('LCN_FEEDBACK_SMTP_USER','feedback@lcnavi.de');
    $password=lcnEnv('LCN_FEEDBACK_SMTP_PASSWORD');
    if(!$password)throw new RuntimeException('Feedback SMTP password is not configured.');
    if(!preg_match('/^[a-z0-9.-]+$/i',$host)||$port<1||$port>65535)throw new RuntimeException('Invalid SMTP server configuration.');
    if(!preg_match('/^From: ([^\r\n]+)\r?$/m',$headers,$match))throw new RuntimeException('Missing SMTP sender.');
    $from=trim($match[1]);
    foreach([$to,$from] as $address)if(!filter_var($address,FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$address))throw new RuntimeException('Invalid SMTP address.');
    $context=stream_context_create(['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'peer_name'=>$host]]);
    $socket=stream_socket_client('ssl://'.$host.':'.$port,$errno,$error,15,STREAM_CLIENT_CONNECT,$context);
    if(!$socket)throw new RuntimeException('Feedback SMTP connection failed.');
    stream_set_timeout($socket,15);
    try {
        fbSmtpExpect($socket,[220]);
        fbSmtpCommand($socket,'EHLO localhost',[250]);
        fbSmtpCommand($socket,'AUTH LOGIN',[334]);
        fbSmtpCommand($socket,base64_encode($user),[334]);
        fbSmtpCommand($socket,base64_encode($password),[235]);
        fbSmtpCommand($socket,'MAIL FROM:<'.$from.'>',[250]);
        fbSmtpCommand($socket,'RCPT TO:<'.$to.'>',[250,251]);
        fbSmtpCommand($socket,'DATA',[354]);
        $data='To: '.$to."\r\nSubject: =?UTF-8?B?".base64_encode($subject)."?=\r\nDate: ".date(DATE_RFC2822)."\r\n".$headers."\r\n\r\n".$body;
        $data=preg_replace('/\r\n|\r|\n/',"\r\n",$data);
        $data=preg_replace('/^\./m','..',$data);
        fbSmtpWrite($socket,rtrim($data,"\r\n")."\r\n.\r\n");
        fbSmtpExpect($socket,[250]);
        // Acceptance is final even if the server closes before QUIT completes.
        return true;
    } finally {fclose($socket);}
}

function fbSmtpWrite($socket,string $data): void {
    while($data!==''){$written=fwrite($socket,$data);if($written===false||$written===0)throw new RuntimeException('SMTP write failed.');$data=substr($data,$written);}
}
function fbSmtpCommand($socket,string $command,array $codes): void {
    fbSmtpWrite($socket,$command."\r\n");fbSmtpExpect($socket,$codes);
}
function fbSmtpExpect($socket,array $codes): void {
    for($lines=0;$lines<100;$lines++){
        $line=fgets($socket,2048);
        if($line===false||!preg_match('/^(\d{3})([ -])/',$line,$match))throw new RuntimeException('Invalid or timed out SMTP response.');
        if($match[2]===' '){if(!in_array((int)$match[1],$codes,true))throw new RuntimeException('SMTP rejected request (code '.$match[1].').');return;}
    }
    throw new RuntimeException('SMTP response exceeded limit.');
}
