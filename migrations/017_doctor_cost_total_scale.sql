-- Keep historical cost answers intact; precise totals use a new question key.
INSERT IGNORE INTO doctor_community_options (question_key,context_key,option_value,label)
SELECT 'costs_total_v2',c.context_key,s.n,
 CASE WHEN c.context_key LIKE '%-CHF' THEN REPLACE(s.label,'€','CHF') ELSE s.label END
FROM doctor_community_options c
CROSS JOIN (
 SELECT 1 n,'Komplett übernommen' label UNION ALL
 SELECT 2,'Bis 100 €' UNION ALL SELECT 3,'Bis 500 €' UNION ALL
 SELECT 4,'Bis 1.000 €' UNION ALL SELECT 5,'Bis 5.000 €' UNION ALL
 SELECT 6,'Bis 10.000 €' UNION ALL SELECT 7,'Bis 25.000 €' UNION ALL
 SELECT 8,'Über 25.000 €'
) s
WHERE c.question_key='costs' AND c.option_value=1;
