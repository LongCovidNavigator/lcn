<?php
/** Additive, repeatable local migration. Never changes alias names/types or existing links. */
if(PHP_SAPI!=='cli') { http_response_code(404); exit; }
require_once __DIR__.'/../api/_treatments_nd.php';
$p=lcnTreatmentsNdDatabase();
$before=lcnNdRows($p,'SELECT treat_nd_id,alias_id,note FROM tbl_cpl_treatments_nd2aliases ORDER BY treat_nd_id,alias_id');
$aliases=lcnNdRows($p,'SELECT alias_id,alias,alias_type FROM tbl_aliases_03 ORDER BY alias_id');
if(!lcnNdRows($p,"SHOW COLUMNS FROM tbl_cpl_treatments_nd2aliases LIKE 'relation_type'"))
 $p->exec("ALTER TABLE tbl_cpl_treatments_nd2aliases ADD COLUMN relation_type ENUM('reference','group_member','application_form','substance_variant','detailed_method') NULL DEFAULT NULL COMMENT 'Explicit relationship on this coupling; NULL means unspecified'");
$groups=['Blutwäsche','H1-Antihistaminika','H2-Blocker','Kortikosteroide','Wearables','Stimulanzien','stimulanznahe Ansätze','Aminosäuren','Achtsamkeit','Kinesiologie','Atemtherapie','Psychotherapie','Physiotherapie','Infusionstherapie','Innovative Bewegungstherapie','Ernährungsumstellung','Nervensystemregulierende Maßnahmen','Entgiftung','Magnetfeldtherapie','Strategien zur Stressreduktion','Yoga','Qigong','Vagusnerv-Stimulation','Photobiomodulation (PBM)','Kryotherapie','Sauna','Darmsanierung','Osteopathie','Chelattherapie','Aromatherapie','Atemübungen','Ozontherapie','Massage','Akupressur','Immunologische Diagnostik','Wasserstofftherapie','Cannabistherapie'];
// Explicit reviewed pairs, not runtime text recognition. Unclear legacy links stay NULL.
$pairs=[
 ['NAD⁺','NAD⁺-Infusion','application_form'],['NAD⁺','NAD⁺ (oral)','application_form'],['NAD⁺','NAD⁺ (subkutan)','application_form'],
 ['Magnesium','Magnesiumphosphat','substance_variant'],['Magnesium','Magnesium-Infusion','application_form'],
 ['Vitamin D','Vitamin D3','substance_variant'],['Alpha-Liponsäure','R-Alpha-Liponsäure','substance_variant'],
 ['Glutathion','S-Acetyl-Glutathion','substance_variant'],['Lithium','Lithiumorotat','substance_variant'],
];
$p->beginTransaction();
try{
 $set=$p->prepare("UPDATE tbl_cpl_treatments_nd2aliases c JOIN tbl_aliases_03 a ON a.alias_id=c.alias_id JOIN tbl_treatments_nd t ON t.treat_nd_id=c.treat_nd_id SET c.relation_type=? WHERE a.alias=? AND a.alias_type='umbrella_term' AND t.treatmentname=? AND c.relation_type IS NULL");
 foreach($pairs as [$alias,$name,$type])$set->execute([$type,$alias,$name]);
 $members=$p->prepare("UPDATE tbl_cpl_treatments_nd2aliases c JOIN tbl_aliases_03 a ON a.alias_id=c.alias_id JOIN tbl_treatments_nd t ON t.treat_nd_id=c.treat_nd_id SET c.relation_type='group_member' WHERE a.alias=? AND a.alias_type='umbrella_term' AND t.treatmentname<>a.alias AND c.relation_type IS NULL");
 foreach($groups as $name)$members->execute([$name]);
 $p->exec("UPDATE tbl_cpl_treatments_nd2aliases c JOIN tbl_aliases_03 a ON a.alias_id=c.alias_id JOIN tbl_treatments_nd t ON t.treat_nd_id=c.treat_nd_id SET c.relation_type='reference' WHERE a.alias_type IN ('umbrella_term','application_form','substance_variant','detailed_method') AND (a.alias=t.treatmentname OR (a.alias='H2-Blocker' AND t.treatmentname='H2-Antihistaminika') OR (a.alias='Folat' AND t.treatmentname='Folat (Supplementierung)')) AND c.relation_type IS NULL");
 $p->exec("UPDATE tbl_cpl_treatments_nd2aliases c JOIN tbl_aliases_03 a ON a.alias_id=c.alias_id SET c.relation_type=a.alias_type WHERE a.alias_type IN ('application_form','substance_variant','detailed_method') AND c.relation_type IS NULL");
 if($before!==lcnNdRows($p,'SELECT treat_nd_id,alias_id,note FROM tbl_cpl_treatments_nd2aliases ORDER BY treat_nd_id,alias_id')||$aliases!==lcnNdRows($p,'SELECT alias_id,alias,alias_type FROM tbl_aliases_03 ORDER BY alias_id'))throw new RuntimeException('Existing search data changed');
 $p->commit();
 echo "PASS: alias names, types, notes and all existing links unchanged.\n";
 echo json_encode(lcnNdRows($p,"SELECT relation_type,COUNT(*) AS count FROM tbl_cpl_treatments_nd2aliases c JOIN tbl_aliases_03 a ON a.alias_id=c.alias_id WHERE a.alias_type IN ('umbrella_term','application_form','substance_variant','detailed_method') GROUP BY relation_type"),JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL;
}catch(Throwable $e){$p->rollBack();throw $e;}
