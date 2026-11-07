<?php
require_once __DIR__.'/_doctor_online.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    $demo = ($_GET['demo'] ?? '0') === '1';
    $primaryCare = ($_GET['scope'] ?? '') === 'primary-care';
    $doctors = lcnDoctorOnlineAccess(lcnDoctorDatabase(), $demo && !$primaryCare);
    if ($demo && $primaryCare && lcnDummyDataAllowed()) {
        // Three full examples and one with an online follow-up only.
        foreach ([1093 => true, 548 => true, 1091 => true, 562 => false] as $id => $demoFirst) {
            if (!isset($doctors[$id])) continue;
            $first = $demoFirst || $doctors[$id]['first'];
            $doctors[$id] = array_replace($doctors[$id], [
                'first' => $first, 'follow' => true, 'complete' => $first, 'demo' => true,
            ]);
        }
    }
    echo json_encode(['ok' => true, 'doctors' => $doctors]);
}
catch(Throwable $error){http_response_code(503);echo json_encode(['ok'=>false,'error'=>'Online-Termine konnten nicht geladen werden.']);}
