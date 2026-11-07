<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__.'/prepare_feedback.php';

$ideas = [
    'feedback-v2-1' => ['Schneller sehen, wer welche Therapien anbietet', 'navigation',
        'Die angebotenen Therapien sollen auf der Detailseite von Behandler:innen in einem eigenen Reiter „Therapien“ angezeigt werden.'],
    'feedback-v2-3' => ['Einfachere Detailseiten für Behandler:innen und Therapien', 'general',
        'Auf den Detailseiten von Behandler:innen und Therapien muss ich mich durch mehrere Bereiche klicken, um die verschiedenen Abstimmungen zu finden. Dabei verliere ich schnell den Überblick. Mir würde eine einzige Abstimmung pro Detailseite reichen, bei der ich angeben kann, wie sich mein Gesundheitszustand im Verlauf der Behandlung oder Therapie entwickelt hat.'],
    'feedback-v2-6' => ['Kommentarbereich: Erfahrungsberichte zu Behandler:innen', 'reviews',
        'Auf der Detailseite von Behandler:innen soll es einen Kommentarbereich geben. Dort möchte ich Erfahrungen mit der Betreuung, der Kommunikation und dem Ablauf in der Praxis lesen und teilen können.'],
    'feedback-v1-2' => ['Kommentarbereich: Erfahrungsberichte zu Therapien', 'reviews',
        'Auf der Detailseite einer Therapie soll es einen Kommentarbereich geben. Dort möchte ich Erfahrungen zur Anwendung, Dauer, Verträglichkeit und persönlich wahrgenommenen Wirkung lesen und teilen können.'],
    'feedback-v2-8' => ['Persönlicher Bereich mit Login', 'general',
        'Ich möchte mich anmelden und interessante Behandler:innen und Therapien, eigene Präferenzen und Symptome speichern. In meinem Profil möchte ich auch festhalten können, welche Therapien ich ausprobiert habe und wie mein bisheriger Weg aussieht.'],
];

$db = fbLocalDatabase();
$db->beginTransaction();
try {
    $db->exec("UPDATE tbl_feedback_ideas SET moderation='archived'
        WHERE seed_key IN ('feedback-v1-1','feedback-v1-3','feedback-v1-4','feedback-v1-5','feedback-v1-6',
            'feedback-v2-2','feedback-v2-4','feedback-v2-5','feedback-v2-7')
        AND moderation='approved'");

    $update = $db->prepare("UPDATE tbl_feedback_ideas SET title=?, category=?, description=? WHERE seed_key=?");
    foreach (['feedback-v2-1', 'feedback-v2-3', 'feedback-v2-6', 'feedback-v1-2'] as $key) {
        $update->execute([...$ideas[$key], $key]);
    }

    $insert = $db->prepare("INSERT INTO tbl_feedback_ideas(title,description,category,moderation,display_name,seed_key)
        VALUES(?,?,?,'approved','LCN-Testdaten',?) ON DUPLICATE KEY UPDATE seed_key=VALUES(seed_key)");
    foreach ($ideas as $key => [$title, $category, $description]) {
        $insert->execute([$title, $description, $category, $key]);
    }
    $db->commit();
    echo "PASS: five local feedback proposals seeded. Superseded proposals archived.\n";
} catch (Throwable $error) {
    $db->rollBack();
    throw $error;
}
