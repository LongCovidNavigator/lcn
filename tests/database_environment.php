<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/_lcn_db.php';
$config = require __DIR__ . '/../api/_database_profile.php';
foreach ([
    ['localhost:8080', false, 'LOCAL_HYBRID'],
    ['127.0.0.1', false, 'LOCAL_HYBRID'],
    ['[::1]:80', false, 'LOCAL_HYBRID'],
    ['DEV.LCNAVI.DE:443', false, 'ONLINE_HYBRID'],
    ['beta.lcnavi.de', false, 'ONLINE_HYBRID'],
    ['lcnavi.de', false, 'ONLINE_HYBRID'],
    ['www.lcnavi.de', false, 'ONLINE_HYBRID'],
    ['', true, 'LOCAL_HYBRID'],
] as [$host, $cli, $expected]) {
    if (lcnProfileForEnvironment($config, $host, $cli) !== $expected) {
        throw new RuntimeException('Wrong profile for ' . $host);
    }
}
$config['profiles']['dev'] = 'ONLINE_DUMMY';
if (lcnProfileForEnvironment($config, 'dev.lcnavi.de') !== 'ONLINE_DUMMY'
    || lcnProfileForEnvironment($config, 'beta.lcnavi.de') !== 'ONLINE_HYBRID'
    || lcnProfileForEnvironment($config, 'lcnavi.de') !== 'ONLINE_HYBRID') {
    throw new RuntimeException('Environment switches are not independent.');
}
foreach (['unknown.example', 'dev.lcnavi.de.attacker.example'] as $host) {
    $rejected = false;
    try { lcnProfileForEnvironment($config, $host); }
    catch (RuntimeException $e) { $rejected = true; }
    if (!$rejected) throw new RuntimeException('Unknown host accepted.');
}
$config['profiles']['dev'] = 'LOCAL_MAIN';
$rejected = false;
try { lcnProfileForEnvironment($config, 'dev.lcnavi.de'); }
catch (RuntimeException $e) { $rejected = true; }
if (!$rejected) throw new RuntimeException('Local profile accepted online.');
echo "PASS: host mapping, CLI, independent switches and online profile restrictions.\n";
