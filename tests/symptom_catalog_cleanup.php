<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../scripts/prepare_symptom_catalog.php';
$token=$argv[1]??'';if(!preg_match('/^[a-f0-9]{64}$/',$token))throw new RuntimeException('Invalid test token');
$_COOKIE[LCN_VOTER_COOKIE]=$token;$p=symLocalDatabase();$key=lcnVoterKey();
$p->prepare('DELETE FROM tbl_symptom_category_votes WHERE voter_key=?')->execute([$key]);
$p->prepare("DELETE FROM tbl_symptom_requests WHERE voter_key=? AND name LIKE '__symptom_ui_test_%'")->execute([$key]);
echo "UI fixtures removed.\n";
