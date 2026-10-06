<?php
// Compatibility entry point; the normal detail page is the single implementation.
$params = ['nd_id' => $_GET['id'] ?? ''];
if (isset($_GET['demo'])) $params['demo'] = $_GET['demo'] === '1' ? '1' : '0';
header('Location: therapie_detail.php?' . http_build_query($params), true, 302);
exit;
