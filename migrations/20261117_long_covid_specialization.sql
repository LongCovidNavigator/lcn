-- Unify specialization labels; retain assignment IDs and provider relationships.
UPDATE tbl_spezialisierungen_nd
SET spezialisierung = 'Long COVID / Post-COVID'
WHERE spezialisierung IN ('Long COVID', 'Long Covid / Post Covid');
