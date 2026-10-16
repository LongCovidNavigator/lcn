-- Demo fixture: Störring qualifies for online first AND follow-up appointments.
-- Real community answers and researched practice fields are not changed.
UPDATE doctor_community_dummy_answers
SET option_value=1
WHERE dr_id=608 AND question_key IN ('appointment_first_video','appointment_followup_video') AND context_key='';
