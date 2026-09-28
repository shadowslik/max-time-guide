// Вызовы бэкенда. База /api — тот же origin (в проде через Caddy, в dev через
// прокси Vite). Ответы приводятся к тем же формам, что раньше отдавал
// локальный планировщик, чтобы экраны не пришлось трогать.

// Подбор мест: POST /api/search. Возвращает { places, chain } как buildChain.
export async function searchRemote(minutes, interestIds, from) {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start: from, minutes, interests: interestIds }),
  });
  if (!response.ok) throw new Error('Подбор не удался');
  const data = await response.json();

  const places = data.places ?? [];
  const byId = Object.fromEntries(places.map((p) => [p.id, p]));

  const toChain = (c) => {
    if (!c) return null;
    const legs = (c.legs ?? [])
      .map((l) => ({ place: byId[l.placeId], walk: l.walk, visit: l.visit }))
      .filter((l) => l.place);
    if (legs.length < 2) return null;
    return {
      score: 0,
      total: c.total,
      buffer: c.buffer,
      walkBack: c.walkBack,
      interests: c.interests ?? [],
      legs,
    };
  };

  // Бэк отдаёт варианты цепочек (chains); chain — первый для совместимости.
  const chains = (data.chains ?? (data.chain ? [data.chain] : []))
    .map(toChain)
    .filter(Boolean);
  return { places, chain: chains[0] ?? null, chains };
}
