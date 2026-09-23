UPDATE doctor_community_options
SET label = CASE option_value
 WHEN 1 THEN 'Hohe Belastung'
 WHEN 2 THEN 'Etwas belastender'
 WHEN 3 THEN 'Gut angepasst'
 WHEN 4 THEN 'Sehr gut angepasst'
 WHEN 5 THEN 'Individuell anpassbar'
 END
WHERE question_key = 'adaptation' AND context_key = '' AND option_value BETWEEN 1 AND 5;
