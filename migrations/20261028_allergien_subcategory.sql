-- Rename the therapy subcategory consistently in both local catalogs.
UPDATE tbl_treatments_03
SET unterkategorie = 'Allergien und Mastzellaktivierung'
WHERE unterkategorie = 'Allergie und Mastzellaktivierung';

UPDATE tbl_treatments_nd
SET unterkategorie = 'Allergien und Mastzellaktivierung'
WHERE unterkategorie = 'Allergie und Mastzellaktivierung';