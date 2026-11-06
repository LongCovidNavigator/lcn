<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/prepare_feedback.php';
$p=fbLocalDatabase();
$ideas=[
 ['Ärzte nach Krankenkassen filtern','providers','Ich möchte gezielt Ärzte finden, bei denen Long-Covid-Patienten als gesetzlich Versicherte behandelt werden. Dabei wäre wichtig, zwischen Kosten der Sprechstunde, der Behandlung und einzelner Therapien zu unterscheiden.'],
 ['Ausführlichere Erfahrungsberichte zu Behandlungen','treatments','Neben einer einfachen Bewertung möchte ich ausführlichere Erfahrungsberichte lesen können, beispielsweise zur Behandlungsdauer, individuellen Verträglichkeit und zum subjektiven Verlauf.'],
 ['Ärzte und Behandlungen als Favoriten speichern','general','Ich möchte interessante Ärzte und Behandlungen auf einer persönlichen Merkliste speichern und später wiederfinden können.'],
 ['Behandlungen nach PEM-Verträglichkeit filtern','treatments','Ich möchte besser erkennen können, welche Behandlungen andere Betroffene mit Post-Exertional Malaise als gut oder schlecht verträglich erlebt haben.'],
 ['Verbesserte Symptomsuche','symptoms','Ich wünsche mir eine einfachere Möglichkeit, Symptome zu suchen, miteinander zu vergleichen und passende Informationen zu finden.'],
 ['Arztprofile mit detaillierten Kosteninformationen','providers','Es sollte klar erkennbar sein, ob die Sprechstunde, die eigentliche Behandlung sowie angebotene Medikamente und Therapien von GKV oder PKV übernommen werden oder selbst bezahlt werden müssen.']
];
$p->beginTransaction();try{$q=$p->prepare("INSERT INTO tbl_feedback_ideas(title,description,category,moderation,display_name,seed_key) VALUES(?,?,?,'approved','LCN-Testdaten',?) ON DUPLICATE KEY UPDATE seed_key=VALUES(seed_key)");foreach($ideas as $i=>[$title,$cat,$body])$q->execute([$title,$body,$cat,'feedback-v1-'.($i+1)]);$p->commit();echo "PASS: six labeled local test ideas, no fabricated votes.\n";}catch(Throwable $e){$p->rollBack();throw $e;}
