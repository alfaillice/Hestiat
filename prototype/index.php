<?php
/**
 * Hestiat 2.0 — PROTOTIPO de interfaz sobre el esquema NUEVO (db/migrations/001_init.sql).
 * Consulta `accommodation`, `accommodation_photo` y `accommodation_amenity` de la base migrada.
 *
 * Es una pieza INTERINA y autocontenida para validar datos + diseño antes de escribir el front
 * definitivo en TypeScript. No forma parte de la arquitectura final.
 *
 * Uso:  /hestiat-prototipo.php?k=<token>&q=<texto>&p=<pagina>
 *       /hestiat-prototipo.php?k=<token>&id=<legacy_id>      (ficha)
 *       /hestiat-prototipo.php?k=<token>&json=1               (datos, para comprobar)
 */
$TOKEN = 'proto2026hestiat';
if (($_GET['k'] ?? '') !== $TOKEN) { http_response_code(404); exit('nope'); }
header('Content-Type: text/html; charset=utf-8');

$env = [];
foreach (preg_split('/\r?\n/', (string) @file_get_contents('/home/ppxgfdyc/hestiat-app.env')) as $l) {
    if (preg_match('/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/', $l, $m)) {
        $v = trim($m[2]);
        if (strlen($v) > 1 && ($v[0] === '"' || $v[0] === "'") && substr($v, -1) === $v[0]) { $v = substr($v, 1, -1); }
        $env[$m[1]] = $v;
    }
}
$DB = 'ppxgfdyc_hestiat2';                 // base migrada (esquema nuevo)
$m = @new mysqli($env['DB_HOST'], $env['DB_USER'], $env['DB_PASSWORD'], $DB);
if ($m->connect_errno) { http_response_code(500); exit('sin conexión a la base migrada'); }
$m->set_charset('utf8mb4');
$e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');

/* ------------------------------------------------ comprobación de datos -- */
if (isset($_GET['json'])) {
    header('Content-Type: application/json; charset=utf-8');
    $out = [];
    foreach (['accommodation', 'accommodation_photo', 'accommodation_amenity', 'user', 'reservation', 'review', 'availability'] as $t) {
        $out[$t] = (int) $m->query("SELECT COUNT(*) FROM `{$t}`")->fetch_row()[0];
    }
    $out['ejemplo'] = $m->query("SELECT id, legacy_id, slug, title, city, province, price_per_night, price_type, bedrooms, beds, baths, capacity FROM accommodation WHERE price_per_night IS NOT NULL ORDER BY review_count DESC, id ASC LIMIT 3")->fetch_all(MYSQLI_ASSOC);
    echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE); exit;
}

/* ------------------------------------------------------------- ficha -- */
if (isset($_GET['id'])) {
    $id = (int) $_GET['id'];
    $a = $m->query("SELECT * FROM accommodation WHERE legacy_id={$id} OR id={$id} LIMIT 1")->fetch_assoc();
    if (!$a) { http_response_code(404); exit('alojamiento no encontrado'); }
    $fotos = $m->query("SELECT origin_url, storage_key, alt, is_primary FROM accommodation_photo WHERE accommodation_id={$a['id']} ORDER BY is_primary DESC, sort_order ASC LIMIT 8")->fetch_all(MYSQLI_ASSOC);
    $serv = $m->query("SELECT amenity FROM accommodation_amenity WHERE accommodation_id={$a['id']} LIMIT 14")->fetch_all(MYSQLI_ASSOC);
    $portada = null;
    foreach ($fotos as $f) { $u = $f['origin_url'] ?: $f['storage_key']; if ($u) { $portada = $u; break; } }
    ?><!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title><?= $e($a['title']) ?> — Hestiat</title>
    <style>
      :root{--bone:#FAF7F2;--bone2:#F1EBE2;--olive:#2F4A3C;--terra:#C4552D;--ink:#1F1C19;--stone:#6E655C;--line:#E3DBD0}
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:var(--bone);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
      .serif{font-family:Georgia,"Times New Roman",serif}
      .wrap{max-width:1100px;margin:0 auto;padding:24px}
      header{border-bottom:1px solid var(--line);padding:14px 0}
      .logo{letter-spacing:.18em;text-transform:uppercase;font-family:Georgia,serif;font-size:20px;color:var(--olive)}
      .hero{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin:20px 0;border-radius:16px;overflow:hidden}
      .hero img{width:100%;height:300px;object-fit:cover;background:var(--bone2);display:block}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
      .grid img{height:146px;object-fit:cover;border-radius:8px;background:var(--bone2)}
      h1{font-family:Georgia,serif;font-size:38px;line-height:1.15;margin:18px 0 6px}
      .meta{color:var(--stone);font-size:15px}
      .facts{display:flex;gap:22px;margin:18px 0;font-variant-numeric:tabular-nums}
      .facts b{font-weight:600}
      .chips{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
      .chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 14px;font-size:14px}
      .cols{display:grid;grid-template-columns:1fr 340px;gap:36px;align-items:start}
      .card{border:1px solid var(--line);background:#fff;border-radius:16px;padding:20px;box-shadow:0 6px 20px rgba(31,28,25,.06);position:sticky;top:20px}
      .price{font-family:Georgia,serif;font-size:30px;font-variant-numeric:tabular-nums}
      .btn{display:block;width:100%;margin-top:14px;background:var(--terra);color:#fff;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:600;cursor:pointer}
      .note{color:var(--stone);font-size:13px;margin-top:10px;text-align:center}
      .desc{margin:24px 0;max-width:62ch}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:14px}
      td{border-top:1px solid var(--line);padding:7px 0}
      .warn{background:var(--bone2);border-radius:12px;padding:12px 16px;font-size:13px;color:var(--stone);margin-top:26px}
    </style></head><body>
    <header><div class="wrap"><span class="logo">hestiat</span></div></header>
    <div class="wrap">
      <div class="hero">
        <?php if ($portada): ?><img src="<?= $e($portada) ?>" alt="<?= $e($a['title']) ?>"><?php else: ?><div></div><?php endif; ?>
        <div class="grid">
          <?php foreach (array_slice($fotos, 1, 2) as $f): $u = $f['origin_url'] ?: $f['storage_key']; if ($u): ?>
            <img src="<?= $e($u) ?>" alt="<?= $e($f['alt'] ?: $a['title']) ?>">
          <?php endif; endforeach; ?>
        </div>
      </div>
      <div class="cols">
        <div>
          <h1 class="serif"><?= $e($a['title']) ?></h1>
          <p class="meta"><?= $e(trim(($a['city'] ?? '') . ', ' . ($a['province'] ?? ''), ', ')) ?>
             · <span class="serif"><?= number_format((float) ($a['review_score'] ?: 0), 2, ',', '') ?: 'sin reseñas' ?></span>
             <?= (int) $a['review_count'] ? '(' . (int) $a['review_count'] . ' reseñas)' : '' ?></p>
          <div class="facts">
            <span><b><?= (int) $a['capacity'] ?: '—' ?></b> huéspedes</span>
            <span><b><?= (int) $a['bedrooms'] ?: '—' ?></b> dormitorios</span>
            <span><b><?= (int) $a['beds'] ?: '—' ?></b> camas</span>
            <span><b><?= (int) $a['baths'] ?: '—' ?></b> baños</span>
          </div>
          <div class="chips">
            <?php foreach ($serv as $s): ?><span class="chip"><?= $e($s['amenity']) ?></span><?php endforeach; ?>
          </div>
          <p class="desc"><?= $e(mb_substr(strip_tags((string) $a['description']), 0, 600)) ?: 'Descripción pendiente de completar por el propietario.' ?></p>
          <table>
            <tr><td>Tipo</td><td><?= $e($a['type'] ?: '—') ?></td></tr>
            <tr><td>Categoría</td><td><?= $e($a['category'] ?: '—') ?></td></tr>
            <tr><td>Dirección</td><td><?= $e($a['address'] ?: '—') ?></td></tr>
            <tr><td>Coordenadas</td><td><?= $e($a['lat'] . ', ' . $a['lng']) ?></td></tr>
            <tr><td>Estado</td><td><?= $e($a['status']) ?></td></tr>
            <tr><td>Legacy</td><td><?= (int) $a['legacy_id'] ?> (id en la base antigua)</td></tr>
          </table>
        </div>
        <div class="card">
          <div class="price"><?= $a['price_per_night'] ? number_format((float) $a['price_per_night'], 0, ',', '.') . ' €' : 'Consultar' ?><span style="font-size:15px;color:var(--stone)"> / noche</span></div>
          <div class="meta" style="margin-top:6px"><?= $a['price_type'] === 'real' ? 'Precio publicado' : 'Precio orientativo' ?><?= $a['price_source'] ? ' · ' . $e($a['price_source']) : '' ?></div>
          <button class="btn">Reservar</button>
          <div class="note">Sin cargos ocultos</div>
        </div>
      </div>
      <div class="warn"><strong>Prototipo interino.</strong> Esta página lee el esquema NUEVO de la base migrada
      (<code>accommodation</code>, <code>accommodation_photo</code>, <code>accommodation_amenity</code>).
      Sirve para validar datos y diseño antes de construir el front definitivo, que se escribirá en TypeScript.</div>
    </div></body></html><?php
    exit;
}

/* ----------------------------------------------------------- búsqueda -- */
$q = trim((string) ($_GET['q'] ?? ''));
$pag = max(1, (int) ($_GET['p'] ?? 1));
$por = 12; $off = ($pag - 1) * $por;
$where = "status='published'"; $param = '';
if ($q !== '') { $qq = $m->real_escape_string($q); $where .= " AND (title LIKE '%{$qq}%' OR city LIKE '%{$qq}%' OR province LIKE '%{$qq}%')"; }
$total = (int) $m->query("SELECT COUNT(*) FROM accommodation WHERE {$where}")->fetch_row()[0];
$rows = $m->query("SELECT id, legacy_id, slug, title, city, province, price_per_night, price_type, capacity, bedrooms, beds,
  (SELECT origin_url FROM accommodation_photo p WHERE p.accommodation_id=accommodation.id AND p.origin_url IS NOT NULL ORDER BY is_primary DESC, sort_order ASC LIMIT 1) foto
  FROM accommodation WHERE {$where} ORDER BY (price_per_night IS NULL), price_per_night ASC LIMIT {$por} OFFSET {$off}")->fetch_all(MYSQLI_ASSOC);
?><!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hestiat 2.0 — Búsqueda</title>
<style>
 :root{--bone:#FAF7F2;--bone2:#F1EBE2;--olive:#2F4A3C;--terra:#C4552D;--ink:#1F1C19;--stone:#6E655C;--line:#E3DBD0}
 *{box-sizing:border-box;margin:0;padding:0}
 body{background:var(--bone);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
 .wrap{max-width:1180px;margin:0 auto;padding:24px}
 header{border-bottom:1px solid var(--line);padding:14px 0}
 .logo{letter-spacing:.18em;text-transform:uppercase;font-family:Georgia,serif;font-size:20px;color:var(--olive)}
 h1{font-family:Georgia,serif;font-size:40px;line-height:1.12;margin:30px 0 8px;max-width:20ch}
 form.search{display:flex;gap:10px;background:#fff;border:1px solid var(--line);border-radius:24px;padding:8px;margin:22px 0 10px;box-shadow:0 6px 20px rgba(31,28,25,.06)}
 form.search input{flex:1;border:0;padding:12px 16px;font-size:16px;background:transparent;outline:none}
 form.search button{background:var(--olive);color:#fff;border:0;border-radius:18px;padding:12px 26px;font-size:15px;font-weight:600;cursor:pointer}
 .count{color:var(--stone);font-size:14px}
 .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;margin-top:24px}
 .card{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;display:block;transition:box-shadow .18s ease,transform .18s ease}
 .card:hover{box-shadow:0 12px 28px rgba(31,28,25,.10);transform:translateY(-2px)}
 .card img{width:100%;height:180px;object-fit:cover;background:var(--bone2);display:block}
 .card .body{padding:12px 14px 16px}
 .card .t{font-family:Georgia,serif;font-size:18px;line-height:1.25;margin-bottom:4px}
 .card .m{color:var(--stone);font-size:13px}
 .card .p{margin-top:8px;font-variant-numeric:tabular-nums;font-weight:600}
 .nav{display:flex;gap:14px;justify-content:center;margin:30px 0}
 .nav a{color:var(--olive);text-decoration:none;border:1px solid var(--line);border-radius:12px;padding:9px 18px;background:#fff;font-size:14px}
 .warn{background:var(--bone2);border-radius:12px;padding:12px 16px;font-size:13px;color:var(--stone);margin-top:30px}
</style></head><body>
<header><div class="wrap"><span class="logo">hestiat</span></div></header>
<div class="wrap">
  <h1>¿Dónde quieres despertar?</h1>
  <form class="search" method="get">
    <input type="hidden" name="k" value="<?= $e($TOKEN) ?>">
    <input name="q" value="<?= $e($q) ?>" placeholder="Ciudad, provincia…">
    <button>Buscar</button>
  </form>
  <p class="count"><?= number_format($total, 0, ',', '.') ?> alojamientos migrados al esquema nuevo<?= $q !== '' ? ' para «' . $e($q) . '»' : '' ?></p>
  <div class="cards">
  <?php foreach ($rows as $r): ?>
    <a class="card" href="?k=<?= $e($TOKEN) ?>&id=<?= (int) $r['legacy_id'] ?>">
      <?php if ($r['foto']): ?><img src="<?= $e($r['foto']) ?>" alt="<?= $e($r['title']) ?>" loading="lazy"><?php else: ?><div style="height:180px;background:var(--bone2)"></div><?php endif; ?>
      <div class="body">
        <div class="t"><?= $e($r['title']) ?></div>
        <div class="m"><?= $e(trim(($r['city'] ?? '') . ', ' . ($r['province'] ?? ''), ', ')) ?></div>
        <div class="p"><?= $r['price_per_night'] ? number_format((float) $r['price_per_night'], 0, ',', '.') . ' € / noche' : 'Consultar' ?>
          <span style="color:var(--stone);font-weight:400;font-size:12px"><?= $r['price_type'] === 'real' ? '' : '· orientativo' ?></span></div>
      </div>
    </a>
  <?php endforeach; ?>
  </div>
  <div class="nav">
    <?php if ($pag > 1): ?><a href="?k=<?= $e($TOKEN) ?>&q=<?= urlencode($q) ?>&p=<?= $pag - 1 ?>">← Anterior</a><?php endif; ?>
    <?php if ($off + $por < $total): ?><a href="?k=<?= $e($TOKEN) ?>&q=<?= urlencode($q) ?>&p=<?= $pag + 1 ?>">Siguiente →</a><?php endif; ?>
  </div>
  <div class="warn"><strong>Prototipo interino.</strong> Datos reales del esquema nuevo ya migrado
  (<code>accommodation</code> + <code>accommodation_photo</code>). El front definitivo se escribirá en TypeScript.</div>
</div></body></html>
