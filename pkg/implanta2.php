<?php
/**
 * IMPLANTADOR DEL FRONTEND NUEVO — sustituye el árbol de Next de forma ATÓMICA.
 *
 * Por qué existe: la portada devolvía 500 (ER_PARSE_ERROR, digest 2953525081) porque el build
 * desplegado aún llevaba la consulta de provincias con marcadores en vez de la lista ya citada.
 * El código fuente está corregido; aquí se sustituye el árbol COMPILADO.
 *
 * Cubre las DOS formas posibles de arranque, para no depender de cuál esté configurada:
 *   a) LiteSpeed usa app.cjs -> .output/server/index.mjs (el puente) -> .next-standalone
 *   b) LiteSpeed arranca .next-standalone/server.js directamente
 * En ambos casos el árbol servido queda siendo el nuevo.
 *
 * Garantías: comprueba el candidato ANTES, aparta el árbol anterior con fecha (no lo borra),
 * reinicia con posix_kill (el pkill del shell de PHP falla en silencio aquí) y REVIERTE SOLO si
 * la portada no queda en 200.
 *
 * Uso: ?k=next2[&dry=1]
 */
error_reporting(E_ALL); ini_set('display_errors', '1'); set_time_limit(900);
if (($_GET['k'] ?? '') !== 'next2') { http_response_code(404); exit('nope'); }
header('Content-Type: text/plain; charset=utf-8'); header('Cache-Control: no-store');

$DOC = '/home/ppxgfdyc/hestiat.com';
$ARBOL = $DOC . '/.next-standalone';
$STAGED = $DOC . '/.output/.next-standalone';
$STAMP = date('Ymd-His');
$s = [];

function http_get($u) {
    $ch = curl_init($u);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60, CURLOPT_FOLLOWLOCATION => true]);
    $b = (string) curl_exec($ch);
    $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$c, $b];
}
function estado() {
    $o = [];
    foreach (['/', '/search', '/experiencias'] as $r) {
        [$c, $b] = http_get('https://hestiat.com' . $r . '?v=' . mt_rand());
        $o[$r] = ['code' => $c, 'bytes' => strlen($b), 'roto' => (stripos($b, '__next_error__') !== false || stripos($b, 'server-side exception') !== false)];
    }
    return $o;
}
function pidsApp() {
    $out = [];
    foreach (glob('/proc/[0-9]*') as $d) {
        $cmd = @file_get_contents($d . '/cmdline');
        if ($cmd === false) continue;
        if (stripos(str_replace("\0", ' ', $cmd), 'lsnode') !== false) $out[] = (int) basename($d);
    }
    return $out;
}
function reiniciar(&$s) {
    $pids = pidsApp();
    $s[] = '   procesos vivos: ' . (count($pids) ? implode(',', $pids) : 'ninguno');
    foreach ($pids as $pid) {
        if (function_exists('posix_kill')) { @posix_kill($pid, 9); $s[] = "   posix_kill $pid"; }
    }
    @file_put_contents('/home/ppxgfdyc/hestiat.com/tmp/restart.txt', 'r ' . time());
    sleep(9);
    [$c] = http_get('https://hestiat.com/?arranque=' . time());
    $s[] = "   peticion de arranque -> $c";
    sleep(9);
    $vivos = pidsApp();
    $s[] = '   procesos tras el reinicio: ' . (count($vivos) ? implode(',', $vivos) : 'ninguno todavia');
}

$s[] = '==== IMPLANTACION DEL FRONTEND (sello ' . $STAMP . ') ====';
$s[] = '';
$s[] = '0) estado previo';
foreach (estado() as $r => $d) $s[] = sprintf('   %-14s %s  %s B  %s', $r, $d['code'], $d['bytes'], $d['roto'] ? 'PAGINA DE ERROR' : '');

$s[] = '';
$s[] = '1) comprobacion del arbol nuevo (ya extraido por el desplegador)';
$checks = [
    'server.js' => is_file($STAGED . '/server.js'),
    'pagina compilada' => is_file($STAGED . '/.next/server/app/page.js'),
    'estaticos' => is_dir($STAGED . '/.next/static'),
    'dependencias' => is_dir($STAGED . '/node_modules'),
];
foreach ($checks as $q => $v) $s[] = sprintf('   %-20s %s', $q, $v ? 'OK' : 'FALTA');
if (in_array(false, $checks, true)) { $s[] = '   ABORTADO: falta el arbol nuevo. No se ha tocado nada.'; echo implode("\n", $s), "\n"; exit; }
$cuenta = 0;
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($STAGED, FilesystemIterator::SKIP_DOTS));
foreach ($it as $f) { if ($f->isFile()) $cuenta++; }
$s[] = "   ficheros en el arbol nuevo: $cuenta";
if ($cuenta < 500) { $s[] = '   ABORTADO: arbol incompleto.'; echo implode("\n", $s), "\n"; exit; }

if (($_GET['dry'] ?? '') === '1') { $s[] = ''; $s[] = 'SIMULACION: no se cambia nada.'; echo implode("\n", $s), "\n"; exit; }

$s[] = '';
$s[] = '2) intercambio atomico del arbol';
$apartado = $DOC . '/tmp/pre-fix-' . $STAMP;
$r1 = @rename($ARBOL, $apartado);
$s[] = '   apartar el actual: ' . ($r1 ? "OK -> $apartado" : 'FALLO');
if (!$r1) { $s[] = '   ABORTADO'; echo implode("\n", $s), "\n"; exit; }
$r2 = @rename($STAGED, $ARBOL);
$s[] = '   colocar el nuevo: ' . ($r2 ? 'OK' : 'FALLO');
if (!$r2) { @rename($apartado, $ARBOL); $s[] = '   REVERTIDO'; echo implode("\n", $s), "\n"; exit; }
@file_put_contents($DOC . '/tmp/ultimo-implante.txt', $STAMP . ' apartado=' . $apartado . "\n");

$s[] = '';
$s[] = '3) puente de arranque en .output';
$puente = "/** Puente: carga el arbol de Next del docroot. Sin top-level await (app.cjs usa require). */\n"
    . "import { readFileSync } from \"node:fs\";\n"
    . "const ENV_FILE = process.env.HESTIAT_ENV_FILE ?? \"/home/ppxgfdyc/hestiat-app.env\";\n"
    . "try {\n"
    . "  for (const linea of readFileSync(ENV_FILE, \"utf8\").split(\"\\n\")) {\n"
    . "    const t = linea.trim(); if (!t || t.startsWith(\"#\")) continue;\n"
    . "    const eq = t.indexOf(\"=\"); if (eq <= 0) continue;\n"
    . "    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim();\n"
    . "    if (v.length > 1 && (v[0] === '\"' || v[0] === \"'\") && v.endsWith(v[0])) v = v.slice(1, -1);\n"
    . "    if (process.env[k] === undefined) process.env[k] = v;\n"
    . "  }\n"
    . "} catch (e) { console.error(\"[hestiat] entorno:\", e.message); }\n"
    . "process.env.NODE_ENV = process.env.NODE_ENV ?? \"production\";\n"
    . "process.env.HOST = process.env.HOST ?? process.env.HOSTNAME ?? \"0.0.0.0\";\n"
    . "process.env.PORT = process.env.PORT ?? process.env.NITRO_PORT ?? \"3000\";\n"
    . "process.env.HOSTNAME = process.env.HOST;\n"
    . "import(\"/home/ppxgfdyc/hestiat.com/.next-standalone/server.js\").catch((e) => {\n"
    . "  console.error(\"[hestiat] fallo al arrancar Next:\", e && e.message ? e.message : e);\n"
    . "  process.exitCode = 1;\n"
    . "});\n";
$destino = $DOC . '/.output/server/index.mjs';
if (is_file($destino)) @copy($destino, $DOC . '/tmp/index-mjs-pre-fix-' . $STAMP);
@file_put_contents($destino, $puente);
$s[] = '   escrito (' . strlen($puente) . ' B) · top-level await: ' . (preg_match('/^\s*await /m', $puente) ? 'SI (MAL)' : 'no (correcto)');

$s[] = '';
$s[] = '4) reinicio del pool';
reiniciar($s);

$s[] = '';
$s[] = '5) verificacion posterior';
$d = estado();
foreach ($d as $r => $x) $s[] = sprintf('   %-14s %s  %s B  %s', $r, $x['code'], $x['bytes'], $x['roto'] ? 'SIGUE LA PAGINA DE ERROR' : 'pagina normal');

if (!($d['/']['code'] === 200 && !$d['/']['roto'])) {
    $s[] = '';
    $s[] = '   LA PORTADA NO HA QUEDADO BIEN: REVIRTIENDO';
    @rename($ARBOL, $DOC . '/tmp/fallido-' . $STAMP);
    @rename($apartado, $ARBOL);
    if (is_file($DOC . '/tmp/index-mjs-pre-fix-' . $STAMP)) @copy($DOC . '/tmp/index-mjs-pre-fix-' . $STAMP, $destino);
    reiniciar($s);
    foreach (estado() as $r => $x) $s[] = sprintf('   tras revertir %-14s %s', $r, $x['code']);
    $s[] = '';
    $s[] = '   ultimas lineas del log:';
    $L = '/home/ppxgfdyc/logs/hestiat.com-passenger.log';
    if (is_readable($L)) { $ls = file($L, FILE_IGNORE_NEW_LINES); foreach (array_slice($ls, -16) as $l) $s[] = '     ' . substr($l, 0, 240); }
    $s[] = '';
    $s[] = 'RESULTADO: REVERTIDO';
} else {
    $s[] = '';
    $s[] = 'RESULTADO: IMPLANTADO · PORTADA EN 200';
    $s[] = 'Arbol anterior conservado en ' . $apartado;
}
echo implode("\n", $s), "\n";
