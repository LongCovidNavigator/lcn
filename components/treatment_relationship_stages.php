<?php
require_once __DIR__.'/treatment_relationship_vocabulary.php';
const ND_STAGE_ADD_ENTRY_LABEL = 'Weiteren Eintrag hinzufügen';

/** A vote always addresses this saved relationship key, never the therapy record. */
function ndRelationshipAssertion(array $g,string $key): array {
    $parts=explode(':',$key);$parent=0;$child=0;$meaning='gehört zu';
    if($parts[0]==='ag'){
        $group=$g['groups'][(int)$parts[1]];$parent=(int)$group['root'];$child=(int)$parts[3];
        $parentName=$parent?$g['entries'][$parent]['treatmentname']:$group['name'];
        $meaning=match(lcnGroupMemberRelation($group,$child)){'application_form'=>'ist eine Anwendungsform von','substance_variant'=>'ist eine Stoffvariante von','detailed_method'=>'ist eine Anwendung von','group_member'=>'gehört zur Gruppe',default=>'ist zugeordnet zu'};
    }elseif($parts[0]==='bn'){$parent=(int)$parts[1];$child=(int)$parts[2];$meaning='ist ein Handelsname von';}
    elseif($parts[0]==='bs'){$child=(int)$parts[1];$parent=(int)$parts[2];$meaning='ist zugeordnet zu';}
    else throw new LogicException('Unsupported stage relationship key: '.$key);
    $parentName=$parentName??$g['entries'][$parent]['treatmentname'];
    return ['key'=>$key,'statement'=>'„'.$g['entries'][$child]['treatmentname'].'“ '.$meaning.' „'.$parentName.'“.','parent'=>$parent,'child'=>$child];
}
/** Three stable stages. Relationship types stay separate; the page ID alone is current. */
function ndRelationshipStages(array $g,int $id,array $path=[]): array {
    $vocabulary=ndRelationshipVocabulary();
    $own=$g['entries'][$id];$parents=[];$children=[];
    foreach($g['groups'] as $group){if(isset($group['members'][$id]))$parents[]=$group;if($group['root']===$id)$children[]=$group;}
    $isTrade=!empty($g['generics'][$id]);
    // A combination is still a therapy, not automatically a single substance.
    $isSubstance=in_array($own['typ']??'', $vocabulary['substance_types'],true);
    foreach($children as $group)if(lcnGroupHasRelation($group,['application_form','substance_variant']))$isSubstance=true;
    $formParent=null;$variantParent=null;foreach($parents as $group){$relation=lcnGroupMemberRelation($group,$id);if($relation==='application_form'){$isSubstance=true;$formParent=$group;}if($relation==='substance_variant'){$isSubstance=true;$variantParent=$group;}}
    // Keep the base substance and its peers in the same columns on every page.
    // Sibling forms are children of the substance, never of the opened form.
    $substanceParent=$formParent??$variantParent;
    if($substanceParent&&!empty($substanceParent['root'])&&!isset($path[$id])){
        $path[$id]=true;
        $base=(int)$substanceParent['root'];
        if(!isset($path[$base])){
            $context=ndRelationshipStages($g,$base,$path);
            $found=false;
            foreach($context['stages'] as &$stage){
                foreach($stage['nodes']??[] as $key=>$unused){$stage['nodes'][$key]['current']=$key===$id;if($key===$id)$found=true;}
                foreach($stage['blocks']??[] as $bi=>$unused)foreach($stage['blocks'][$bi]['nodes'] as $key=>$n){
                    $stage['blocks'][$bi]['nodes'][$key]['current']=$key===$id;
                    if($key===$id){$found=true;$context['selected']=$stage['blocks'][$bi]['focus'];$stage['blocks'][$bi]['nodes'][$key]['classification_role']=$formParent?'application_form':'substance_variant';}
                }
            }unset($stage);
            if($found){
                $context['stages'][1]['adds'][]=['label'=>'Weitere Substanz zuordnen','kind'=>$formParent?'form_of':'variant_of','source'=>$id,'group'=>0];
                return $context;
            }
        }
    }
    $isClass=false;
    foreach($children as $group)if($group['medication']&&lcnGroupHasRelation($group,['group_member']))$isClass=true;
    $drug=$isTrade||(($own['typ']??'')==='Arzneimittel'&&!$children)||$isClass;
    if($children&&!$isClass)$drug=false;
    if($formParent||$variantParent)$drug=false;
    $title=$vocabulary['section_title'];
    $stages=[['title'=>$drug?'Medikamentengruppe':'Zugeordnete Gruppen','nodes'=>[],'adds'=>[]],['title'=>$drug?'Wirkstoffe':'Verfahren','nodes'=>[],'adds'=>[]],['title'=>$drug?'Handelsnamen':'Anwendung','blocks'=>[]]];
    $edges=[];$selected=0;
    $node=static function(int $key,string $feedback='')use($g,$id):array{return ['id'=>$key,'name'=>$g['entries'][$key]['treatmentname'],'current'=>$key===$id,'feedback'=>$feedback,'note'=>!empty($g['entries'][$key]['hypothesis'])?'Arbeitshypothese · Prüfung ausstehend':''];};
    $add=static fn(string $label,string $kind,int $source,int $group=0)=>['label'=>$label,'kind'=>$kind,'source'=>$source,'group'=>$group];
    $block=static fn(string $heading,int $source,string $kind)=>['heading'=>$heading,'source'=>$source,'nodes'=>[],'add'=>$add($heading==='Handelsnamen'?'Handelsnamen hinzufügen':($kind==='has_form'?$vocabulary['application_title'].' hinzufügen':($kind==='has_variant'?'Stoffvariante hinzufügen':($kind==='group_contains'?'Zugehörigen Eintrag hinzufügen':'Anwendung hinzufügen'))),$kind,$source)];
    // Medication classes keep their position on the left. A brand always stays on the right.
    $hasGroupChildren=false;foreach($children as $group)if(lcnGroupHasRelation($group,['group_member']))$hasGroupChildren=true;
    $isRootPage=$hasGroupChildren&&!$parents&&!$isTrade&&!($isSubstance&&!$isClass);
    if($isRootPage){
        $stages[0]['nodes'][$id]=$node($id);
        foreach($children as $group){
            foreach($group['members'] as $member){if(!in_array(lcnGroupMemberRelation($group,$member),['group_member','unspecified'],true))continue;$stages[1]['nodes'][$member]=$node($member,'ag:'.$group['alias_id'].':t:'.$member);$edges[]=[0,$id,1,$member];}
            $stages[1]['adds'][]=$add($drug?'Wirkstoff hinzufügen':'Weiteren Eintrag hinzufügen','group_contains',$id,$group['alias_id']);
        }
        $selected=(int)array_key_first($stages[1]['nodes']);
    }else{
        $middle=$isTrade?array_keys($g['generics'][$id]):[$id];$selected=(int)$middle[0];
        foreach($middle as $mid){
            $stages[1]['nodes'][$mid]=$node($mid);
            foreach($g['groups'] as $group){if(!isset($group['members'][$mid]))continue;
                if($group['root']){$root=$group['root'];$stages[0]['nodes'][$root]=$node($root);$stages[0]['nodes'][$root]['preview']=array_slice(array_values(array_filter($group['members'],fn($m)=>$m!==$mid)),0,2);$stages[1]['nodes'][$mid]['feedback']='ag:'.$group['alias_id'].':t:'.$mid;$edges[]=[0,$root,1,$mid];}
            }
            $stages[0]['adds'][]=$add($drug?'Medikamentengruppe zuordnen':'Gruppe zuordnen','belongs_to_group',$mid);
        }
        if($isTrade)$stages[1]['adds'][]=$add('Wirkstoff zuordnen','trade_of',$id);
    }
    // A substance with forms/variants remains in the middle, not in the class slot.
    if(!$drug&&$isSubstance){$stages[1]['title']=$vocabulary['substance_title'];$stages[2]['title']=$vocabulary['variants_title'];$title=$vocabulary['section_title'];}
    if($formParent){$stages[0]['title']='Übergeordnete Substanz';$stages[1]['title']='Anwendungsform';$stages[2]['title']='Weitere Anwendungsformen';}
    if($variantParent){$stages[0]['title']='Übergeordnete Substanz';$stages[1]['title']='Stoffvariante';}
    // A form or variant chooses its parent substance, not an unrelated group membership.
    if($formParent||$variantParent){foreach($stages[0]['adds'] as &$a){if($a['kind']==='belongs_to_group'){$a['kind']=$formParent?'form_of':'variant_of';$a['label']='Übergeordnete Substanz zuordnen';}}unset($a);}
    foreach($stages[1]['nodes'] as $mid=>$middleNode){
        $blocks=[];
        if($drug){
            $b=$block('Handelsnamen',$mid,'has_trade');
            foreach($g['brands'][$mid]??[] as $brand){$b['nodes'][$brand]=$node($brand,'bn:'.$mid.':'.$brand);$edges[]=[1,$mid,2,$brand];}
            $blocks[]=$b;
        }else{
            if($formParent&&$formParent['root']){
                $b=$block($vocabulary['application_title'],$formParent['root'],'has_form');
                foreach($formParent['members'] as $member)if($member!==$id&&lcnGroupMemberRelation($formParent,$member)==='application_form'){$b['nodes'][$member]=$node($member,'ag:'.$formParent['alias_id'].':t:'.$member);$edges[]=[1,$mid,2,$member];}
                $blocks['has_form']=$b;
            }
            foreach($g['groups'] as $group){if($group['root']!==$mid)continue;
                foreach($group['members'] as $member){
                    $name=$g['entries'][$member]['treatmentname'];
                    $relation=lcnGroupMemberRelation($group,$member);
                    $kind=match($relation){'application_form'=>'has_form','substance_variant'=>'has_variant','detailed_method'=>'has_detail',default=>'group_contains'};
                    $heading=match($relation){'application_form'=>$vocabulary['application_title'],'substance_variant'=>$vocabulary['variant_title'],'detailed_method'=>'Anwendung','group_member'=>'Verfahren dieser Gruppe',default=>'Zugeordnete Einträge (Art offen)'};
                    $blockKey=$relation;
                    if(!isset($blocks[$blockKey])){$blocks[$blockKey]=$block($heading,$mid,$kind);if($kind==='group_contains')$blocks[$blockKey]['add']['group']=$group['alias_id'];}
                    $n=$node($member,'ag:'.$group['alias_id'].':t:'.$member);
                    if($relation==='unspecified'){$n['note']='Zuordnung offen';$n['open_parent']=$mid;}
                    $blocks[$blockKey]['nodes'][$member]=$n;$edges[]=[1,$mid,2,$member];
                }
            }
            // A specific formulation can link back to its base without creating a fake drug class.
            foreach($g['bases'][$mid]??[] as $base){$stages[0]['nodes'][$base]=$node($base);$stages[1]['nodes'][$mid]['feedback']='bs:'.$mid.':'.$base;$edges[]=[0,$base,1,$mid];}
            if($isSubstance&&!$formParent){foreach(['substance_variant'=>['has_variant',$vocabulary['variant_title']],'application_form'=>['has_form',$vocabulary['application_title']]] as $key=>[$kind,$heading])if(!isset($blocks[$key]))$blocks[$key]=$block($heading,$mid,$kind);}
            elseif(!$blocks)$blocks[]=$block('Anwendung',$mid,'has_detail');
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
    // The current card also exposes every saved relationship touching this entry.
    // Reuse the relationship key so votes in both endpoint cards stay synchronized.
    $currentAssertions=[];
    foreach($stages as $stage){
        foreach($stage['nodes']??[] as $n)foreach($n['assertions']??[] as $key=>$a)if($a['parent']===$id||$a['child']===$id)$currentAssertions[$key]=$a;
        foreach($stage['blocks']??[] as $b)foreach($b['nodes'] as $n)foreach($n['assertions']??[] as $key=>$a)if($a['parent']===$id||$a['child']===$id)$currentAssertions[$key]=$a;
    }
    foreach([0,1] as $level){foreach($stages[$level]['nodes'] as &$n)if($n['current'])$n['assertions']=array_replace($n['assertions']??[],$currentAssertions);unset($n);}
    foreach($stages[2]['blocks'] as &$b){foreach($b['nodes'] as &$n)if($n['current'])$n['assertions']=array_replace($n['assertions']??[],$currentAssertions);unset($n);}unset($b);
    // Render shared details once, retaining the assertions for every parent edge.
    $detailHosts=[];
    foreach($stages[2]['blocks'] as $bi=>&$b){
        foreach($b['nodes'] as $key=>$n){
            if(isset($detailHosts[$key])){
                $host=$detailHosts[$key];
                $stages[2]['blocks'][$host]['nodes'][$key]['assertions']=array_replace($stages[2]['blocks'][$host]['nodes'][$key]['assertions']??[],$n['assertions']??[]);
                unset($b['nodes'][$key]);
            }else $detailHosts[$key]=$bi;
        }
    }unset($b);
    foreach([0,1] as $stage){$unique=[];foreach($stages[$stage]['adds'] as $a)$unique[implode('|',[$a['kind'],$a['source'],$a['group']])]=$a;$stages[$stage]['adds']=array_values($unique);}
    $specific=in_array($own['typ']??'', $vocabulary['substance_types'],true);
    // A group's columns describe its members, rather than the category of the group itself.
    if($isRootPage && $stages[1]['nodes']){
        $substanceMembers=true;
        foreach($stages[1]['nodes'] as $member)if(!in_array($g['entries'][$member['id']]['typ']??'', $vocabulary['substance_types'],true))$substanceMembers=false;
        if($substanceMembers)$specific=true;
    }
    foreach($stages as $li=>&$stage){
        foreach($stage['nodes']??[] as $key=>$unused)if($stage['nodes'][$key]['current'])$stage['nodes'][$key]['classification_role']=$drug?['group','ingredient','brand'][$li]:($li===0?'therapy_group':($isSubstance?(isset($g['comboIds'][$id])?'combination':'substance'):'therapy'));
        foreach($stage['blocks']??[] as $bi=>$unused)foreach($stage['blocks'][$bi]['nodes'] as $key=>$n)if($n['current']&&!isset($n['classification_role']))$stage['blocks'][$bi]['nodes'][$key]['classification_role']=$drug?'brand':'detailed_method';
    }unset($stage);
    $stages[0]['title']='Gruppe';
    if($specific){
        foreach($stages[1]['adds'] as &$a)if($a['kind']==='group_contains')$a['label']='Wirkstoff / Substanz hinzufügen';unset($a);
        $stages[2]['blocks']=array_values(array_filter($stages[2]['blocks'],static fn($b)=>$b['nodes']||$b['add']['kind']!=='has_detail'));
        $title=$vocabulary['section_title'];$stages[1]['title']=isset($g['comboIds'][$id])?'Wirkstoffe und Substanzen (Kombination)':'Wirkstoffe und Substanzen';$stages[2]['title']=$vocabulary['variants_title'];
        foreach($stages[1]['nodes'] as $mid=>$n){
            foreach(['has_trade'=>'Handelsnamen','has_form'=>$vocabulary['application_title'],'has_variant'=>$vocabulary['variant_title']] as $kind=>$heading){
                $exists=false;foreach($stages[2]['blocks'] as $b)if($b['focus']===$mid&&$b['add']['kind']===$kind)$exists=true;
                if(!$exists){$b=$block($heading,$mid,$kind);$b['focus']=$mid;$stages[2]['blocks'][]=$b;}
            }
        }
    }
    $order=['has_trade'=>0,'has_form'=>1,'has_variant'=>2];
    usort($stages[2]['blocks'],static fn($a,$b)=>($order[$a['add']['kind']]??3)<=>($order[$b['add']['kind']]??3));
    return compact('title','stages','edges','selected','drug');
}
function ndStageAdd(array $a): string {
    return '<button type="button" class="ux-stage-add" data-treatment-relation-add'.(!empty($a['sources'])?' data-source-options="'.ndEscape(json_encode($a['sources'],JSON_UNESCAPED_UNICODE)).'"':'').' data-kind="'.ndEscape($a['kind']).'" data-source-id="'.$a['source'].'" data-group-id="'.$a['group'].'" data-dialog-title="'.ndEscape($a['label']).'"><span class="ux-stage-add-icon" aria-hidden="true">＋</span><span>'.ndEscape(ND_STAGE_ADD_ENTRY_LABEL).'</span></button>';
}
function ndRenderRelationshipStages(array $g,int $id): string {
    $m=ndRelationshipStages($g,$id);
    $vocabulary=ndRelationshipVocabulary();
    $middleCurrent=!empty($m['stages'][1]['nodes'][$id]['current']);
    $rightCurrent=false;foreach($m['stages'][2]['blocks'] as $block)foreach($block['nodes'] as $n)if($n['current'])$rightCurrent=true;
    $hasAssertions=false;
    foreach($m['stages'] as $stage){
        foreach($stage['nodes']??[] as $n)if(!empty($n['assertions']))$hasAssertions=true;
        foreach($stage['blocks']??[] as $b)foreach($b['nodes'] as $n)if(!empty($n['assertions']))$hasAssertions=true;
    }
    ob_start();
    ?>
<section class="card ux-discovery ux-stage-section" data-relationship-stages data-add-entry-label="<?= ndEscape(ND_STAGE_ADD_ENTRY_LABEL) ?>" data-relationship-domain="<?= $m['drug']?'medication':(($m['stages'][1]['title']==='Verfahren')?'therapy':'substance') ?>" data-selected-branch="<?= $m['selected'] ?>">
<h3><?= ndEscape($m['title']) ?> <span class="ux-heading-info"><button type="button" aria-label="Information zu <?= ndEscape($m['title']) ?>" aria-describedby="therapy-classification-help">ⓘ</button><p id="therapy-classification-help" role="tooltip">Die Spalten zeigen <?= ndEscape(implode(' → ', array_column($m['stages'], 'title'))) ?>. „Du bist hier“ markiert den geöffneten Eintrag. ✓ bestätigt die angezeigte Einordnung oder Verbindung; × widerspricht. Beim eigenen Eintrag kannst du über × eine andere Einordnung vorschlagen. Über „<?= ndEscape(ND_STAGE_ADD_ENTRY_LABEL) ?>“ ergänzt du fehlende Zuordnungen. Vorschläge und Arbeitshypothesen sind zur Prüfung gekennzeichnet.</p></span></h3>
<div class="ux-stage-canvas"><svg class="ux-stage-lines" aria-hidden="true"></svg><div class="ux-stage-columns">
<?php foreach($m['stages'] as $index=>$stage): ?>
<section class="ux-stage-column ux-stage-column-<?= $index ?>" data-stage="<?= $index ?>" aria-label="<?= ndEscape($stage['title']) ?>"><h4><?= ndEscape($stage['title']) ?></h4><div class="ux-stage-stack">
<?php
$renderNode=static function(array $n,int $level)use($g,$m,$id):void{ ?>
<article class="ux-stage-node ux-relation-entry<?= $n['current']?' is-current':' is-linked' ?>" data-stage-node="<?= $n['id'] ?>" data-node-level="<?= $level ?>"<?= $n['current']?' aria-current="page"':'' ?>>
<div class="ux-stage-node-header">
<?php if($n['current']): ?><small class="ux-stage-current">Du bist hier</small><?php endif; ?>
<?php
$classificationRole=$n['current']?($n['classification_role']??($m['drug']?['group','ingredient','brand'][$level]:($level===0?'therapy_group':match($m['stages'][1]['title']){'Substanz'=>'substance','Anwendungsform'=>'application_form','Stoffvariante'=>'substance_variant',default=>$level===2?'detailed_method':'therapy'}))):null;
if($classificationRole): ?>
<span data-stage-classification="<?= $n['id'] ?>" data-classification-name="<?= ndEscape($n['name']) ?>" data-classification-current="<?= $classificationRole ?>" data-classification-category="<?= ndEscape($g['entries'][$n['id']]['typ']??'') ?>"></span>
<?php else:
$assertions=array_values(array_filter($n['assertions']??[],static fn($a)=>!$n['current']&&($a['parent']===$id||$a['child']===$id)));
foreach($assertions as $assertion): ?>
<div class="ux-stage-assertion" data-relationship-key="<?= ndEscape($assertion['key']) ?>"><span data-treatment-relation-feedback="<?= ndEscape($assertion['key']) ?>" data-feedback-statement="<?= ndEscape($assertion['statement']) ?>"></span></div>
<?php endforeach; endif; ?>
</div>
<?php if($n['current']): ?><strong class="ux-stage-name"><?= ndEscape($n['name']) ?></strong><?php else: ?><a class="ux-stage-name" href="therapie_detail.php?treatment_id=<?= $n['id'] ?>#alternativen"><?= ndEscape($n['name']) ?></a><?php endif; ?>
<?php if(!empty($n['open_parent'])): ?><button type="button" class="ux-open-classification" data-clarify-parent="<?= $n['open_parent'] ?>" data-clarify-child="<?= $n['id'] ?>">Zuordnung offen · Genauer einordnen</button><?php elseif(!empty($n['note'])): ?><small><?= ndEscape($n['note']) ?></small><?php endif; ?>

</article>
<?php };
if($index<2){foreach($stage['nodes'] as $n)$renderNode($n,$index);foreach($stage['adds'] as $a){if($a['kind']==='group_contains'&&($g['groups'][$a['group']]['root']??0)!==$id)continue;if(empty($stage['nodes'][$id]['current'])&&$a['source']===$id)echo ndStageAdd($a);}}
else foreach($stage['blocks'] as $blockIndex=>$b):
    $currentOnRight=false;foreach($stage['blocks'] as $candidate)foreach($candidate['nodes'] as $n)if($n['current'])$currentOnRight=true;
    $hasKnown=false;foreach($stage['blocks'] as $candidate)if($candidate['nodes'])$hasKnown=true;
    $multiple=count($m['stages'][1]['nodes'])>1;
    if(!$b['nodes']&&($multiple||$b['add']['source']!==$id))continue;
    $visible=$currentOnRight ? $b['focus']===$m['selected'] : (!$multiple || ($hasKnown ? (bool)$b['nodes'] : $b['focus']===$m['selected']));
?>
<?php if($multiple){$b['add']['sources']=array_values(array_map(static fn($n)=>['id'=>$n['id'],'name'=>$n['name']],$m['stages'][1]['nodes']));} ?>
<div class="ux-stage-block" data-branch="<?= $b['focus'] ?>" data-relationship-kind="<?= ndEscape($b['add']['kind']) ?>" data-relationship-label="<?= ndEscape($b['heading']) ?>"<?= !$visible?' hidden':'' ?>><?php if(in_array($b['add']['kind'],['has_trade','has_form','has_variant'],true)||(!$multiple&&$b['heading']!==$stage['title'])): ?><h5><?= ndEscape($b['heading']) ?><?php
$helpText=match($b['add']['kind']){
    'has_trade'=>'Ein Handelsname bezeichnet ein bestimmtes Präparat, das diesen Wirkstoff beziehungsweise diese Bestandteile enthält.',
    'has_form'=>'Hier siehst du, wie der Stoff oder die Kombination verabreicht wird, zum Beispiel oral, als Infusion oder als Injektion.',
    'has_variant'=>'Hier stehen andere chemische Formen eines Stoffes sowie Extrakte oder Präparate, die den Stoff enthalten oder als Quelle dafür dienen. Beispiel: Grüntee-Extrakt als Quelle für EGCG. Der Gehalt und die Zusammensetzung können je nach Präparat variieren. Den Anwendungsweg, etwa oral oder als Infusion, findest du unter „'.$vocabulary['application_title'].'“.',
    default=>null
};
$helpId='relationship-kind-help-'.$id.'-'.$blockIndex;
if($helpText): ?> <span class="ux-heading-info"><button type="button" aria-label="Information zu <?= ndEscape($b['heading']) ?>" aria-describedby="<?= $helpId ?>">ⓘ</button><p id="<?= $helpId ?>" role="tooltip"><?= ndEscape($helpText) ?></p></span><?php endif; ?></h5><?php endif; ?>
<?php foreach($b['nodes'] as $n)$renderNode($n,2); ?>
<?php if(!$multiple&&$b['add']['source']===$id): ?><?= ndStageAdd($b['add']) ?><?php endif; ?>
</div>
<?php endforeach; ?>
</div>
<?php if(($index===2&&!$middleCurrent&&!$rightCurrent&&$stage['blocks'])||($index===0&&$rightCurrent)): ?>
<div class="ux-stage-add-hint">Wähle <?= $m['drug']?'einen Wirkstoff':(str_starts_with($m['stages'][1]['title'],'Wirkstoffe und Substanzen')?'einen Wirkstoff oder eine Substanz':'ein Verfahren') ?> im mittleren Feld <?= ndEscape($m['stages'][1]['title']) ?> aus, um in diesem Feld einen weiteren Eintrag hinzuzufügen.</div>
<?php endif; ?>
</section><?php endforeach; ?>
</div></div><script type="application/json" data-stage-edges><?= json_encode($m['edges'],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?></script>
</section>
<?php return ob_get_clean();
}
