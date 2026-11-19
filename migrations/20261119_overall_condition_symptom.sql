INSERT INTO tbl_symptoms (sym_name)
SELECT 'Gesamtzustand'
WHERE NOT EXISTS (
    SELECT 1 FROM tbl_symptoms WHERE LOWER(TRIM(sym_name)) = 'gesamtzustand'
);
