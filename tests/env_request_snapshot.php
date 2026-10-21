<?php
declare(strict_types=1);
$path=tempnam(sys_get_temp_dir(),'lcn-env-test-');
file_put_contents($path,"LCN_SNAPSHOT_FILE=value-from-file\nLCN_SNAPSHOT_OVERRIDE=file-value\nLCN_SNAPSHOT_EMPTY=\n");
putenv('LCN_ENV_FILE='.$path);putenv('LCN_SNAPSHOT_OVERRIDE=process-value');
require_once __DIR__.'/../api/_lcn_db.php';
try{
 if(lcnEnv('LCN_SNAPSHOT_FILE')!=='value-from-file')throw new RuntimeException('File value missing.');
 if(lcnEnv('LCN_SNAPSHOT_OVERRIDE')!=='process-value')throw new RuntimeException('Deployment override lost.');
 putenv('LCN_SNAPSHOT_FILE');putenv('LCN_SNAPSHOT_OVERRIDE=');
 if(lcnEnv('LCN_SNAPSHOT_FILE')!=='value-from-file'||lcnEnv('LCN_SNAPSHOT_OVERRIDE')!=='process-value')throw new RuntimeException('Request-local snapshot lost after environment restore.');
 putenv('LCN_SNAPSHOT_OVERRIDE=new-override');
 if(lcnEnv('LCN_SNAPSHOT_OVERRIDE')!=='new-override')throw new RuntimeException('Explicit runtime override lost.');
 if(lcnEnv('LCN_SNAPSHOT_EMPTY','fallback')!=='fallback')throw new RuntimeException('Empty setting does not use default.');
 echo "PASS: file settings, process precedence, request-local fallback, runtime override, empty defaults.\n";
}finally{unlink($path);foreach(['LCN_ENV_FILE','LCN_SNAPSHOT_FILE','LCN_SNAPSHOT_OVERRIDE'] as $key)putenv($key);}
