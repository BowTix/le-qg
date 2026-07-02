<?php
// Measure HTTPS cURL
$start = microtime(true);
$ch = curl_init("https://api-eu.pusher.com/apps/2172318/events");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_exec($ch);
curl_close($ch);
$https_time = microtime(true) - $start;

// Measure HTTP cURL
$start = microtime(true);
$ch = curl_init("http://api-eu.pusher.com/apps/2172318/events");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_exec($ch);
curl_close($ch);
$http_time = microtime(true) - $start;

echo "HTTPS Time: " . round($https_time * 1000, 2) . "ms\n";
echo "HTTP Time: " . round($http_time * 1000, 2) . "ms\n";
echo "Speedup: " . round(($https_time / $http_time), 2) . "x\n";
