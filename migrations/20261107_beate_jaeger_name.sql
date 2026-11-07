SET NAMES utf8mb4;

-- The German homepage heading uses Jäger: https://drbeatejaeger.com/de/
UPDATE tbl_entities_nd
SET anzeigename = 'Dr. Beate Jäger', nachname = 'Jäger'
WHERE lcn_id = 542
  AND BINARY anzeigename = 'Dr. Beate Jaeger'
  AND BINARY nachname = 'Jaeger';
