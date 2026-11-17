<?php
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../api/_doctor_hybrid.php';$p=lcnDatabase();
echo json_encode($p->query('SHOW CREATE TABLE tbl_fachrichtungen_nd')->fetch(),JSON_UNESCAPED_UNICODE)."\n";
echo json_encode($p->query("SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='tbl_fachrichtungen_nd'")->fetchAll())."\n";
echo json_encode($p->query("SELECT * FROM tbl_fachrichtungen_nd WHERE fachrichtung IN ('Psychiatrie','Psychiatrie und Psychotherapie','Psychosomatische Medizin','Psychosomatische Medizin und Psychotherapie','Innere und Allgemeinmedizin')")->fetchAll(),JSON_UNESCAPED_UNICODE);
