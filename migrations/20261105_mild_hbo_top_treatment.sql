-- Separate low-pressure hyperbaric therapy from conventional HBOT.
-- Sources checked 2026-11-05; selection is editorial, not evidence of efficacy.
START TRANSACTION;
INSERT INTO tbl_treatments_nd
(treatmentname,slug,typ,unterkategorie,beschreibung,durchfuehrungssetting,weitere_hinweise,review_status,datenstand,is_top_treatment,notes_internal)
SELECT 'Milde hyperbare Sauerstofftherapie (milde HBO / mHBOT)',
'milde-hyperbare-sauerstofftherapie-mhbot','Medizinische Prozeduren','Hyperbare Verfahren',
'Als milde HBO oder mHBOT bezeichnete Anwendungen in einer Druckkammer mit niedrigem Überdruck, häufig etwa 1,2–1,5 ATA absolut. Atemgas und Sauerstoffkonzentration variieren nach Verfahren; teilweise wird komprimierte Umgebungsluft verwendet. Eigenständiger Eintrag, getrennt von der konventionellen hyperbaren Sauerstofftherapie mit höheren Drücken und hochkonzentriertem Sauerstoff. Studien zur konventionellen HBOT belegen nicht automatisch die Wirksamkeit milder Verfahren. Ein gesicherter Nutzen bei Long COVID oder ME/CFS ist für milde HBO nicht nachgewiesen.',
'Druckkammeranwendung mit fachkundiger Betreuung und Prüfung der individuellen Eignung; die Bezeichnung mild oder Wellness ersetzt keine medizinische und technische Sicherheitsbewertung.',
'Auch bei niedrigem Überdruck bestehen unter anderem Druckausgleichs- und Barotrauma-Risiken; bei Sauerstoffanreicherung kommt Brandgefahr hinzu. ECHM/EUBS ordnen auch milde hyperbare Anwendungen als medizinische Prozeduren ein. Niedriger Druck bedeutet nicht automatisch eine nichtmedizinische oder risikofreie Anwendung.',
'vor_review','2026-11-05',1,
'Quellen: https://www.eubs.org/wp-content/uploads/2022/12/ECHM-EUBS-Position-Statement-Mild-Hyperbaric-Therapies-20.12.22.pdf ; https://www.uhms.org/resources/featured-resources/hbo-indications.html ; https://pmc.ncbi.nlm.nih.gov/articles/PMC11997836/ . Separat von HBOT (ID 14); keine Übertragung von Bewertungen oder Anbieterbeziehungen.'
WHERE NOT EXISTS (SELECT 1 FROM tbl_treatments_nd WHERE slug='milde-hyperbare-sauerstofftherapie-mhbot' OR treatmentname='Milde hyperbare Sauerstofftherapie (milde HBO / mHBOT)');
UPDATE tbl_treatments_nd SET is_top_treatment=1 WHERE slug='milde-hyperbare-sauerstofftherapie-mhbot';
SET @mild_hbo_id=(SELECT treat_nd_id FROM tbl_treatments_nd WHERE slug='milde-hyperbare-sauerstofftherapie-mhbot');
INSERT INTO tbl_aliases_03 (alias,alias_type,notes_internal)
SELECT 'mHBOT','abbreviation','Milde HBO; nicht als Synonym der konventionellen HBOT verknüpfen.' WHERE NOT EXISTS (SELECT 1 FROM tbl_aliases_03 WHERE alias='mHBOT' AND alias_type='abbreviation');
SET @mild_alias_id=(SELECT MIN(alias_id) FROM tbl_aliases_03 WHERE alias='mHBOT' AND alias_type='abbreviation');
INSERT INTO tbl_cpl_treatments_nd2aliases (treat_nd_id,alias_id)
SELECT @mild_hbo_id,@mild_alias_id WHERE NOT EXISTS (SELECT 1 FROM tbl_cpl_treatments_nd2aliases WHERE treat_nd_id=@mild_hbo_id AND alias_id=@mild_alias_id);
COMMIT;
