<?php
// User's editorial selection from 2026-08-16, plus IHHT. Order is not efficacy.
// `all` requires every component. Partial matches never count as confirmed.
function lcnEditorialTreatments(): array {
    $definitions = [
        ['Pacing / Energiemanagement',[2,90]],
        ['Low-Dose Naltrexon (LDN)',[1]],
        ['H1-Antihistaminika',[25,26,27,28,29,34,83,84,85],'any',[169]],
        ['H2-Antihistaminika',[461]],
        ['Ivabradin',[5]],
        ['Pyridostigmin (Mestinon)',[3,454]],
        ['Betablocker',[793]],
        ['Kompressionstherapie',[465,8]],
        ['Salz- und Flüssigkeitssteigerung',[10,11],'all'],
        ['Hyperbare Sauerstofftherapie (HBOT/HBO)',[14]],
        ['Stellatumblockade (SGB)',[468]],
        ['Atemtherapie / Atemmuskeltraining',[176,852]],
        ['Kognitive Rehabilitation',[464]],
        ['Riechtraining / olfaktorisches Training',[101]],
        ['Physiotherapie – PEM-adaptiert',[],'any',[346]],
        ['Ergotherapie',[226]],
        ['Psychotherapie / psychologische Begleitung',[271]],
        ['Schlaftherapie / Schlafhygiene',[100]],
        ['Melatonin',[47]],
        ['Vortioxetin',[469]],
        ['Agomelatin',[457]],
        ['Guanfacin + N-Acetylcystein (NAC)',[460]],
        ['N-Acetylcystein (NAC)',[20]],
        ['IVIG – intravenöse Immunglobuline',[411]],
        ['Immunadsorption',[17]],
        ['H.E.L.P.-Apherese',[15]],
        ['Therapeutischer Plasmaaustausch / Plasmapherese',[16]],
        ['Inuspherese',[278]],
        ['Lipidapherese',[466]],
        ['Therapeutische Apherese / Hämapherese allgemein',[]],
        ['Intervall-Hypoxie-Hyperoxie-Therapie (IHHT)',[277]],
    ];
    return array_map(fn($d)=>['label'=>$d[0],'ids'=>$d[1],'mode'=>$d[2]??'any','partial_ids'=>$d[3]??[]],$definitions);
}

function lcnEditorialMatches(array $treatments): array {
    $ids=array_map('intval',array_column($treatments,'treat_id'));
    $matches=[]; $partial=[];
    foreach(lcnEditorialTreatments() as $index=>$entry){
        $found=array_values(array_intersect($entry['ids'],$ids));
        $confirmed=count($found)>0 && ($entry['mode']!=='all' || count($found)===count($entry['ids']));
        if($confirmed) $matches[]=['position'=>$index+1,'label'=>$entry['label'],'treat_ids'=>$found];
        else {
            $related=array_values(array_unique(array_merge($found,array_intersect($entry['partial_ids'],$ids))));
            if($related) $partial[]=['position'=>$index+1,'label'=>$entry['label'],'treat_ids'=>$related];
        }
    }
    return ['total'=>31,'matched_count'=>count($matches),'matches'=>$matches,'partial'=>$partial];
}
