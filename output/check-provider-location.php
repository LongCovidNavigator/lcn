<?php
require __DIR__.'/../api/_provider_location.php';
function check($value,$expected){foreach($expected as $key=>$want)if(($value[$key]??null)!==$want)throw new RuntimeException($key.' mismatch');}
check(lcnProviderLocationPayload(['address'=>"Musterstrasse 12\n50667 Koeln"]),['city'=>'Koeln','postal_code'=>'50667','street'=>'Musterstrasse','house_number'=>'12']);
check(lcnProviderLocationPayload(['address'=>'Wien']),['city'=>'Wien']);
check(lcnProviderLocationPayload(['address'=>'Testgasse 7, 1010 Wien']),['city'=>'Wien','postal_code'=>'1010']);
check(lcnProviderLocationPayload(['address'=>'','name'=>'Ohne Adresse']),['address'=>'','name'=>'Ohne Adresse']);
check(lcnProviderLocationPayload(['address'=>'Bahnhofstrasse 4','city'=>'Zuerich']),['city'=>'Zuerich','street'=>'Bahnhofstrasse']);
echo "PASS provider addresses, city-only, no address and preserved explicit city\n";
