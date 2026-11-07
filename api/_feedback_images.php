<?php
require_once __DIR__.'/_feedback.php';
function fbImagesReady(PDO $p): bool {
 try{$p->query('SELECT id FROM tbl_feedback_images LIMIT 0');return true;}catch(PDOException $e){if($e->getCode()==='42S02')return false;throw $e;}
}
function fbImageEnabled(): bool {
 return lcnEnv('LCN_FEEDBACK_AI_ENABLED','0')==='1' && preg_match('/\A[a-f0-9]{32}\z/i',lcnEnv('LCN_CLOUDFLARE_ACCOUNT_ID',''))===1 && trim(lcnEnv('LCN_CLOUDFLARE_AI_TOKEN',''))!=='' && extension_loaded('curl');
}
function fbImageToken($id): string {
 if(!is_string($id)||!preg_match('/\A[a-f0-9]{32}\z/',$id))throw new InvalidArgumentException('Ungültiges Bild.');return $id;
}
function fbImageDecode(string $raw): array {
 $data=json_decode($raw,true);$encoded=$data['result']['image']??null;
 if(!is_array($data)||($data['success']??false)!==true||!is_string($encoded))throw new RuntimeException('Invalid image response');
 $binary=base64_decode($encoded,true);if($binary===false||strlen($binary)>2500000)throw new RuntimeException('Invalid image size');
 $info=@getimagesizefromstring($binary);if(!$info||!in_array($info['mime']??'',['image/jpeg','image/png','image/webp'],true)||$info[0]>2048||$info[1]>2048)throw new RuntimeException('Invalid image format');
 return [$binary,$info['mime']];
}
function fbRunCloudflareAi(string $model, array $input, int $timeout, int $maxBytes): string {
 $url = 'https://api.cloudflare.com/client/v4/accounts/'.lcnEnv('LCN_CLOUDFLARE_ACCOUNT_ID').'/ai/run/'.$model;
 $request = curl_init($url);
 $response = '';
 curl_setopt_array($request, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Authorization: Bearer '.lcnEnv('LCN_CLOUDFLARE_AI_TOKEN'), 'Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode($input, JSON_THROW_ON_ERROR),
  CURLOPT_CONNECTTIMEOUT => min(10, $timeout),
  CURLOPT_TIMEOUT => $timeout,
  CURLOPT_FOLLOWLOCATION => false,
  CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
  CURLOPT_WRITEFUNCTION => static function ($request, $chunk) use (&$response, $maxBytes) {
   if (strlen($response) + strlen($chunk) > $maxBytes) return 0;
   $response .= $chunk;
   return strlen($chunk);
  },
 ]);
 try {
  $ok = curl_exec($request);
  $status = curl_getinfo($request, CURLINFO_RESPONSE_CODE);
  if ($ok === false || $status !== 200) throw new RuntimeException('Workers AI unavailable for '.$model.', HTTP '.$status);
  return $response;
 } finally {
  curl_close($request);
 }
}

function fbImageScene(string $subject): string {
 $instructions = 'You write English captions for illustrations of proposed features on the Long Covid Navigator website. '
  .'The input can be a German title or a concrete motif. Keep the feature that distinguishes it, including what a filter filters for. '
  .'Depict the specific action using recognizable objects. Preserve objects requested explicitly. '
  .'Output only one short English sentence describing what to draw. No heading, explanation, quoted title, visible text or personal details. '
  .'Example: "Benachrichtigung bei neuen Kommentaren" becomes "A notification bell with a bright alert dot beside two overlapping speech bubbles." '
  .'Example: "Merkliste teilen" becomes "A bookmark ribbon on a small list card with a share arrow pointing to a second card."';
 $raw = fbRunCloudflareAi('@cf/meta/llama-3.1-8b-instruct-fp8-fast', [
  'messages' => [
   ['role' => 'system', 'content' => $instructions],
   ['role' => 'user', 'content' => $subject],
  ],
  'max_tokens' => 100,
  'temperature' => 0.2,
 ], 10, 16000);
 $data = json_decode($raw, true);
 $scene = $data['result']['response'] ?? null;
 if (($data['success'] ?? false) !== true || !is_string($scene) || trim($scene) === '' || mb_strlen($scene) > 700) {
  throw new RuntimeException('Invalid Workers AI scene response');
 }
 return trim($scene);
}

function fbImageGenerate(string $subject): array {
 $scene = fbImageScene($subject);
 $prompt = "Draw this scene: {$scene}. Simple paper-cut illustration in muted blue and cream on a plain background. "
  .'Keep key objects centered and recognizable for a landscape crop. No lettering, logos or photorealism.';
 return fbImageDecode(fbRunCloudflareAi('@cf/black-forest-labs/flux-1-schnell', ['prompt' => $prompt, 'steps' => 4], 45, 4000000));
}
function fbImageAttach(PDO $p,string $id,int $idea): void {
 $q=$p->prepare('UPDATE tbl_feedback_images SET idea_id=? WHERE id=? AND owner_key=? AND idea_id IS NULL AND created_at>DATE_SUB(NOW(),INTERVAL 1 DAY)');$q->execute([$idea,fbImageToken($id),lcnVoterKey()]);if($q->rowCount()!==1)throw new InvalidArgumentException('Das ausgewählte Bild ist abgelaufen oder nicht verfügbar. Bitte wähle ein anderes Bild.');
}
function fbImageIds(PDO $p,array $ids): array {
 if(!$ids||!fbImagesReady($p))return [];$q=$p->prepare('SELECT idea_id,id FROM tbl_feedback_images WHERE idea_id IN ('.implode(',',array_fill(0,count($ids),'?')).')');$q->execute($ids);return $q->fetchAll(PDO::FETCH_KEY_PAIR);
}
