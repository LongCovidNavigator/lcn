<?php
/** Combination parent and its components keep the same positions on both page types. */
function ndRenderTreatmentCombinations(array $g,int $id): string {
    $ids=$g['combinations'][$id]??[];if(isset($g['comboIds'][$id]))$ids=[$id=>$id]+$ids;
    $diagnostic=($g['entries'][$id]['typ']??'')==='Diagnostik';$marked=false;
    $renderName=static function(?int $target,string $name)use($id,&$marked):void{
        if($target===$id){if(!$marked){echo '<small class="ux-combination-current">Du bist hier</small>';$marked=true;}echo '<strong>'.ndEscape($name).'</strong>';}
        elseif($target)echo '<a href="therapie_detail.php?treatment_id='.$target.'#alternativen">'.ndEscape($name).'</a>';
        else echo '<strong>'.ndEscape($name).'</strong>';
    };
    ob_start(); ?>
<section class="card ux-combinations" data-combination-section>
<h3><?= $diagnostic?'Kombinierte Untersuchungen':'Kombinationstherapien' ?> <span class="ux-heading-info"><button type="button" aria-label="Information zu Kombinationen" aria-describedby="therapy-combinations-help">ⓘ</button><p id="therapy-combinations-help" role="tooltip"><?= $diagnostic?'Hier sammelt die Community Untersuchungen, die gemeinsam durchgeführt werden, und zeigt die Bestandteile solcher Kombinationen. Eine Zuordnung bedeutet nicht, dass alle Untersuchungen immer zusammen nötig sind.':'Welche anderen Behandlungen werden zusammen mit dieser Therapie eingesetzt? Hier sammelt die Community solche Kombinationen und ihre Bestandteile. Du kannst eine vorhandene Kombination zuordnen oder eine neue ergänzen. Die gemeinsame Anwendung ist eine Möglichkeit, keine Pflicht: Ein Eintrag bedeutet weder, dass die Kombination für dich geeignet ist, noch dass sie zusammen angewendet werden muss.' ?> Noch ungeprüfte Vorschläge sind gekennzeichnet.</p></span></h3>
<p class="ux-combination-intro"><?= isset($g['comboIds'][$id])?'Diese Kombination und ihre Bestandteile.':'Kombinationen, mit denen diese Therapie verknüpft ist.' ?></p>
<?php if(!$ids): ?><p class="ux-combination-empty">Noch keine Kombination hinterlegt. Du kannst eine vorhandene Kombination verknüpfen oder eine neue vorschlagen.</p><?php endif; ?>
<?php foreach($ids as $combo):
    $parts=[];foreach($g['components'][$combo]??[] as $part)$parts[]=['id'=>$part,'name'=>$g['entries'][$part]['treatmentname'],'key'=>'cp:'.$combo.':'.$part,'alias'=>false];
    foreach($g['componentNames'][$combo]??[] as $key=>$name)$parts[]=['id'=>null,'name'=>$name,'key'=>'cn:'.$combo.':'.substr(hash('sha256',lcnDiscoveryName($name)),0,24),'alias'=>false];
    if($combo!==$id&&!isset($g['components'][$combo][$id]))$parts[]=['id'=>$id,'name'=>$g['entries'][$id]['treatmentname'],'key'=>'cp:'.$combo.':'.$id,'alias'=>true];
    $addPart=$combo===$id;$count=count($parts)+($addPart?1:0);
?>
<div class="ux-combination-tree" data-combination-tree="<?= $combo ?>"><div class="ux-combination-drawing" style="--combination-columns:<?= max(1,$count) ?>">
<svg class="ux-combination-lines" aria-hidden="true"></svg>
<article class="ux-combination-parent<?= $combo===$id?' is-current':'' ?>" data-combination-parent data-combination-entry="<?= $combo ?>"><?php $renderName($combo,$g['entries'][$combo]['treatmentname']); ?><div class="ux-combination-assertion"><span data-treatment-relation-feedback="combo:<?= $combo ?>" data-feedback-statement="<?= ndEscape('„'.$g['entries'][$combo]['treatmentname'].'“ ist eine Kombination aus den angezeigten Bestandteilen.') ?>" data-feedback-standard="1"></span></div>
</article>
<p class="ux-combination-parts-label">Bestandteile<?= array_filter($parts,fn($p)=>$p['alias'])?' und weitere Alias-Verknüpfungen':'' ?></p>
<div class="ux-combination-parts">
<?php foreach($parts as $part):
    $statement='„'.$part['name'].'“ '.($part['alias']?'ist über eine Alias-Verknüpfung verbunden mit':'ist Bestandteil von').' „'.$g['entries'][$combo]['treatmentname'].'“.';
?>
<article class="ux-combination-part ux-relation-entry<?= $part['id']===$id?' is-current':'' ?>" data-combination-part data-component-id="<?= (int)$part['id'] ?>"><?php $renderName($part['id'],$part['name']); ?>
<?php if(!$part['id']): ?><small>Noch keine eigene Detailseite zugeordnet.</small><?php endif; ?>
<div class="ux-combination-assertion"><span data-treatment-relation-feedback="<?= ndEscape($part['key']) ?>" data-feedback-statement="<?= ndEscape($statement) ?>" data-feedback-standard="1"></span></div>
</article>
<?php endforeach; ?>
<?php if($addPart): ?><button type="button" class="ux-combination-add-part" data-combination-add-part data-treatment-relation-add data-kind="has_component" data-source-id="<?= $combo ?>" data-dialog-title="Bestandteil hinzufügen">＋ Bestandteil hinzufügen</button><?php endif; ?>
</div>
<?php if(!empty($g['componentIncomplete'][$combo])): ?><p class="ux-combination-empty">Weitere Bestandteile sind noch nicht eindeutig zugeordnet.</p><?php endif; ?>
</div></div>
<?php endforeach; ?>
<div class="ux-combination-actions">
<button type="button" data-treatment-relation-add data-kind="component_of" data-dialog-title="Mit vorhandener Kombination verknüpfen">＋ Mit vorhandener Kombination verknüpfen</button>
<button type="button" data-combination-create>＋ Neue Kombination mit <?= ndEscape($g['entries'][$id]['treatmentname']) ?> erstellen</button>
</div>
</section>
<?php return ob_get_clean();
}
