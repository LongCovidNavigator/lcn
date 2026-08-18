-- Valentina O. Puntmann: Dublette 659 in den kanonischen Datensatz 673 mergen.
-- Wiederholbar fuer die lokale und die gehostete lcn_database.

START TRANSACTION;

SET @puntmann_canonical_id := 673;
SET @puntmann_duplicate_id := 659;

UPDATE tbl_drs_03
SET dr_type = 'physician',
    dr_is_dr = 1,
    dr_title_raw = 'Priv.-Doz. Dr. Dr.',
    dr_firstname = 'Valentina O.',
    dr_lastname = 'Puntmann',
    dr_org_name = 'Kardiologische Privatpraxis Priv.-Doz. Dr. Dr. Valentina O. Puntmann',
    dr_display_name = 'Priv.-Doz. Dr. Dr. Valentina O. Puntmann',
    dr_website = 'https://www.valentinapuntmann.com/',
    dr_email = 'secretary@valentinapuntmann.com',
    dr_accepts_gkv = 'no',
    dr_accepts_pkv = 'yes'
WHERE dr_id = @puntmann_canonical_id;

-- Bei einer Doppelbewertung bleibt die Stimme am kanonischen Profil erhalten.
DELETE duplicate_vote
FROM doctor_votes AS duplicate_vote
INNER JOIN doctor_votes AS canonical_vote
        ON canonical_vote.voter_key = duplicate_vote.voter_key
       AND canonical_vote.dr_id = @puntmann_canonical_id
WHERE duplicate_vote.dr_id = @puntmann_duplicate_id;

UPDATE doctor_votes
SET dr_id = @puntmann_canonical_id
WHERE dr_id = @puntmann_duplicate_id;

-- Importierte Ausgangsstimmen beider Profile addieren.
INSERT INTO lcn_raw_doctor_votes (dr_id, pro, neutral, contra)
SELECT @puntmann_canonical_id, SUM(pro), SUM(neutral), SUM(contra)
FROM lcn_raw_doctor_votes
WHERE dr_id IN (@puntmann_canonical_id, @puntmann_duplicate_id)
HAVING COUNT(*) > 0
ON DUPLICATE KEY UPDATE
    pro = VALUES(pro), neutral = VALUES(neutral), contra = VALUES(contra);

DELETE FROM lcn_raw_doctor_votes WHERE dr_id = @puntmann_duplicate_id;

INSERT INTO tbl_drs_votes_03
    (dr_id, vote_improved, vote_neutral, vote_worsened)
SELECT @puntmann_canonical_id,
       SUM(vote_improved), SUM(vote_neutral), SUM(vote_worsened)
FROM tbl_drs_votes_03
WHERE dr_id IN (@puntmann_canonical_id, @puntmann_duplicate_id)
HAVING COUNT(*) > 0
ON DUPLICATE KEY UPDATE
    vote_improved = VALUES(vote_improved),
    vote_neutral = VALUES(vote_neutral),
    vote_worsened = VALUES(vote_worsened);

DELETE FROM tbl_drs_votes_03 WHERE dr_id = @puntmann_duplicate_id;

-- Fachrichtungen und Behandlungen vereinigen.
INSERT IGNORE INTO tbl_cpl_drs2terms_03
    (dr_id, term_id, source_id, confidence, created_at)
SELECT @puntmann_canonical_id, term_id, source_id, confidence, created_at
FROM tbl_cpl_drs2terms_03
WHERE dr_id = @puntmann_duplicate_id;

DELETE FROM tbl_cpl_drs2terms_03 WHERE dr_id = @puntmann_duplicate_id;

INSERT IGNORE INTO tbl_cpl_drs2treatments_03
    (dr_id, treat_id, sort_order, note, created_at, updated_at)
SELECT @puntmann_canonical_id, treat_id, sort_order, note, created_at, updated_at
FROM tbl_cpl_drs2treatments_03
WHERE dr_id = @puntmann_duplicate_id;

DELETE FROM tbl_cpl_drs2treatments_03 WHERE dr_id = @puntmann_duplicate_id;

-- Beide Herkunftsdatensaetze bleiben nachvollziehbar erhalten.
UPDATE tbl_drs_sources_03
SET dr_id = @puntmann_canonical_id
WHERE dr_id = @puntmann_duplicate_id;

UPDATE tbl_drs_locations_03
SET loc_label = 'Kardiologische Privatpraxis',
    loc_is_primary = 1,
    loc_country = 'DE',
    loc_plz = '60325',
    loc_city = 'Frankfurt am Main',
    loc_street = 'Bockenheimer Landstraße',
    loc_housenumber = '23',
    loc_phone = '+49 69 677016312',
    loc_email = 'secretary@valentinapuntmann.com',
    loc_website = 'https://www.valentinapuntmann.com/appointments',
    loc_lat = 50.1158107,
    loc_lng = 8.6680288,
    loc_address_visibility = 'full',
    loc_geo_type = 'Point'
WHERE dr_id = @puntmann_canonical_id AND loc_is_primary = 1;

DELETE FROM tbl_drs_locations_03 WHERE dr_id = @puntmann_duplicate_id;

-- Zweiter Standort laut Praxiswebsite; Koordinaten lokal geokodiert.
INSERT INTO tbl_drs_locations_03
    (dr_id, loc_label, loc_is_primary, loc_country, loc_plz, loc_city,
     loc_street, loc_housenumber, loc_phone, loc_email, loc_website,
     loc_lat, loc_lng, loc_address_visibility, loc_geo_type)
SELECT @puntmann_canonical_id,
       'Kardiologische Privatpraxis – Standort 2', 0, 'DE', '60325',
       'Frankfurt am Main', 'Erlenstraße', '2', NULL,
       'secretary@valentinapuntmann.com',
       'https://www.valentinapuntmann.com/appointments',
       50.1110632, 8.6610319, 'full', 'Point'
WHERE EXISTS (SELECT 1 FROM tbl_drs_03 WHERE dr_id = @puntmann_canonical_id)
  AND NOT EXISTS (
      SELECT 1 FROM tbl_drs_locations_03
      WHERE dr_id = @puntmann_canonical_id
        AND loc_plz = '60325'
        AND loc_street = 'Erlenstraße'
        AND loc_housenumber = '2'
  );

DELETE FROM tbl_drs_03 WHERE dr_id = @puntmann_duplicate_id;

COMMIT;

-- Kontrolle: genau ein Profil und zwei Standorte.
SELECT dr_id, dr_display_name, dr_website, dr_email
FROM tbl_drs_03
WHERE dr_id IN (@puntmann_canonical_id, @puntmann_duplicate_id);

SELECT loc_id, dr_id, loc_label, loc_street, loc_housenumber,
       loc_plz, loc_city, loc_lat, loc_lng
FROM tbl_drs_locations_03
WHERE dr_id = @puntmann_canonical_id
ORDER BY loc_is_primary DESC, loc_id ASC;
