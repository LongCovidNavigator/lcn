ALTER TABLE doctor_votes
    ADD CONSTRAINT fk_doctor_votes_flag_event
    FOREIGN KEY (flag_event_id) REFERENCES vote_abuse_events (event_id)
    ON UPDATE RESTRICT ON DELETE SET NULL;

ALTER TABLE treatment_votes
    ADD CONSTRAINT fk_treatment_votes_flag_event
    FOREIGN KEY (flag_event_id) REFERENCES vote_abuse_events (event_id)
    ON UPDATE RESTRICT ON DELETE SET NULL;
