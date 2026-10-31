<?php

// Four independent database switches. No credentials belong in this file.
// Online environments accept ONLINE_* profiles only.
return [
    'profiles' => [
        'local' => 'LOCAL_HYBRID',
        'dev' => 'ONLINE_HYBRID',
        'beta' => 'ONLINE_HYBRID',
        'production' => 'ONLINE_HYBRID',
    ],
    'hosts' => [
        'localhost' => 'local',
        '127.0.0.1' => 'local',
        '::1' => 'local',
        'dev.lcnavi.de' => 'dev',
        'beta.lcnavi.de' => 'beta',
        'lcnavi.de' => 'production',
        'www.lcnavi.de' => 'production',
    ],
];
