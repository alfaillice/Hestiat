<?php
/**
 * Hestiat 2.0 — VISTA PREVIA de la portada replicada (para revisar antes de desplegar Next.js).
 *
 * Replica la estructura que el cliente aprobó —foto grande con buscador, «Busca como viajas»,
 * «Destinos para ti» y «Alojamientos populares»— con los TOKENS REALES de producción
 * (extraídos de su CSS: petróleo oklch(41.5% .072 197), ámbar oklch(79.5% .135 74),
 * fondo oklch(98.8% .005 92), DM Sans + Manrope, controles en píldora).
 *
 * Lee el esquema NUEVO de la base migrada. Es una pieza INTERINA de revisión:
 * el frontend definitivo es el de `frontend/` en Next.js.
 *
 * Uso: /hestiat-prototipo.php?k=<token>          · ?id=<legacy>  (ficha)
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
$m = @new mysqli($env['DB_HOST'], $env['DB_USER'], $env['DB_PASSWORD'], 'ppxgfdyc_hestiat2');
if ($m->connect_errno) { http_response_code(500); exit('sin conexión a la base migrada'); }
$m->set_charset('utf8mb4');
$e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
$fila = fn(string $s) => ($r = @$m->query($s)) ? $r->fetch_all(MYSQLI_ASSOC) : [];

/* portada de una consulta, con recuento */
function bloque(mysqli $m, string $cond, array $val = [], string $tipo = ''): array {
    $sql = "SELECT COUNT(*) total, (SELECT COALESCE(p.origin_url,p.storage_key) FROM accommodation a2 JOIN accommodation_photo p ON p.accommodation_id=a2.id WHERE "
         . str_replace('a.', 'a2.', $cond) . " AND COALESCE(p.origin_url,p.storage_key) IS NOT NULL ORDER BY p.is_primary DESC, p.sort_order ASC LIMIT 1) portada FROM accommodation a WHERE $cond";
    $r = $m->query($sql); $f = $r ? $r->fetch_assoc() : [];
    return ['total' => (int) ($f['total'] ?? 0), 'portada' => $f['portada'] ?? null];
}
$COSTA = ['Alacant/Alicante','Málaga','Illes Balears','Girona','Barcelona','València/Valencia','Tarragona','Cantabria','A Coruña','Pontevedra','Las Palmas','Santa Cruz de Tenerife','Murcia','Cádiz','Huelva','Castelló/Castellón','Gipuzkoa/Guipúzcoa','Bizkaia/Vizcaya'];
$MONT  = ['Asturias','Cantabria','Granada','Segovia','Ávila','Navarra','Huesca','Lleida','Girona','Teruel','Cuenca','Jaén','La Rioja','Palencia','Soria','León'];
$in = fn(array $a) => implode(',', array_map(fn($x) => "'" . addslashes($x) . "'", $a));

$destacados = $fila("SELECT a.id,a.legacy_id,a.slug,a.title,a.city,a.province,a.price_per_night,a.price_type,
  (SELECT COALESCE(p.origin_url,p.storage_key) FROM accommodation_photo p WHERE p.accommodation_id=a.id AND COALESCE(p.origin_url,p.storage_key) IS NOT NULL ORDER BY p.is_primary DESC,p.sort_order ASC LIMIT 1) portada
  FROM accommodation a WHERE a.status='published' ORDER BY (a.price_per_night IS NULL), a.review_count DESC, a.id ASC LIMIT 8");
$provincias = $fila("SELECT a.province, COUNT(*) total,
  (SELECT COALESCE(p.origin_url,p.storage_key) FROM accommodation_photo p JOIN accommodation b ON b.id=p.accommodation_id WHERE b.province=a.province AND b.status='published' AND COALESCE(p.origin_url,p.storage_key) IS NOT NULL ORDER BY p.is_primary DESC,p.sort_order ASC LIMIT 1) portada
  FROM accommodation a WHERE a.status='published' AND a.province IS NOT NULL AND a.province<>'' GROUP BY a.province ORDER BY total DESC LIMIT 12");
$estilos = [
  ['Costa y mar', 'Casas junto al agua', bloque($m, "a.status='published' AND a.province IN (" . $in($COSTA) . ")")],
  ['Paisaje de montaña', 'Valles y sierras', bloque($m, "a.status='published' AND a.province IN (" . $in($MONT) . ")")],
  ['Arquitectura histórica', 'Casas con historia', bloque($m, "a.status='published' AND (a.title LIKE '%casa%' OR a.title LIKE '%palacio%' OR a.title LIKE '%convento%' OR a.title LIKE '%castillo%' OR a.title LIKE '%monasterio%' OR a.title LIKE '%torre%')")],
  ['Planes en familia', 'Espacio para todos', bloque($m, "a.status='published' AND a.capacity >= 6")],
];
$portada = null; foreach ($destacados as $d) { if ($d['portada']) { $portada = $d['portada']; break; } }

/* ------------------------------------------------------------------ ficha -- */
if (isset($_GET['id'])) {
    $id = (int) $_GET['id'];
    $a = $m->query("SELECT * FROM accommodation WHERE legacy_id=$id OR id=$id LIMIT 1")->fetch_assoc();
    if (!$a) { http_response_code(404); exit('no encontrado'); }
    $fotos = $fila("SELECT COALESCE(origin_url,storage_key) url, alt, is_primary FROM accommodation_photo WHERE accommodation_id={$a['id']} AND COALESCE(origin_url,storage_key) IS NOT NULL ORDER BY is_primary DESC, sort_order ASC LIMIT 8");
    $serv = $fila("SELECT amenity FROM accommodation_amenity WHERE accommodation_id={$a['id']} ORDER BY amenity LIMIT 20");
    ?><!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title><?= $e($a['title']) ?> — Hestiat</title><?= estilos_base() ?>
    </head><body>
    <header class="cab"><div class="wrap cab-in"><a href="?k=<?= $e($TOKEN) ?>" class="marca">hestiat</a><a href="?k=<?= $e($TOKEN) ?>" style="color:var(--muted-fg);font-size:14px">← Volver</a><button class="cab-btn">Publica tu espacio</button></div></header>
    <main class="wrap" style="padding-top:20px">
      <div class="galeria">
        <?php $pr = $fotos[0]['url'] ?? null; if ($pr): ?><img class="grande" src="<?= $e($pr) ?>" alt="<?= $e($a['title']) ?>"><?php endif; ?>
        <div class="mini"><?php foreach (array_slice($fotos,1,4) as $f): ?><img src="<?= $e($f['url']) ?>" alt="<?= $e($f['alt'] ?: $a['title']) ?>"><?php endforeach; ?></div>
      </div>
      <div class="cols">
        <div>
          <h1 style="font-size:30px;margin:18px 0 6px"><?= $e($a['title']) ?></h1>
          <p class="m"><?= $e(trim(($a['city'] ?? '') . ', ' . ($a['province'] ?? ''), ', ')) ?></p>
          <div class="datos"><span><b><?= (int) $a['capacity'] ?: '—' ?></b> huéspedes</span><span><b><?= (int) $a['bedrooms'] ?: '—' ?></b> dormitorios</span><span><b><?= (int) $a['beds'] ?: '—' ?></b> camas</span><span><b><?= (int) $a['baths'] ?: '—' ?></b> baños</span></div>
          <div class="chips"><?php foreach ($serv as $s): ?><span class="chip"><?= $e($s['amenity']) ?></span><?php endforeach; ?></div>
          <p style="max-width:62ch;margin:18px 0"><?= $e(mb_substr(strip_tags((string) $a['description']), 0, 700)) ?: 'Descripción pendiente de completar por el propietario.' ?></p>
          <table class="info"><tr><td>Tipo</td><td><?= $e($a['type'] ?: '—') ?></td></tr><tr><td>Categoría</td><td><?= $e($a['category'] ?: '—') ?></td></tr><tr><td>Dirección</td><td><?= $e($a['address'] ?: '—') ?></td></tr><tr><td>Coordenadas</td><td><?= $e($a['lat'] . ', ' . $a['lng']) ?></td></tr></table>
        </div>
        <aside class="reserva">
          <div class="precio-g"><?= $a['price_per_night'] ? number_format((float) $a['price_per_night'], 0, ',', '.') . ' €' : 'Consultar' ?><span style="font-size:14px;color:var(--muted-fg)"> / noche</span></div>
          <p class="m" style="margin-top:4px"><?= $a['price_type'] === 'real' ? 'Precio publicado' : 'Precio orientativo' ?><?= $a['price_source'] ? ' · ' . $e($a['price_source']) : '' ?></p>
          <button class="btn-reservar">Reservar</button>
          <p style="text-align:center;color:var(--muted-fg);font-size:12.5px;margin-top:10px">Sin cargos ocultos</p>
        </aside>
      </div>
    </main></body></html><?php
    exit;
}

function estilos_base(): string { return '<style>
:root{--background:oklch(98.8% .005 92);--foreground:oklch(23.5% .021 225);--ink:oklch(18.5% .024 230);--card:#fff;--primary:oklch(41.5% .072 197);--primary-fg:oklch(98.5% .008 190);--accent:oklch(79.5% .135 74);--accent-fg:oklch(29% .06 62);--secondary:oklch(96.2% .008 92);--muted:oklch(95.5% .007 92);--muted-fg:oklch(51.5% .019 232);--border:oklch(90% .008 232);--surface-strong:oklch(93.5% .014 92);--radio:14px;--pill:9999px}
*{box-sizing:border-box;margin:0;padding:0}html,body{background:var(--background);color:var(--foreground)}
body{font:15.2px/1.55 Manrope,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:"DM Sans",Manrope,sans-serif;font-weight:700;letter-spacing:-.02em;line-height:1.12}
a{color:inherit;text-decoration:none}img{display:block;max-width:100%}
.wrap{max-width:1180px;margin:0 auto;padding:0 18px}
.cab{border-bottom:1px solid var(--border);background:var(--background);position:sticky;top:0;z-index:40}
.cab-in{display:flex;align-items:center;gap:14px;height:60px}
.marca{font-family:"DM Sans",sans-serif;font-weight:700;font-size:20px;color:var(--primary)}
.cab-btn{margin-left:auto;border:1px solid var(--border);background:var(--card);border-radius:var(--pill);padding:8px 16px;font:inherit;cursor:pointer}
.hero{position:relative;min-height:420px;display:flex;align-items:flex-end;margin-bottom:26px;overflow:hidden}
.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero .velo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,30,36,.15),rgba(12,30,36,.72))}
.hero .cont{position:relative;width:100%;max-width:1180px;margin:0 auto;padding:28px 18px 30px}
.eyebrow{color:var(--accent);font-weight:700;letter-spacing:.14em;font-size:11.5px;text-transform:uppercase;margin-bottom:8px}
.hero h1{color:#fff;font-size:38px;max-width:22ch;margin-bottom:10px}
.hero p.sub{color:rgba(255,255,255,.9);max-width:54ch;margin-bottom:18px;font-size:14.5px}
.buscador{display:flex;align-items:center;gap:6px;background:#fff;border-radius:var(--pill);padding:6px;box-shadow:0 10px 30px rgba(20,40,50,.10);max-width:820px}
.buscador .campo{flex:1;display:flex;flex-direction:column;padding:6px 14px;min-width:0}
.buscador .etq{font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--muted-fg);text-transform:uppercase}
.buscador input{border:0;background:transparent;font:inherit;outline:none;color:var(--ink);width:100%}
.buscador .sep{width:1px;height:28px;background:var(--border)}
.buscador button{background:var(--primary);color:var(--primary-fg);border:0;border-radius:var(--pill);padding:12px 22px;font:inherit;font-weight:700;cursor:pointer}
.seccion{margin:34px auto}.seccion-cab{display:flex;align-items:baseline;gap:12px}.seccion-cab h2{font-size:24px}
.seccion-cab .mas{margin-left:auto;color:var(--primary);font-weight:600;font-size:13.5px}
.seccion-sub{color:var(--muted-fg);font-size:13.5px;margin:4px 0 14px}
.carrusel{display:flex;gap:14px;overflow-x:auto;padding-bottom:6px}
.estilo{position:relative;flex:0 0 260px;height:180px;border-radius:var(--radio);overflow:hidden;background:var(--surface-strong)}
.estilo img{width:100%;height:100%;object-fit:cover}
.estilo .velo{position:absolute;inset:0;background:linear-gradient(180deg,transparent 35%,rgba(12,30,36,.75))}
.estilo .txt{position:absolute;left:14px;bottom:12px;color:#fff}.estilo b{font-family:"DM Sans",sans-serif;font-size:16.5px;display:block}
.estilo span.sub{font-size:12.5px;opacity:.85}
.destinos{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
.destino{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);overflow:hidden}
.destino img{height:96px;width:100%;object-fit:cover;background:var(--surface-strong)}
.destino .d{padding:10px 12px 12px}.destino b{font-family:"DM Sans",sans-serif;font-size:15px;display:block}
.destino span{color:var(--muted-fg);font-size:12.5px;font-variant-numeric:tabular-nums}
.rejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px}
.aloj{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);overflow:hidden}
.aloj .foto{position:relative;height:172px;background:var(--surface-strong)}
.aloj .foto img{width:100%;height:100%;object-fit:cover}
.aloj .fav{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:var(--pill);border:0;background:rgba(255,255,255,.9);cursor:pointer}
.aloj .d{padding:11px 13px 14px}.aloj .t{font-family:"DM Sans",sans-serif;font-weight:700;font-size:15.5px;display:block}
.aloj .m{color:var(--muted-fg);font-size:12.5px;display:block}.aloj .p{margin-top:8px;font-weight:700;font-variant-numeric:tabular-nums;display:block}
.aloj .p .ref{color:var(--muted-fg);font-weight:400;font-size:12px}
.galeria{display:grid;grid-template-columns:2fr 1fr;gap:8px}
.galeria .grande{width:100%;height:330px;object-fit:cover;border-radius:var(--radio)}
.mini{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mini img{height:161px;object-fit:cover;border-radius:var(--radio)}
.cols{display:grid;grid-template-columns:1fr 340px;gap:34px;align-items:start;margin-top:10px}
.reserva{background:var(--card);border:1px solid var(--border);border-radius:var(--radio);padding:20px;box-shadow:0 10px 30px rgba(20,40,50,.08);position:sticky;top:80px}
.precio-g{font-family:"DM Sans",sans-serif;font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}
.btn-reservar{display:block;width:100%;margin-top:14px;background:var(--primary);color:var(--primary-fg);border:0;border-radius:var(--pill);padding:14px;font:inherit;font-weight:700;cursor:pointer}
.m{color:var(--muted-fg);font-size:14px}.datos{display:flex;gap:22px;margin:16px 0;font-variant-numeric:tabular-nums}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.chip{border:1px solid var(--border);background:var(--card);border-radius:var(--pill);padding:6px 14px;font-size:13.5px}
table.info{width:100%;border-collapse:collapse;font-size:13.5px}table.info td{border-top:1px solid var(--border);padding:7px 0}
.aviso{background:var(--secondary);border:1px solid var(--border);border-radius:var(--radio);padding:12px 15px;font-size:13px;color:var(--muted-fg)}
@media(max-width:760px){.hero{min-height:350px}.hero h1{font-size:29px}.buscador{flex-direction:column;align-items:stretch;border-radius:var(--radio)}.buscador .sep{display:none}.galeria{grid-template-columns:1fr}.mini{display:none}.cols{grid-template-columns:1fr}.reserva{position:static}.estilo{flex:0 0 210px;height:150px}}
</style>'; }
?><!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hestiat 2.0 — Vista previa de la portada</title><?= estilos_base() ?></head><body>
<header class="cab"><div class="wrap cab-in"><a href="?k=<?= $e($TOKEN) ?>" class="marca">hestiat</a>
<a href="?k=<?= $e($TOKEN) ?>" style="color:var(--muted-fg);font-size:14px">Explorar</a>
<a href="?k=<?= $e($TOKEN) ?>" style="color:var(--muted-fg);font-size:14px">Experiencias</a>
<button class="cab-btn">Publica tu espacio</button></div></header>
<main>
  <section class="hero">
    <?php if ($portada): ?><img src="<?= $e($portada) ?>" alt="Alojamiento real del catálogo"><?php endif; ?>
    <div class="velo"></div>
    <div class="cont">
      <p class="eyebrow">Alojamientos con carácter</p>
      <h1>Encuentra donde quedarte, sin sorpresas y sin comisiones.</h1>
      <p class="sub">Busca por ciudad, provincia, código postal o punto de interés. Comparamos precios publicados y comprobamos la disponibilidad de verdad.</p>
      <form class="buscador" method="get"><input type="hidden" name="k" value="<?= $e($TOKEN) ?>">
        <span class="campo"><span class="etq">Destino</span><input name="q" placeholder="¿A dónde vas?"></span>
        <span class="sep"></span><span class="campo" style="flex:0 0 120px"><span class="etq">Fechas</span><input placeholder="¿Cuándo?"></span>
        <span class="sep"></span><span class="campo" style="flex:0 0 120px"><span class="etq">Viajeros</span><input placeholder="2 huéspedes"></span>
        <button type="submit">Buscar</button>
      </form>
    </div>
  </section>

  <section class="seccion wrap">
    <div class="seccion-cab"><h2>Busca como viajas</h2><a class="mas" href="?k=<?= $e($TOKEN) ?>">Explorar todo el catálogo</a></div>
    <p class="seccion-sub">Atajos por forma de escapada</p>
    <div class="carrusel">
      <?php foreach ($estilos as [$etq, $desc, $b]): ?>
        <a class="estilo" href="?k=<?= $e($TOKEN) ?>&q=<?= urlencode($etq) ?>">
          <?php if ($b['portada']): ?><img src="<?= $e($b['portada']) ?>" alt="<?= $e($etq) ?>" loading="lazy"><?php endif; ?>
          <span class="velo"></span><span class="txt"><b><?= $e($etq) ?></b><span class="sub"><?= $e($desc) ?> · <?= number_format($b['total'], 0, ',', '.') ?> alojamientos</span></span>
        </a>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="seccion wrap">
    <div class="seccion-cab"><h2>Destinos para ti</h2><a class="mas" href="?k=<?= $e($TOKEN) ?>">Ver todos</a></div>
    <p class="seccion-sub">Provincias con alojamientos publicados, por número de plazas</p>
    <div class="destinos">
      <?php foreach ($provincias as $p): ?>
        <a class="destino" href="?k=<?= $e($TOKEN) ?>&q=<?= urlencode($p['province']) ?>">
          <?php if ($p['portada']): ?><img src="<?= $e($p['portada']) ?>" alt="<?= $e($p['province']) ?>" loading="lazy"><?php endif; ?>
          <span class="d"><b><?= $e($p['province']) ?></b><span><?= number_format((int) $p['total'], 0, ',', '.') ?> alojamientos</span></span>
        </a>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="seccion wrap">
    <div class="seccion-cab"><h2>Alojamientos populares</h2><a class="mas" href="?k=<?= $e($TOKEN) ?>">Ver todos</a></div>
    <p class="seccion-sub">Del catálogo real de Hestiat, con sus precios publicados</p>
    <div class="rejilla">
      <?php foreach ($destacados as $a): ?>
        <a class="aloj" href="?k=<?= $e($TOKEN) ?>&id=<?= (int) $a['legacy_id'] ?>">
          <span class="foto"><?php if ($a['portada']): ?><img src="<?= $e($a['portada']) ?>" alt="<?= $e($a['title']) ?>" loading="lazy"><?php endif; ?><button class="fav" aria-label="Guardar en favoritos">♡</button></span>
          <span class="d"><span class="t"><?= $e($a['title']) ?></span>
          <span class="m"><?= $e(trim(($a['city'] ?? '') . ', ' . ($a['province'] ?? ''), ', ')) ?></span>
          <span class="p"><?= $a['price_per_night'] ? number_format((float) $a['price_per_night'], 0, ',', '.') . ' € / noche' : 'Consultar' ?><?= $a['price_type'] === 'real' ? '' : '<span class="ref"> · orientativo</span>' ?></span></span>
        </a>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="seccion wrap"><p class="aviso">Vista previa de la portada replicada con los tokens reales de producción, sobre el esquema nuevo ya migrado: 27.359 alojamientos, 17.619 fotos y 12.185 servicios. El frontend definitivo es el de Next.js/TypeScript.</p></section>
</main></body></html>
