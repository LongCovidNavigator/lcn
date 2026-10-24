<?php
/** A vote always addresses this saved relationship key, never the therapy record. */
function ndRelationshipAssertion(array $g,string $key): array {
    $parts=explode(':',$key);$parent=0;$child=0;$meaning='gehört zu';
    if($parts[0]==='ag'){
        $group=$g['groups'][(int)$parts[1]];$parent=(int)$group['root'];$child=(int)$parts[3];
        $parentName=$parent?$g['entries'][$parent]['treatmentname']:$group['name'];
        $meaning=match($group['relation_type']??'umbrella_term'){'application_form'=>'ist eine Anwendungsform von','substance_variant'=>'ist eine Stoffvariante von','detailed_method'=>'ist ein detaillierteres Verfahren von',default=>'gehört zu'};
    }elseif($parts[0]==='bn'){$parent=(int)$parts[1];$child=(int)$parts[2];$meaning='ist ein Handelsname von';}
    elseif($parts[0]==='bs'){$child=(int)$parts[1];$parent=(int)$parts[2];$meaning='ist zugeordnet zu';}
    else throw new LogicException('Unsupported stage relationship key: '.$key);
    $parentName=$parentName??$g['entries'][$parent]['treatmentname'];
    return ['key'=>$key,'statement'=>'„'.$g['entries'][$child]['treatmentname'].'“ '.$meaning.' „'.$parentName.'“.','parent'=>$parent,'child'=>$child];
}
/** Three stable stages. Relationship types stay separate; the page ID alone is current. */
function ndRelationshipStages(array $g,int $id): array {
    $own=$g['entries'][$id];$parents=[];$children=[];
    foreach($g['groups'] as $group){if(isset($group['members'][$id]))$parents[]=$group;if($group['root']===$id)$children[]=$group;}
    $isTrade=!empty($g['generics'][$id]);
    $isSubstance=in_array($own['typ']??'', ['Arzneimittel','Nahrungsergänzungsmittel','Infusionen'],true);
    foreach($children as $group)if($group['forms']||in_array($group['relation_type']??'',['application_form','substance_variant'],true))$isSubstance=true;
    $formParent=null;$variantParent=null;foreach($parents as $group){if($group['forms']){$isSubstance=true;$formParent=$group;}if(($group['relation_type']??'')==='substance_variant'){$isSubstance=true;$variantParent=$group;}}
    $isClass=false;
    foreach($children as $group)if($group['medication']&&!$group['forms']&&($group['relation_type']??'umbrella_term')==='umbrella_term'){
        $sharesName=false;foreach($group['members'] as $member)if(str_starts_with(lcnDiscoveryName($g['entries'][$member]['treatmentname']),lcnDiscoveryName($own['treatmentname'])))$sharesName=true;
        if(!$parents&&!$sharesName)$isClass=true;
    }
    $drug=$isTrade||(($own['typ']??'')==='Arzneimittel'&&!$children)||$isClass;
    if($children&&!$isClass)$drug=false;
    if($formParent||$variantParent)$drug=false;
    $title=$drug?'Medikamentengruppe, Wirkstoff und Handelsnamen':'Einordnung und detailliertere Verfahren';
    $stages=[['title'=>$drug?'Medikamentengruppe':'Zugeordnete Gruppen','nodes'=>[],'adds'=>[]],['title'=>$drug?'Wirkstoffe':'Therapie / Verfahren','nodes'=>[],'adds'=>[]],['title'=>$drug?'Handelsnamen':'Detailliertere Verfahren','blocks'=>[]]];
    $edges=[];$selected=0;
    $node=static function(int $key,string $feedback='')use($g,$id):array{return ['id'=>$key,'name'=>$g['entries'][$key]['treatmentname'],'current'=>$key===$id,'feedback'=>$feedback];};
    $add=static fn(string $label,string $kind,int $source,int $group=0)=>['label'=>$label,'kind'=>$kind,'source'=>$source,'group'=>$group];
    $block=static fn(string $heading,int $source,string $kind)=>['heading'=>$heading,'source'=>$source,'nodes'=>[],'add'=>$add($heading==='Handelsnamen'?'Handelsnamen hinzufügen':($kind==='has_form'?'Anwendungsform hinzufügen':($kind==='has_variant'?'Stoffvariante hinzufügen':'Detaillierteres Verfahren hinzufügen')),$kind,$source)];
    // Medication classes keep their position on the left. A brand always stays on the right.
    $hasGroupChildren=false;foreach($children as $group)if(($group['relation_type']??'umbrella_term')==='umbrella_term'&&!$group['forms'])$hasGroupChildren=true;
    $isRootPage=$hasGroupChildren&&!$parents&&!$isTrade&&!($isSubstance&&!$isClass);
    if($isRootPage){
        $stages[0]['nodes'][$id]=$node($id);$stages[0]['adds'][]=$add('Weitere Gruppe zuordnen','belongs_to_group',$id);
        foreach($children as $group){
            foreach($group['members'] as $member){$stages[1]['nodes'][$member]=$node($member,'ag:'.$group['alias_id'].':t:'.$member);$edges[]=[0,$id,1,$member];}
            $stages[1]['adds'][]=$add($drug?'Wirkstoff hinzufügen':'Verfahren hinzufügen','group_contains',$id,$group['alias_id']);
        }
        $selected=(int)array_key_first($stages[1]['nodes']);
    }else{
        $middle=$isTrade?array_keys($g['generics'][$id]):[$id];$selected=(int)$middle[0];
        foreach($middle as $mid){
            $stages[1]['nodes'][$mid]=$node($mid);
            foreach($g['groups'] as $group){if(!isset($group['members'][$mid]))continue;
                if($group['root']){$root=$group['root'];$stages[0]['nodes'][$root]=$node($root);$stages[0]['nodes'][$root]['preview']=array_slice(array_values(array_filter($group['members'],fn($m)=>$m!==$mid)),0,2);$stages[1]['nodes'][$mid]['feedback']='ag:'.$group['alias_id'].':t:'.$mid;$edges[]=[0,$root,1,$mid];}
                if($group['root'])$stages[1]['adds'][]=$add(($group['forms']?'Weitere Anwendungsform':($drug?'Weiteren Wirkstoff':'Weiteres Verfahren')).' zu „'.$group['name'].'“ hinzufügen','group_contains',$mid,$group['alias_id']);
            }
            $stages[0]['adds'][]=$add($drug?'Medikamentengruppe zuordnen':'Gruppe zuordnen','belongs_to_group',$mid);
        }
        if($isTrade)$stages[1]['adds'][]=$add('Wirkstoff zuordnen','trade_of',$id);
    }
    // A substance with forms/variants remains in the middle, not in the class slot.
    if(!$drug&&$isSubstance){$stages[1]['title']='Substanz';$stages[2]['title']='Varianten und Anwendungsformen';$title='Einordnung, Varianten und Anwendungsformen';}
    if($formParent){$stages[0]['title']='Übergeordnete Substanz';$stages[1]['title']='Anwendungsform';$stages[2]['title']='Weitere Anwendungsformen';}
    foreach($stages[1]['nodes'] as $mid=>$middleNode){
        $blocks=[];
        if($drug){
            $b=$block('Handelsnamen',$mid,'has_trade');
            foreach($g['brands'][$mid]??[] as $brand){$b['nodes'][$brand]=$node($brand,'bn:'.$mid.':'.$brand);$edges[]=[1,$mid,2,$brand];}
            $blocks[]=$b;
        }else{
            if($formParent&&$formParent['root']){
                $b=$block('Anwendungsformen',$formParent['root'],'has_form');
                foreach($formParent['members'] as $member)if($member!==$id){$b['nodes'][$member]=$node($member,'ag:'.$formParent['alias_id'].':t:'.$member);$edges[]=[1,$mid,2,$member];}
                $blocks['has_form']=$b;
            }
            foreach($g['groups'] as $group){if($group['root']!==$mid)continue;
                foreach($group['members'] as $member){
                    $name=$g['entries'][$member]['treatmentname'];
                    $kind=$group['forms']?'has_form':(($group['relation_type']??'')==='substance_variant'?'has_variant':(($group['relation_type']??'')==='detailed_method'?'has_detail':($isSubstance?(preg_match('/Infusion|\(oral\)|\(subkutan\)|intraven|inhal|intranas/iu',$name)?'has_form':'has_variant'):'has_detail')));
                    $heading=$kind==='has_form'?'Anwendungsformen':($kind==='has_variant'?'Stoffvarianten':'Detailliertere Verfahren');
                    if(!isset($blocks[$kind]))$blocks[$kind]=$block($heading,$mid,$kind);
                    $n=$node($member,'ag:'.$group['alias_id'].':t:'.$member);
                    if(($group['relation_type']??'')==='umbrella_term'&&in_array($kind,['has_variant','has_form'],true))$n['note']='Als zugehöriger Eintrag hinterlegt';
                    $blocks[$kind]['nodes'][$member]=$n;$edges[]=[1,$mid,2,$member];
                }
            }
            // A specific formulation can link back to its base without creating a fake drug class.
            foreach($g['bases'][$mid]??[] as $base){$stages[0]['nodes'][$base]=$node($base);$stages[1]['nodes'][$mid]['feedback']='bs:'.$mid.':'.$base;$edges[]=[0,$base,1,$mid];}
            if($isSubstance&&!$formParent){foreach(['has_variant'=>'Stoffvarianten','has_form'=>'Anwendungsformen'] as $kind=>$heading)if(!isset($blocks[$kind]))$blocks[$kind]=$block($heading,$mid,$kind);}
            elseif(!$blocks)$blocks[]=$block('Detailliertere Verfahren',$mid,'has_detail');
            // Brands of a nested substance remain a separate relationship block.
            if(!empty($g['brands'][$mid])){$b=$block('Handelsnamen',$mid,'has_trade');foreach($g['brands'][$mid] as $brand){$b['nodes'][$brand]=$node($brand,'bn:'.$mid.':'.$brand);$edges[]=[1,$mid,2,$brand];}$blocks[]=$b;}
        }
        foreach($blocks as $b){$b['focus']=$mid;$stages[2]['blocks'][]=$b;}
    }
    // Each current page appears exactly once, including brand/form pages.
    $found=false;foreach([0,1] as $stage)foreach($stages[$stage]['nodes'] as &$n){$n['current']=$n['id']===$id&&!$found;if($n['current'])$found=true;}unset($n);
    foreach($stages[2]['blocks'] as &$b)foreach($b['nodes'] as &$n){$n['current']=$n['id']===$id&&!$found;if($n['current']){$found=true;$selected=$b['focus'];}}unset($b,$n);
    if(!$found)throw new LogicException('Current entry missing from relationship stages: '.$id);
    // Attach a separate, named assertion to every saved edge. Multiple parents must not overwrite each other.
    foreach($edges as [$from,$parent,$to,$child])if($from===0&&$to===1){
        $keys=[];foreach($g['groups'] as $group)if($group['root']===$parent&&isset($group['members'][$child]))$keys[]='ag:'.$group['alias_id'].':t:'.$child;
        if(isset($g['bases'][$child][$parent]))$keys[]='bs:'.$child.':'.$parent;
        foreach($keys as $key){$level=$parent===$id?1:0;$host=$level===1?$child:$parent;$stages[$level]['nodes'][$host]['assertions'][$key]=ndRelationshipAssertion($g,$key);}
    }
    foreach($stages[2]['blocks'] as &$b)foreach($b['nodes'] as &$n){
        if(empty($n['feedback']))continue;$key=$n['feedback'];$assertion=ndRelationshipAssertion($g,$key);
        if($n['id']===$id)$stages[1]['nodes'][$b['focus']]['assertions'][$key]=$assertion;
        else $n['assertions'][$key]=$assertion;
    }unset($b,$n);
    foreach([0,1] as $stage){$unique=[];foreach($stages[$stage]['adds'] as $a)$unique[implode('|',[$a['kind'],$a['source'],$a['group']])]=$a;$stages[$stage]['adds']=array_values($unique);}
    return compact('title','stages','edges','selected');
}
function ndStageAdd(array $a): string {
    return '<button type="button" class="ux-stage-add" data-treatment-relation-add data-kind="'.ndEscape($a['kind']).'" data-source-id="'.$a['source'].'" data-group-id="'.$a['group'].'" data-dialog-title="'.ndEscape($a['label']).'">＋ '.ndEscape($a['label']).'</button>';
}
function ndRenderRelationshipStages(array $g,int $id): string {
    $m=ndRelationshipStages($g,$id);ob_start();
    ?>
<section class="card ux-discovery ux-stage-section" data-relationship-stages data-selected-branch="<?= $m['selected'] ?>">
<h3><?= ndEscape($m['title']) ?> <span class="ux-heading-info"><button type="button" aria-label="Information zur Einordnung der Therapie" aria-describedby="therapy-classification-help">ⓘ</button><p id="therapy-classification-help" role="tooltip">Was gehört zu welcher Gruppe, und welche Handelsnamen, Varianten oder Anwendungsformen gibt es? Hier findest du die Einordnung dieser Therapie. Die Community kann fehlende Zuordnungen ergänzen. Diese Angaben beschreiben Zusammenhänge; mögliche Alternativen und gemeinsam eingesetzte Therapien findest du in den eigenen Bereichen.</p></span></h3>
<p class="ux-stage-vote-help">Mit deiner Rückmeldung bestätigst oder widersprichst du der jeweils genannten Verknüpfung – nicht dem Therapieeintrag selbst.</p>
<div class="ux-stage-canvas"><svg class="ux-stage-lines" aria-hidden="true"></svg><div class="ux-stage-columns">
<?php foreach($m['stages'] as $index=>$stage): ?>
<section class="ux-stage-column ux-stage-column-<?= $index ?>" data-stage="<?= $index ?>" aria-label="<?= ndEscape($stage['title']) ?>"><h4><?= ndEscape($stage['title']) ?></h4><div class="ux-stage-stack">
<?php
$renderNode=static function(array $n,int $level)use($g):void{ ?>
<article class="ux-stage-node ux-relation-entry<?= $n['current']?' is-current':' is-linked' ?>" data-stage-node="<?= $n['id'] ?>" data-node-level="<?= $level ?>"<?= $n['current']?' aria-current="page"':'' ?>>
<?php if($n['current']): ?><small class="ux-stage-current">Du bist hier</small><?php endif; ?>
<?php if($n['current']): ?><strong class="ux-stage-name"><?= ndEscape($n['name']) ?></strong><?php else: ?><a class="ux-stage-name" href="therapie_detail.php?treatment_id=<?= $n['id'] ?>#alternativen"><?= ndEscape($n['name']) ?></a><?php endif; ?>
<?php if(!empty($n['note'])): ?><small><?= ndEscape($n['note']) ?></small><?php endif; ?>
<?php if(!empty($n['preview'])): ?><small>Weitere Einträge: <?= ndEscape(implode(', ',array_map(fn($key)=>$g['entries'][$key]['treatmentname'],$n['preview']))) ?></small><?php endif; ?>
<?php foreach($n['assertions']??[] as $assertion): ?><div class="ux-stage-assertion" data-relationship-key="<?= ndEscape($assertion['key']) ?>"><small class="ux-stage-assertion-label">Verknüpfung prüfen</small><p><?= ndEscape($assertion['statement']) ?></p><span data-treatment-relation-feedback="<?= ndEscape($assertion['key']) ?>" data-feedback-statement="<?= ndEscape($assertion['statement']) ?>"></span></div><?php endforeach; ?>
</article>
<?php };
if($index<2){foreach($stage['nodes'] as $n)$renderNode($n,$index);foreach($stage['adds'] as $a)echo ndStageAdd($a);}
else foreach($stage['blocks'] as $b):
    $currentOnRight=false;foreach($stage['blocks'] as $candidate)foreach($candidate['nodes'] as $n)if($n['current'])$currentOnRight=true;
    $hasKnown=false;foreach($stage['blocks'] as $candidate)if($candidate['nodes'])$hasKnown=true;
    $multiple=count($m['stages'][1]['nodes'])>1;
    $visible=$currentOnRight ? $b['focus']===$m['selected'] : (!$multiple || ($hasKnown ? (bool)$b['nodes'] : $b['focus']===$m['selected']));
?>
<div class="ux-stage-block" data-branch="<?= $b['focus'] ?>"<?= !$visible?' hidden':'' ?>><?php if($multiple||$b['heading']!==$stage['title']): ?><h5><?= ndEscape($b['heading'].($multiple?' für '.$g['entries'][$b['focus']]['treatmentname']:'')) ?></h5><?php endif; ?>
<?php foreach($b['nodes'] as $n)$renderNode($n,2); ?>
<?= ndStageAdd($b['add']) ?>
</div>
<?php endforeach; ?>
</div></section><?php endforeach; ?>
</div></div><script type="application/json" data-stage-edges><?= json_encode($m['edges'],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?></script>
</section>
<?php return ob_get_clean();
}
