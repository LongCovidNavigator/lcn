<?php
require_once __DIR__.'/prepare_feedback.php';
$p=fbLocalDatabase();foreach(explode(';',file_get_contents(__DIR__.'/../migrations/20261106_feedback_images.sql')) as $sql)if(trim($sql)!=='')$p->exec($sql);
echo "PASS: additive feedback image migration applied locally.\n";
