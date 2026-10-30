<?php
require_once __DIR__.'/../api/_doctor_profile_items.php';
function check($condition,$message){if(!$condition)throw new RuntimeException($message);}
$lists=['medical'=>['specialty'=>['Angiologie','Innere Medizin'],'specializations'=>['ME/CFS','Post-Vac']]];
$people=[];$overrides=['alice'=>['medical'=>['specialty'=>['Angiologie'=>1]]]];
$v=lcnProfileApplyItemVotes($people,$lists,$overrides,'alice');
check($v['medical']['specialty']['Angiologie']['confirm']===1,'single entry counts');check($v['medical']['specialty']['Innere Medizin']['confirm']===0,'other entry untouched');check($people['alice']['medical']['specialty']['stance']===0,'partial field remains neutral');
$people=['alice'=>['medical'=>['specialty'=>['stance'=>1,'correction'=>null]]]];$overrides=['alice'=>['medical'=>['specialty'=>['Angiologie'=>0]]]];
$v=lcnProfileApplyItemVotes($people,$lists,$overrides,'alice');check($v['medical']['specialty']['Innere Medizin']['own']===1,'historical confirmation inherited');check($v['medical']['specialty']['Angiologie']['own']===0,'one entry can be unconfirmed');check($people['alice']['medical']['specialty']['stance']===0,'unconfirming one entry neutralizes field');
$people=['alice'=>['medical'=>['specializations'=>['stance'=>-1,'correction'=>'ME/CFS']]]];$overrides=['alice'=>['medical'=>['specializations'=>['ME/CFS'=>1,'Post-Vac'=>1]]]];
$v=lcnProfileApplyItemVotes($people,$lists,$overrides,'alice');check($v['medical']['specializations']['ME/CFS']['confirm']===1,'remaining confirmation retained');check($v['medical']['specializations']['Post-Vac']['confirm']===0,'removed entry is not confirmed');check($v['medical']['specializations']['Post-Vac']['oppose']===1,'removed entry counts objection');check($people['alice']['medical']['specializations']['stance']===-1,'objection retained');
$people=[];$overrides=['alice'=>['medical'=>['specialty'=>['Angiologie'=>1,'Innere Medizin'=>1]]],'bob'=>['medical'=>['specialty'=>['Angiologie'=>1]]]];
$v=lcnProfileApplyItemVotes($people,$lists,$overrides,'bob');check($v['medical']['specialty']['Angiologie']['confirm']===2,'independent supporters');check($v['medical']['specialty']['Innere Medizin']['confirm']===1,'separate counts');check($people['alice']['medical']['specialty']['stance']===1,'all entries confirm field');check($people['bob']['medical']['specialty']['stance']===0,'second partial voter neutral');
echo "PASS: independent entries, inherited votes, isolated undo, removed terms, mixed corrections, unique supporters\n";
