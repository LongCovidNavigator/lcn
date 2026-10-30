-- Split aromatherapy procedures from medicinal lavender oil; keep Lasea as one product.
START TRANSACTION;
UPDATE tbl_treatments_nd SET treatmentname=CONCAT(treatmentname,' (Aromatherapie)') WHERE treat_nd_id IN (724,725,726,727) AND treatmentname IN ('Pfefferminzöl','Lavendelöl','Eukalyptusöl','Rosmarinöl');
INSERT INTO tbl_treatments_nd (treatmentname,slug,typ,unterkategorie,beschreibung,wirkstoff,handels_markenname,review_status,datenstand)
SELECT 'Lavendelöl (Arzneimittel)','lavendeloel-arzneimittel','Arzneimittel','Neurologie, Psychiatrie, Schmerz und Schlaf','Arzneilich eingesetztes Lavendelöl. Lasea enthält die spezielle standardisierte Lavendelöl-Zubereitung Silexan. Der separate Eintrag Lavendelöl (Aromatherapie) beschreibt die aromatherapeutische Anwendung.','Lavendelöl','Lasea','vor_review','2026-10-28'
WHERE NOT EXISTS (SELECT 1 FROM tbl_treatments_nd WHERE treatmentname='Lavendelöl (Arzneimittel)');
SET @lavender_med_id=(SELECT treat_nd_id FROM tbl_treatments_nd WHERE treatmentname='Lavendelöl (Arzneimittel)');
-- Remove the former procedure hierarchy from Silexan and Lasea only.
DELETE c FROM tbl_cpl_treatments_nd2aliases c JOIN tbl_aliases_03 a ON a.alias_id=c.alias_id WHERE c.treat_nd_id IN (592,593) AND a.alias='Lavendelöl' AND a.alias_type='umbrella_term';
INSERT INTO tbl_aliases_03 (alias,alias_type,notes_internal)
SELECT 'Lasea','trade_name','Lavendelöl and Silexan describe the same active preparation at different levels of specificity, not two combined ingredients.' WHERE NOT EXISTS (SELECT 1 FROM tbl_aliases_03 WHERE alias='Lasea' AND alias_type='trade_name');
SET @lasea_alias_id=(SELECT MIN(alias_id) FROM tbl_aliases_03 WHERE alias='Lasea' AND alias_type='trade_name');
INSERT INTO tbl_cpl_treatments_nd2aliases (treat_nd_id,alias_id) SELECT @lavender_med_id,@lasea_alias_id WHERE NOT EXISTS (SELECT 1 FROM tbl_cpl_treatments_nd2aliases WHERE treat_nd_id=@lavender_med_id AND alias_id=@lasea_alias_id);
INSERT INTO tbl_cpl_treatments_nd2aliases (treat_nd_id,alias_id) SELECT 593,@lasea_alias_id WHERE NOT EXISTS (SELECT 1 FROM tbl_cpl_treatments_nd2aliases WHERE treat_nd_id=593 AND alias_id=@lasea_alias_id);
UPDATE tbl_treatments_nd SET beschreibung='Silexan ist die geschützte Bezeichnung der speziellen standardisierten Lavendelöl-Zubereitung in Lasea. Dieser Wirkstoffeintrag und Lavendelöl (Arzneimittel) beschreiben denselben enthaltenen Wirkstoff unterschiedlich genau. Es handelt sich nicht um zwei kombinierte Wirkstoffe.' WHERE treat_nd_id=593;
UPDATE tbl_treatments_nd SET wirkstoff='Lavendelöl (standardisierte Zubereitung Silexan)',handels_markenname='Lasea',beschreibung='Pflanzliches Arzneimittel mit Lavendelöl in der speziellen standardisierten Zubereitung Silexan. Die beiden zugeordneten Wirkstoffeinträge bezeichnen denselben enthaltenen Wirkstoff unterschiedlich genau.' WHERE treat_nd_id=592;
COMMIT;
