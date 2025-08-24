<?php
$arquivo = "progresso.json";

if (!file_exists($arquivo)) {
    echo json_encode([]);
    exit;
}

$data = file_get_contents($arquivo);
echo $data;
?>
