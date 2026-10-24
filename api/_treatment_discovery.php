<?php
declare(strict_types=1);
function lcnDiscoveryName(string $name): string {
    return mb_strtolower(trim(preg_replace('/\s+/u', ' ', str_replace('⁺', '+', $name))));
}
function lcnTreatmentDiscoveryGraph(PDO $pdo): array {
    return lcnBuildTreatmentDiscoveryGraph(lcnNdRows($pdo, 'SELECT t.treat_nd_id,t.treatmentname,t.typ,t.review_status,a.alias_id,a.alias,a.alias_type FROM tbl_treatments_nd t LEFT JOIN tbl_cpl_treatments_nd2aliases c ON c.treat_nd_id=t.treat_nd_id LEFT JOIN tbl_aliases_03 a ON a.alias_id=c.alias_id WHERE t.review_status<>\'rejected_group\' ORDER BY t.treat_nd_id,a.alias_id'));
}
/** Existing typed aliases only; primary names alone never establish brand or group roles. */
function lcnBuildTreatmentDiscoveryGraph(array $rows): array {
    $entries=[]; $names=[]; $aliases=[]; $comboIds=[];
    foreach ($rows as $r) {
        $id=(int)$r['treat_nd_id'];
        $entries[$id]['treat_nd_id']=$id;
        $entries[$id]['treatmentname']=$r['treatmentname'];
        $entries[$id]['typ']=$r['typ'];
        $entries[$id]['review_pending']=($r['review_status']??'')==='pending_group';
        $names[lcnDiscoveryName($r['treatmentname'])][$id]=$id;
        if ($r['alias_id']!==null) {
            $aid=(int)$r['alias_id'];
            $aliases[$aid]['name']=$r['alias']; $aliases[$aid]['type']=$r['alias_type'];
            $aliases[$aid]['members'][$id]=$id; $entries[$id]['aliases'][$aid]=$aid;
        }
        if (preg_match('/\s[+&]\s|\bKombi(?:nation)?\b|\bTriple[ -]/iu',$r['treatmentname'])) $comboIds[$id]=$id;
    }
    $groups=[]; $roots=[]; $definitions=[];
    foreach($aliases as $a)if($a['type']==='combination_definition'){
        $targets=$names[lcnDiscoveryName($a['name'])]??[];if(count($targets)!==1)continue;
        $cid=(int)reset($targets);$comboIds[$cid]=$cid;$definitions[$cid]=array_diff_key($a['members'],[$cid=>true]);
    }
    foreach ($aliases as $a) if ($a['type']==='combination_component') {
        $targets=$names[lcnDiscoveryName($a['name'])] ?? [];
        if (count($targets)!==1) continue;
        $part=(int)reset($targets);
        foreach ($a['members'] as $candidate) if ($candidate!==$part) $comboIds[$candidate]=$candidate;
    }
    // The existing H2 umbrella and its catalog page have different titles.
    $groupTitles=['h2-blocker'=>'h2-antihistaminika','folat'=>'folat (supplementierung)'];
    foreach ($aliases as $aid=>$a) {
        if (!in_array($a['type'],['umbrella_term','application_form','substance_variant','detailed_method'],true)) continue;
        $key=lcnDiscoveryName($a['name']); $candidates=$names[$groupTitles[$key] ?? $key] ?? [];
        $root=count($candidates)===1 ? (int)reset($candidates) : null;
        if ($root && in_array($a['type'],['umbrella_term','detailed_method'],true)) $roots[$root]=$root;
        $groups[$aid]=['alias_id'=>$aid,'name'=>$a['name'],'root'=>$root,'members'=>$a['members'],'explicit_forms'=>$a['type']==='application_form','relation_type'=>$a['type']];
    }
    $brands=[]; $generics=[]; $bases=[];
    foreach ($entries as $id=>$e) {
        if (($e['typ'] ?? '')!=='Arzneimittel' || isset($roots[$id])) continue;
        $hasTradeAlias=false;
        foreach ($e['aliases'] ?? [] as $aid) if ($aliases[$aid]['type']==='trade_name') $hasTradeAlias=true;
        foreach ($e['aliases'] ?? [] as $aid) {
            $a=$aliases[$aid];
            if (!in_array($a['type'],['generic_name','trade_name','active_ingredient'],true)) continue;
            if (isset($comboIds[$id]) && $a['type']!=='trade_name') continue;
            $targets=$names[lcnDiscoveryName($a['name'])] ?? [];
            if (count($targets)!==1) continue;
            $target=(int)reset($targets);
            if ($target===$id || isset($roots[$target])) continue;
            // A formulation may carry its base substance and its own trade names (e.g. low-dose aripiprazole).
            if ($hasTradeAlias && $a['type']!=='trade_name') { $bases[$id][$target]=$target; continue; }
            if ($a['type']==='trade_name') { $generic=$id; $brand=$target; }
            else { $generic=$target; $brand=$id; }
            $brands[$generic][$brand]=$brand; $generics[$brand][$generic]=$generic;
        }
    }
    foreach ($generics as &$ids) {
        foreach ($ids as $generic) foreach ($bases[$generic] ?? [] as $base) if (isset($ids[$base])) unset($ids[$generic]);
    }
    unset($ids);
    foreach ($groups as &$g) {
        $g['members']=array_diff_key($g['members'],$generics);
        if(($g['relation_type']??'umbrella_term')!=='umbrella_term')$g['members']=array_diff_key($g['members'],$comboIds);
        if ($g['root']) unset($g['members'][$g['root']]);
        $prefix=lcnDiscoveryName($g['name']); $g['forms']=count($g['members'])>1;
        foreach ($g['members'] as $id) {
            $name=lcnDiscoveryName($entries[$id]['treatmentname']);
            if (!str_starts_with($name,$prefix.' (') && !str_starts_with($name,$prefix.'-')) $g['forms']=false;
        }
        if ($g['explicit_forms']) $g['forms']=true;
        if(in_array($g['relation_type']??'',['substance_variant','detailed_method'],true))$g['forms']=false;
        $g['medication']=!$g['forms'] && count($g['members'])>0;
        foreach ($g['members'] as $id) if (($entries[$id]['typ'] ?? '')!=='Arzneimittel') $g['medication']=false;
        $g['procedures']=true;
        foreach ($g['members'] as $id) if (in_array($entries[$id]['typ'] ?? '',['Nahrungsergänzungsmittel','Ernährung und Diät','Arzneimittel'],true)) $g['procedures']=false;
    }
    unset($g);
    $components=$definitions; $componentNames=[]; $componentIncomplete=[]; $combinations=[]; $simple=[];
    foreach($definitions as $cid=>$parts)foreach($parts as $part)$combinations[$part][$cid]=$cid;
    foreach ($aliases as $a) {
        if (!in_array($a['type'],['primary_name','abbreviation','generic_name','alternate_name','long_name','long_form'],true)) continue;
        foreach ($a['members'] as $id) if (!isset($comboIds[$id]) && !isset($roots[$id])) $simple[lcnDiscoveryName($a['name'])][$id]=$id;
    }
    foreach ($comboIds as $cid) {
        if(isset($definitions[$cid]))continue; // Reviewed selections are authoritative; names never add extra parts.
        $compound=[]; $texts=[$entries[$cid]['treatmentname']];
        foreach ($entries[$cid]['aliases'] ?? [] as $aid) {
            $text=$aliases[$aid]['name'];
            if (preg_match('/\s[+&]\s/u',$text)) { $texts[]=$text; $compound[$aid]=$aid; }
        }
        foreach ($texts as $text) {
            $text=preg_replace('/\s*\((?:Kombi|Kombination)\)\s*/iu','',$text);
            $parts=preg_split('/\s+[+&]\s+|,\s*|\s+und\s+/u',$text);
            if (count($parts)<2) continue;
            foreach ($parts as $part) {
                $key=lcnDiscoveryName($part); $targets=array_diff_key($names[$key] ?? [],$comboIds);
                if (!$targets) $targets=$simple[$key] ?? [];
                if (count($targets)===1) {
                    $target=(int)reset($targets); $components[$cid][$target]=$target; $combinations[$target][$cid]=$cid;
                } elseif (!$targets && !str_ends_with(trim($part),'-')) {
                    $componentNames[$cid][$key]=trim($part);
                } else {
                    $componentIncomplete[$cid]=true;
                }
                // Shared compound aliases also link existing forms to their combination.
                foreach ($compound as $aid) foreach ($aliases[$aid]['members'] as $candidate) {
                    if (isset($comboIds[$candidate])) continue;
                    $matches=lcnDiscoveryName($entries[$candidate]['treatmentname'])===$key;
                    foreach ($entries[$candidate]['aliases'] ?? [] as $caid) if (lcnDiscoveryName($aliases[$caid]['name'])===$key) $matches=true;
                    if ($matches) $combinations[$candidate][$cid]=$cid;
                }
            }
        }
    }
    foreach ($aliases as $a) if ($a['type']==='combination_component') {
        $targets=$names[lcnDiscoveryName($a['name'])] ?? [];
        if (count($targets)!==1) continue;
        $part=(int)reset($targets);
        foreach ($a['members'] as $cid) if ($cid!==$part) { $components[$cid][$part]=$part; $combinations[$part][$cid]=$cid; }
    }
    return compact('entries','aliases','groups','roots','brands','generics','bases','comboIds','components','componentNames','componentIncomplete','combinations');
}
function lcnTreatmentAliasNavigation(array $graph,int $id): array {
    $entry=$graph['entries'][$id]; $sections=[];
    $links=static function (array $ids) use ($graph,$id): array {
        $result=[];
        foreach ($ids as $key) if ($key!==$id && isset($graph['entries'][$key])) $result[$key]=['treat_nd_id'=>$key,'treatmentname'=>$graph['entries'][$key]['treatmentname']];
        uasort($result,static fn($a,$b)=>strnatcasecmp($a['treatmentname'],$b['treatmentname']) ?: $a['treat_nd_id']<=>$b['treat_nd_id']);
        return array_values($result);
    };
    $add=static function (string $title,string $label,array $ids,?string $group=null,?int $root=null,?int $groupAliasId=null) use (&$sections,$links): void {
        $entries=$links($ids);
        if ($entries || $group!==null) $sections[]=['title'=>$title,'label'=>$label,'entries'=>$entries,'group'=>$group,'root'=>$root,'group_alias_id'=>$groupAliasId];
    };
    $role=isset($graph['comboIds'][$id]) ? 'combination' : (isset($graph['roots'][$id]) ? 'umbrella' : (!empty($graph['generics'][$id]) ? 'trade' : 'member'));
    if ($role==='trade') {
        $genericIds=$graph['generics'][$id];
        $combination=count(array_intersect_key($genericIds,$graph['comboIds']))>0;
        $add($combination ? 'Zugehörige Wirkstoffkombination' : 'Zugehöriger Wirkstoff',$combination ? 'Wirkstoffkombination' : 'Wirkstoff',$genericIds); $others=[];
        foreach ($genericIds as $generic) $others += $graph['brands'][$generic] ?? [];
        $add('Weitere Handelsnamen desselben Wirkstoffs','Handelsname',$others);
    } else {
        $add('Zugehöriger Wirkstoff','Wirkstoff',$graph['bases'][$id] ?? []);
        foreach ($graph['groups'] as $g) {
            $isRoot=$g['root']===$id;
            if (!$isRoot && !isset($g['members'][$id])) continue;
            $title=$g['forms'] ? ($isRoot ? 'Formen von ' : 'Weitere Formen von ').$g['name']
                : ($g['medication'] ? ($isRoot ? 'Wirkstoffe dieser Medikamentengruppe' : 'Weitere Wirkstoffe dieser Medikamentengruppe')
                : ($g['procedures'] ? ($isRoot ? 'Verfahren dieser Gruppe' : 'Weitere Verfahren dieser Gruppe') : ($isRoot ? 'Einträge dieser Gruppe' : 'Weitere Einträge dieser Gruppe')));
            $add($title,$g['forms'] ? 'Anwendungsform' : ($g['medication'] ? 'Wirkstoff' : ($g['procedures'] ? 'Verfahren' : 'Gruppenmitglied')),$g['members'],$g['name'],$isRoot ? null : $g['root'],$g['alias_id']);
        }
        $add($role==='combination' ? 'Handelsnamen dieser Wirkstoffkombination' : 'Handelsnamen dieses Wirkstoffs','Handelsname',$graph['brands'][$id] ?? []);
    }
    if ($role==='combination') {
        $parts=$links($graph['components'][$id] ?? []);
        foreach ($graph['componentNames'][$id] ?? [] as $name) $parts[]=['treat_nd_id'=>null,'treatmentname'=>$name];
        $sections[]=['title'=>'Bestandteile dieser Kombination','label'=>'Bestandteil','entries'=>$parts,'group'=>null,'root'=>null,
            'note'=>!empty($graph['componentIncomplete'][$id]) ? 'Weitere Bestandteile sind noch nicht eindeutig zugeordnet.' : null];
    }
    $diagnostic=($entry['typ'] ?? '')==='Diagnostik';
    $add(($diagnostic ? 'Kombinierte Untersuchungen mit ' : 'Kombinationstherapien mit ').$entry['treatmentname'],$diagnostic ? 'Kombinierte Untersuchung' : 'Kombinationstherapie',$graph['combinations'][$id] ?? []);
    foreach ($sections as &$section) {
        $aliasId=$section['group_alias_id'] ?? null;
        if ($section['group']!==null) {
            if ($aliasId && isset($graph['groups'][$aliasId]['members'][$id])) $section['feedback_key']='ag:'.$aliasId.':t:'.$id;
        }
        foreach ($section['entries'] as &$targetEntry) {
            $target=$targetEntry['treat_nd_id']; $key=null;
            if ($aliasId && $target) $key='ag:'.$aliasId.':t:'.$target;
            elseif ($section['label']==='Handelsname' && $target) {
                $generic=$id;
                if ($role==='trade') foreach ($graph['generics'][$id] as $candidate) {
                    if (isset($graph['brands'][$candidate][$target])) { $generic=$candidate; break; }
                }
                $key='bn:'.$generic.':'.$target;
            } elseif (in_array($section['label'],['Wirkstoff','Wirkstoffkombination'],true) && $target) {
                $key=$role==='trade' ? 'bn:'.$target.':'.$id : 'bs:'.$id.':'.$target;
            } elseif ($section['label']==='Bestandteil') {
                $key=$target ? 'cp:'.$id.':'.$target : 'cn:'.$id.':'.substr(hash('sha256',lcnDiscoveryName($targetEntry['treatmentname'])),0,24);
            } elseif (in_array($section['label'],['Kombinationstherapie','Kombinierte Untersuchung'],true) && $target) $key='cp:'.$target.':'.$id;
            $targetEntry['feedback_key']=$key;
        }
        unset($targetEntry);
    }
    unset($section);
    return ['role'=>$role,'sections'=>$sections];
}

/** Reject arbitrary feedback keys; every new key must describe an existing displayed assertion. */
function lcnValidateTreatmentDiscoveryFeedback(PDO $pdo,string $key,?array $graph=null): int
{
    if (preg_match('/^tr:([1-9][0-9]*)$/D',$key,$m)) {
        $rows=lcnNdRows($pdo,'SELECT source_treat_nd_id FROM tbl_cpl_treatments_nd_relations WHERE relation_id=?',[(int)$m[1]]);
        if ($rows) return (int)$rows[0]['source_treat_nd_id'];
        throw new InvalidArgumentException('Zuordnung nicht gefunden.');
    }
    if (preg_match('/^combo:([1-9][0-9]*)$/D',$key,$m)) {
        $graph=$graph ?? lcnTreatmentDiscoveryGraph($pdo);
        if (isset($graph['comboIds'][(int)$m[1]])) return (int)$m[1];
        throw new InvalidArgumentException('Kombination nicht gefunden.');
    }
    if (!preg_match('/^(?:ag:[1-9][0-9]*:t:[1-9][0-9]*|(?:bn|bs|cp):[1-9][0-9]*:[1-9][0-9]*|cn:[1-9][0-9]*:[a-f0-9]{24})$/D',$key)) throw new InvalidArgumentException('Ungültige Zuordnung.');
    $graph=$graph ?? lcnTreatmentDiscoveryGraph($pdo);
    $parts=explode(':',$key); $source=(int)$parts[1]; $target=(int)$parts[2];
    $valid=false; $therapy=$source;
    if ($parts[0]==='ag') { $therapy=(int)$parts[3]; $valid=isset($graph['groups'][$source]['members'][$therapy]); }
    elseif ($parts[0]==='bn') $valid=isset($graph['brands'][$source][$target]);
    elseif ($parts[0]==='bs') $valid=isset($graph['bases'][$source][$target]);
    elseif ($parts[0]==='cp') $valid=isset($graph['components'][$source][$target]) || isset($graph['combinations'][$target][$source]);
    elseif ($parts[0]==='cn') foreach ($graph['componentNames'][$source] ?? [] as $name) {
        if (substr(hash('sha256',lcnDiscoveryName($name)),0,24)===$parts[2]) $valid=true;
    }
    if (!$valid) throw new InvalidArgumentException('Zuordnung nicht gefunden.');
    return $therapy;
}
