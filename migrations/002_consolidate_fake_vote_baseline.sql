INSERT INTO lcn_raw_doctor_votes (dr_id, pro, neutral, contra)
SELECT
    live.dr_id,
    live.vote_improved - COALESCE(nv.pro, 0),
    live.vote_neutral - COALESCE(nv.neutral, 0),
    live.vote_worsened - COALESCE(nv.contra, 0)
FROM tbl_drs_votes_03 live
LEFT JOIN (
    SELECT
        dr_id,
        SUM(vote = 'pro') AS pro,
        SUM(vote = 'neutral') AS neutral,
        SUM(vote = 'contra') AS contra
    FROM doctor_votes
    GROUP BY dr_id
) nv ON nv.dr_id = live.dr_id
WHERE
    live.vote_improved - COALESCE(nv.pro, 0) > 0
    OR live.vote_neutral - COALESCE(nv.neutral, 0) > 0
    OR live.vote_worsened - COALESCE(nv.contra, 0) > 0
ON DUPLICATE KEY UPDATE
    pro = lcn_raw_doctor_votes.pro + VALUES(pro),
    neutral = lcn_raw_doctor_votes.neutral + VALUES(neutral),
    contra = lcn_raw_doctor_votes.contra + VALUES(contra);

UPDATE tbl_drs_votes_03 live
LEFT JOIN (
    SELECT
        dr_id,
        SUM(vote = 'pro') AS pro,
        SUM(vote = 'neutral') AS neutral,
        SUM(vote = 'contra') AS contra
    FROM doctor_votes
    GROUP BY dr_id
) nv ON nv.dr_id = live.dr_id
SET
    live.vote_improved = COALESCE(nv.pro, 0),
    live.vote_neutral = COALESCE(nv.neutral, 0),
    live.vote_worsened = COALESCE(nv.contra, 0);

INSERT INTO lcn_raw_votes (
    __source,
    __entity_type,
    __payload_hash,
    Behandlung,
    pro,
    neutral,
    contra
)
SELECT
    'lcn_fake_live_consolidation_20260816',
    'treatment_fake_baseline',
    SHA2(CONCAT('lcn_fake_live_consolidation_20260816:', live.Behandlung), 256),
    live.Behandlung,
    live.pro - COALESCE(nv.pro, 0),
    live.neutral - COALESCE(nv.neutral, 0),
    live.contra - COALESCE(nv.contra, 0)
FROM lcn_votes live
LEFT JOIN (
    SELECT
        treatment.behandlung,
        SUM(vote.vote = 'pro') AS pro,
        SUM(vote.vote = 'neutral') AS neutral,
        SUM(vote.vote = 'contra') AS contra
    FROM treatment_votes vote
    INNER JOIN tbl_treatments_03 treatment ON treatment.treat_id = vote.treat_id
    GROUP BY treatment.behandlung
) nv
    ON nv.behandlung COLLATE utf8mb4_unicode_ci
     = live.Behandlung COLLATE utf8mb4_unicode_ci
WHERE
    live.pro - COALESCE(nv.pro, 0) > 0
    OR live.neutral - COALESCE(nv.neutral, 0) > 0
    OR live.contra - COALESCE(nv.contra, 0) > 0
ON DUPLICATE KEY UPDATE
    Behandlung = VALUES(Behandlung),
    pro = VALUES(pro),
    neutral = VALUES(neutral),
    contra = VALUES(contra);

UPDATE lcn_votes live
LEFT JOIN (
    SELECT
        treatment.behandlung,
        SUM(vote.vote = 'pro') AS pro,
        SUM(vote.vote = 'neutral') AS neutral,
        SUM(vote.vote = 'contra') AS contra
    FROM treatment_votes vote
    INNER JOIN tbl_treatments_03 treatment ON treatment.treat_id = vote.treat_id
    GROUP BY treatment.behandlung
) nv
    ON nv.behandlung COLLATE utf8mb4_unicode_ci
     = live.Behandlung COLLATE utf8mb4_unicode_ci
SET
    live.pro = COALESCE(nv.pro, 0),
    live.neutral = COALESCE(nv.neutral, 0),
    live.contra = COALESCE(nv.contra, 0);
