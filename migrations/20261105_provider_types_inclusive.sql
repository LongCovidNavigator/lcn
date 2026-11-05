-- Correct category spelling to inclusive singular with colon.
START TRANSACTION;
UPDATE tbl_entities_nd SET behandlertyp='Ärzt:in' WHERE BINARY behandlertyp='Ärztinnen';
UPDATE tbl_entities_nd SET behandlertyp='Coach und Berater:in' WHERE BINARY behandlertyp='Coach und Beraterinnen';
UPDATE tbl_entities_nd SET behandlertyp='Ergotherapeut:in' WHERE BINARY behandlertyp='Ergotherapeutinnen';
UPDATE tbl_entities_nd SET behandlertyp='Heilpraktiker:in' WHERE BINARY behandlertyp='Heilpraktikerinnen';
UPDATE tbl_entities_nd SET behandlertyp='Naturheilkundler:in' WHERE BINARY behandlertyp='Naturheilkundlerinnen';
UPDATE tbl_entities_nd SET behandlertyp='Physiotherapeut:in' WHERE BINARY behandlertyp='Physiotherapeutinnen';
UPDATE tbl_entities_nd SET behandlertyp='Psycholog:in' WHERE BINARY behandlertyp='Psychologinnen';
UPDATE tbl_entities_nd SET behandlertyp='Psychotherapeut:in' WHERE BINARY behandlertyp='Psychotherapeutinnen';
UPDATE tbl_entities_nd SET behandlertyp='Therapeut:in' WHERE BINARY behandlertyp='Therapeutinnen';
UPDATE tbl_entities_nd SET behandlertyp='Logopäd:in' WHERE BINARY behandlertyp='Logopädinnen';
UPDATE tbl_entities_nd SET behandlertyp='Ernährungsberater:in' WHERE BINARY behandlertyp='Ernährungsberaterinnen';
UPDATE tbl_entities_nd SET behandlertyp='Osteopath:in' WHERE BINARY behandlertyp='Osteopathinnen';
UPDATE tbl_entities_nd SET behandlertyp='Content-Creator:in' WHERE BINARY behandlertyp='Content-Creatorinnen';
UPDATE tbl_entities_nd SET behandlertyp='Pflegeperson' WHERE BINARY behandlertyp='Pflegepersonen';
COMMIT;
