<?php
require_once __DIR__.'/api/_symptom_catalog.php';
require_once __DIR__.'/api/_treatment_symptom_help.php';
require_once __DIR__.'/api/_doctor_symptom_help.php';
header('Cache-Control: private, no-store');
lcnRequireAdminPage();
lcnVotingToken();
function symEscape($v): string{return htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function symParam(string $key,int $max=100): string{return is_string($_GET[$key]??null)?mb_substr(trim($_GET[$key]),0,$max):'';}
$search=symParam('q');$category=symParam('category',100);$sort=symParam('sort');
$error=false;$items=[];$categories=[];$total=0;$pending=[];$coverage=[];$directProviders=[];$providerLocations=[];$reviewAvailable=true;
try{
 $p=lcnDatabase();$categories=symCategories($p);$where=[];$args=[];
 $symId=filter_var($_GET['id']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
 if($symId){$where[]='s.sym_id=?';$args[]=$symId;}
 if($search!==''){$where[]="s.sym_name LIKE ? ESCAPE '!'";$args[]='%'.strtr($search,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';}
 if($category==='__none')$where[]="TRIM(COALESCE(s.sym_category,''))=''";
 elseif($category!==''){$where[]='TRIM(s.sym_category)=?';$args[]=$category;}
 $where=$where?implode(' AND ',$where):'1=1';
 $order=['desc'=>'s.sym_name DESC,s.sym_id','category'=>"COALESCE(s.sym_category,''),s.sym_name,s.sym_id"][$sort]??'s.sym_name,s.sym_id';
 $q=$p->prepare("SELECT s.sym_id,s.sym_name,COALESCE(s.sym_category,'') sym_category FROM tbl_symptoms s WHERE $where ORDER BY $order");$q->execute($args);$items=$q->fetchAll();
 $total=count($items);
 try{$coverage=lcnSymptomTreatmentCoverage($p,array_column($items,'sym_id'));}
 catch(Throwable $e){lcnLogApiError('symptom_treatment_coverage',$e);}
 try{
  $directProviders=lcnDirectSymptomProviders($p,array_column($items,'sym_id'));
  $providerLocations=lcnSymptomProviderLocations($p,$directProviders);
 }catch(Throwable $e){lcnLogApiError('symptom_provider_coverage',$e);}
 try{
  $votes=$p->prepare('SELECT sym_id,category_snapshot,vote FROM tbl_symptom_category_votes WHERE voter_key=?');$votes->execute([lcnExistingVoterKey()??'']);$own=[];foreach($votes as $v)$own[$v['sym_id']]=$v;
  $q=$p->prepare("SELECT s.sym_id,v.vote,COUNT(*) AS total FROM tbl_symptoms s
      JOIN tbl_symptom_category_votes v ON v.sym_id=s.sym_id
          AND v.category_snapshot=COALESCE(s.sym_category,'') COLLATE utf8mb4_general_ci
      WHERE $where GROUP BY s.sym_id,v.vote");
  $q->execute($args);$counts=[];
  foreach($q as $row)$counts[$row['sym_id']][$row['vote']]=(int)$row['total'];
  foreach($items as &$item){$v=$own[$item['sym_id']]??null;$item['counts']=$counts[$item['sym_id']]??[];$item['own_vote']=$v&&$v['category_snapshot']===$item['sym_category']?$v['vote']:null;}unset($item);
  if(lcnCurrentSiteRole()==='admin')$pending=$p->query("SELECT * FROM tbl_symptom_requests WHERE status='pending' ORDER BY id LIMIT 100")->fetchAll();
 }catch(Throwable $e){$reviewAvailable=false;lcnLogApiError('symptom_review_read',$e);}
}catch(Throwable $e){lcnLogApiError('symptoms',$e);$error=true;http_response_code(503);}
function symActions(array $r): void {global $reviewAvailable;
 $id=(int)$r['sym_id'];$vote=$r['own_vote']??null; ?>
 <div class="sym-actions" data-symptom="<?=$id?>" data-name="<?=symEscape($r['sym_name'])?>" data-category="<?=symEscape($r['sym_category'])?>">
 <?php if(trim($r['sym_category'])!==''): foreach(['confirm'=>'Bestätigen','disagree'=>'Widersprechen'] as $value=>$label): $count=(int)($r['counts'][$value]??0); ?>
 <button type="button" class="sym-vote" data-vote="<?=$value?>" aria-label="<?=$label?>: Kategorie <?=symEscape($r['sym_category'])?> · <?=$count?> Stimmen" title="<?=$label?><?=$value==='disagree'?' und passendere Kategorie vorschlagen':''?>" aria-pressed="<?=$vote===$value?'true':'false'?>" <?=$reviewAvailable?'':'disabled'?>><span aria-hidden="true"><?=$value==='confirm'?'✓':'×'?></span> <span data-count><?=$count?></span></button>
 <?php endforeach; else: ?><button type="button" class="sym-category-button" data-propose <?=$reviewAvailable?'':'disabled'?>>Kategorie vorschlagen</button><?php endif; ?></div>

<?php }
function symProviderPreview(int $symptomId, array $providers): void { ?>
    <?php if ($providers): ?>
        <ul class="sym-provider-preview">
            <?php foreach (array_slice($providers, 0, 3) as $provider): $id = $provider['dr_id']; ?>
                <li data-sym-provider-id="<?= $id ?>">
                    <a href="arzt_detail.html?id=<?= $id ?>"><?= symEscape($provider['dr_display_name']) ?></a>
                    <span class="lcn-online-badge" data-sym-online="<?= $id ?>" hidden>Erst- und Folgetermin online</span>
                    <?php if ($provider['experience_count']): ?>
                        <div><?= $provider['experience_count'] === 1 ? '1 hilfreiche Erfahrung' : $provider['experience_count'].' hilfreiche Erfahrungen' ?></div>
                    <?php endif; ?>
                </li>
            <?php endforeach; ?>
        </ul>
        <?php if (count($providers) > 3): ?><a href="symptom_detail.php?id=<?= $symptomId ?>">Alle <?= count($providers) ?> Behandler ansehen</a><?php endif; ?>
    <?php endif; ?>
    <div data-sym-nearest hidden></div>
<?php }
?><!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Symptome im Überblick – LCN</title><link rel="stylesheet" href="styles/general.css?v=mobile-table-20261107"><link rel="stylesheet" href="styles/navigation.css"><link rel="stylesheet" href="styles/feedback.css"><link rel="stylesheet" href="styles/public_detail_theme.css?v=8f1296b5fe"><link rel="stylesheet" href="styles/footer-style.css?v=b4b1163611"><link rel="stylesheet" href="styles/search_tables.css?v=symptom-table-20261108"><link rel="stylesheet" href="styles/catalog_table_alignment.css?v=fit-result-tables-20261107"><link rel="stylesheet" href="styles/symptoms.css?v=all-results"><link rel="stylesheet" href="assets/vendor/leaflet/leaflet.css"><link rel="stylesheet" href="styles/doctor_map_edges.css"><script src="assets/vendor/leaflet/leaflet.js" defer></script><script src="scripts/image-registry.js" defer></script><script src="scripts/map_viewport.js?v=direct-providers" defer></script><script src="scripts/online_access.js?v=symptom-coverage" defer></script><script src="scripts/symptom_locations.js?v=direct-providers" defer></script><script src="scripts/symptom_overview_map.js?v=direct-providers" defer></script><script src="scripts/access-nav.js?v=local-only-20261107" defer></script><script src="scripts/symptoms.js?v=all-results" defer></script><script src="scripts/feedback_context.js?v=responsive-20261107" defer data-lcn-feedback-loader></script><script src="scripts/scroll_restore.js" defer></script></head>
<body class="lcn-public-page sym-page symptom-overview"><div id="header-placeholder"><?php readfile(__DIR__.'/components/header.html'); ?></div>
<script type="application/json" id="sym-provider-locations"><?=json_encode((object)$providerLocations, JSON_HEX_TAG | JSON_INVALID_UTF8_SUBSTITUTE)?></script>
<main class="fb-shell"><header class="fb-hero"><span class="fb-eyebrow">Navigator · Übersicht</span><h1>Symptome im Überblick</h1><p>Finde Symptome und ihre Kategorien. Hilf mit, die Zuordnung zu verbessern oder fehlende Symptome zu ergänzen.</p><p class="fb-muted">Diese Übersicht ersetzt keine medizinische Einordnung. Bestätigen und Widersprechen beziehen sich auf die Kategorie, nicht auf die Beschwerden.</p></header>
<section class="sym-navigation doctor-navigation-panel" aria-labelledby="sym-navigation-title"><h2 class="sym-panel-heading doctor-navigation-header" id="sym-navigation-title"><span aria-hidden="true">☷</span> Navigation</h2><form class="fb-toolbar" id="sym-search-form" role="search"><div class="sym-search-field"><label for="sym-search">Symptom suchen</label><input id="sym-search" type="search" name="q" maxlength="100" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sym-suggestions" value="<?=symEscape($search)?>"><div id="sym-suggestions" role="listbox" aria-label="Suchvorschläge" hidden></div></div>
<label>Kategorie<select name="category"><option value="">Alle Kategorien</option><option value="__none" <?=$category==='__none'?'selected':''?>>Ohne Kategorie</option><?php foreach($categories as $c): ?><option value="<?=symEscape($c)?>" <?=$category===$c?'selected':''?>><?=symEscape($c)?></option><?php endforeach; ?></select></label>
<label>Sortierung<select name="sort"><option value="">Name A–Z</option><option value="desc" <?=$sort==='desc'?'selected':''?>>Name Z–A</option><option value="category" <?=$sort==='category'?'selected':''?>>Kategorie</option></select></label><button class="fb-button">Suchen</button><a href="symptome.php">Zurücksetzen</a></form></section>
<details class="sym-overview-map" open>
    <summary><span aria-hidden="true">▦</span> Karte</summary>
    <div class="sym-overview-map-content">
        <div class="doctor-view-switch sym-map-view-switch" role="group" aria-label="Grundlage der Karte">
            <button type="button" class="doctor-view-switch-button is-active" data-sym-map-view="providers" aria-pressed="true">Behandler</button>
            <button type="button" class="doctor-view-switch-button" data-sym-map-view="therapies" aria-pressed="false">Therapien</button>
        </div>
        <form id="sym-location-form" class="fb-toolbar" role="search" hidden>
            <div class="sym-search-field">
                <label for="sym-location-input">Standort für die Entfernung</label>
                <input id="sym-location-input" type="search" placeholder="PLZ oder Ort" autocomplete="off" required>
                <div id="sym-location-input-suggestions" class="is-hidden"></div>
            </div>
            <button class="fb-button" type="submit">Standort übernehmen</button>
            <button class="fb-secondary" type="button" id="sym-location-clear" hidden>Standort entfernen</button>
        </form>
        <p id="sym-location-error" role="alert" class="fb-error" hidden></p>
        <div id="sym-overview-map" role="region" aria-label="Standorte direkt verknüpfter Behandler"></div>
        <p id="sym-overview-map-status" role="status">Standorte werden geladen …</p>
        <p class="sym-map-marker-note" id="sym-map-marker-note">Die Zahl auf einem Marker zeigt, für wie viele der passenden Symptome dies der nächstgelegene Standort eines direkt verknüpften Behandlers ist.</p>
    </div>
</details>
<section class="sym-results doctor-results-panel" aria-label="Symptome"><div class="sym-results-bar doctor-results-header"><p role="status"><?=$total?> Symptome<?=($search!==''||$category!=='')?' gefunden':''?></p><div class="doctor-view-switch" role="group" aria-label="Ansicht wechseln"><button type="button" class="doctor-view-switch-button is-active" data-view="cards" aria-pressed="true">Kacheln</button><button type="button" class="doctor-view-switch-button" data-view="table" aria-pressed="false">Tabelle</button></div><button type="button" class="fb-secondary" id="sym-add" <?=$reviewAvailable?'':'disabled'?>>Fehlendes Symptom ergänzen</button></div>
<div id="sym-message" role="status" aria-live="polite" tabindex="-1" hidden></div>
<?php if(!$reviewAvailable): ?><p class="fb-note">Die Mitwirkung ist vorübergehend nicht verfügbar. Du kannst weiterhin alle Symptome durchsuchen.</p><?php endif; ?>
<?php if($error): ?><p class="fb-error">Die Symptome können gerade nicht geladen werden.</p><?php elseif(!$items): ?><p class="fb-note">Keine passenden Symptome gefunden. Ändere deine Filter oder schlage ein fehlendes Symptom vor.</p><?php else: ?>
<div id="sym-cards">
    <?php foreach($items as $r): $id=(int)$r['sym_id']; $treatments=$coverage[$id]??null; $matches=$directProviders[$id]??[]; ?>
        <article class="fb-card" id="symptom-<?=$id?>" data-symptom-result="<?=$id?>" data-provider-ids="<?=implode(',',array_keys($matches))?>" data-treatment-ids="<?=implode(',',$treatments??[])?>">
            <div class="fb-card-content">
                <h2><a href="symptom_detail.php?id=<?=$id?>"><?=symEscape($r['sym_name'])?></a></h2>
                <p><span class="fb-tag"><?=symEscape(trim($r['sym_category'])?:'Noch ohne Kategorie')?></span></p>
                <p class="sym-counts">
                    <?= $treatments === null ? '–' : count($treatments) ?> <?= count($treatments ?? [])===1 ? 'Behandlung' : 'Behandlungen' ?> · <?= count($matches) ?> Behandler:innen
                </p>
                <div data-sym-provider><?php symProviderPreview($id, $matches); ?></div>
                <p class="fb-muted" data-sym-location hidden></p>
                <?php symActions($r); ?>
            </div>
        </article>
    <?php endforeach; ?>
</div>
<details id="sym-table" open hidden>
    <summary class="lcn-search-table-toggle">
        <span><span aria-hidden="true">▤</span> Tabelle</span><span class="sym-table-chevron" aria-hidden="true">⌃</span>
    </summary>
    <div class="lcn-search-table-content">
    <?php
    $columns=[
        'rank'=>['Nr.','sym-rank'],
        'name'=>['Symptom',''],
        'category'=>['Kategorie','sym-desktop-column sym-category'],
        'votes'=>['Kategorisierung prüfen','sym-desktop-column sym-review-column'],
        'treatments'=>['Behandlungen','sym-desktop-column sym-number'],
        'providers'=>['Behandler:innen gesamt','sym-desktop-column sym-number'],
        'distance'=>['Entfernung / Ort','sym-distance'],
    ];
    ?>
    <div class="sym-table-order" hidden>
        <label>Ergebnisse sortieren
            <select id="sym-table-sort-field">
                <?php foreach($columns as $key=>[$label]): ?>
                <option value="<?=$key?>"><?=$key==='distance'?'Entfernung':($key==='votes'?'Kategorieabstimmung (Stimmen gesamt)':$label)?></option>
                <?php endforeach; ?>
                <option value="city">Ort</option>
            </select>
        </label>
        <button type="button" id="sym-table-sort-direction" class="fb-secondary">Aufsteigend ↑</button>
    </div>
    <table class="symptom-results-table">
        <caption>Symptome im Überblick</caption>
        <thead><tr>
            <?php foreach($columns as $key=>[$label,$class]): ?>
            <th scope="col" class="<?=$class?>">
                <button type="button" class="sym-table-sort" data-sym-sort="<?=$key?>" disabled><?=$label?></button>
            </th>
            <?php endforeach; ?>
        </tr></thead>
        <tbody>
        <?php foreach($items as $index=>$r):
            $id=(int)$r['sym_id'];
            $treatmentCount=isset($coverage[$id]) ? count($coverage[$id]) : '–';
            $providerCount=count($directProviders[$id]??[]);
            $categoryLabel=symEscape(trim($r['sym_category'])?:'Noch ohne Kategorie');
        ?>
            <tr data-symptom-result="<?=$id?>">
                <td class="sym-rank"><?=$index+1?></td>
                <th scope="row">
                    <a href="symptom_detail.php?id=<?=$id?>"><?=symEscape($r['sym_name'])?></a>
                    <div class="sym-mobile-meta">
                        <span class="sym-category-pill"><?=$categoryLabel?></span>
                        <div><?=$treatmentCount?> <?=$treatmentCount===1?'Behandlung':'Behandlungen'?> · <?=$providerCount?> Behandler:innen</div>
                        <?php symActions($r); ?>
                    </div>
                </th>
                <td class="sym-desktop-column sym-category"><span class="sym-category-pill"><?=$categoryLabel?></span></td>
                <td class="sym-desktop-column sym-review-column"><?php symActions($r); ?></td>
                <td class="sym-desktop-column sym-number"><span class="sym-count-pill"><?=$treatmentCount?></span></td>
                <td class="sym-desktop-column sym-number"><span class="sym-count-pill"><?=$providerCount?></span></td>
                <td class="sym-distance" data-sym-location>–</td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    </div>
</details>
<?php if($total>50): ?>
    <div class="fb-actions sym-more">
        <p id="sym-visible-count" role="status" hidden></p>
        <button type="button" class="fb-secondary" id="sym-show-more" aria-controls="sym-cards sym-table" hidden>Weitere 50 anzeigen</button>
    </div>
<?php endif; ?>
<?php endif; ?>
</section><?php if(lcnCurrentSiteRole()==='admin'&&$reviewAvailable): ?><details class="fb-panel" id="sym-review"><summary>Symptomvorschläge prüfen (<?=count($pending)?><?=count($pending)===100?'+':''?>)</summary><p class="fb-muted">Neue Symptome und Kategorieänderungen werden erst nach Freigabe übernommen. Angezeigt werden bis zu 100 offene Vorschläge.</p><?php foreach($pending as $r): ?><article class="fb-card" data-request="<?=(int)$r['id']?>"><div><h3><?=symEscape($r['name'])?></h3><p><?=$r['sym_id']?'Kategorie ändern: '.symEscape($r['category_snapshot']?:'Ohne Kategorie').' →':'Neues Symptom · Kategorie:'?> <?=symEscape($r['category']?:'Ohne Kategorie')?></p><p><?=symEscape($r['reason'])?></p><div class="fb-actions"><button type="button" class="fb-button" data-review="approve">Freigeben</button><button type="button" class="fb-secondary" data-review="reject">Ablehnen</button></div></div></article><?php endforeach; ?></details><?php endif; ?>
<dialog id="sym-dialog" aria-labelledby="sym-dialog-title"><form id="sym-proposal" class="fb-form"><h2 id="sym-dialog-title">Symptom ergänzen</h2><p id="sym-dialog-note">Dein Vorschlag wird vor der Übernahme geprüft.</p><label id="sym-name-label">Symptomname<input name="name" minlength="2" maxlength="100" required></label><label>Kategorie<input name="category" list="sym-categories" maxlength="100"><datalist id="sym-categories"><?php foreach($categories as $c): ?><option value="<?=symEscape($c)?>"><?php endforeach; ?></datalist></label><p class="fb-muted">Wähle eine vorhandene Kategorie oder schlage eine neue vor.</p><label>Begründung (optional)<textarea name="reason" maxlength="2000" rows="3"></textarea></label><p id="sym-dialog-error" class="fb-error" role="alert" hidden></p><div class="fb-actions"><button class="fb-button" type="submit">Vorschlag senden</button><button class="fb-secondary" type="button" id="sym-dialog-close">Abbrechen</button></div></form></dialog>
</main><div id="footer-placeholder"><?php readfile(__DIR__.'/components/footer.html'); ?></div></body></html>
