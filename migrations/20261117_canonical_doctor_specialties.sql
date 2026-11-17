-- Canonical specialty labels are stored in the database, shared by all views.
START TRANSACTION;
UPDATE tbl_fachrichtungen_nd SET fachrichtung='Psychiatrie'
WHERE fachrichtung='Psychiatrie und Psychotherapie';
UPDATE tbl_fachrichtungen_nd SET fachrichtung='Psychosomatik'
WHERE fachrichtung IN ('Psychosomatische Medizin','Psychosomatische Medizin und Psychotherapie');
INSERT INTO tbl_fachrichtungen_nd (lcn_id,fachrichtung)
SELECT f.lcn_id,'Allgemeinmedizin' FROM tbl_fachrichtungen_nd f
WHERE f.fachrichtung='Innere und Allgemeinmedizin'
AND NOT EXISTS (SELECT 1 FROM tbl_fachrichtungen_nd existing WHERE existing.lcn_id=f.lcn_id AND existing.fachrichtung='Allgemeinmedizin');
UPDATE tbl_fachrichtungen_nd SET fachrichtung='Innere Medizin'
WHERE fachrichtung='Innere und Allgemeinmedizin';
COMMIT;
