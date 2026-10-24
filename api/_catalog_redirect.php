<?php
function lcnMergedCatalogId(PDO $p,string $type,int $id): int {
 $seen=[];
 while(!isset($seen[$id])){$seen[$id]=true;$q=$p->prepare('SELECT target_id FROM catalog_merges WHERE entity_type=? AND source_id=?');$q->execute([$type,$id]);$target=$q->fetchColumn();if(!$target)return $id;$id=(int)$target;}
 throw new RuntimeException('Ungültige Zusammenführungsweiterleitung.');
}
