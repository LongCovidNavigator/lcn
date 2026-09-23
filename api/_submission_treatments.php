<?php
// Existing catalog entry, shared by submission, display and approval.
const LCN_PRIMARY_CARE_TREATMENT_ID = 409;

function lcnSubmissionTreatmentIds(array $payload): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', is_array($payload['treatment_ids'] ?? null) ? $payload['treatment_ids'] : []), fn($id) => $id > 0)));
    if (($payload['primary_care'] ?? false) === true && !in_array(LCN_PRIMARY_CARE_TREATMENT_ID, $ids, true)) $ids[] = LCN_PRIMARY_CARE_TREATMENT_ID;
    return $ids;
}
