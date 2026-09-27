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
  let chain = null;
  if (data.chain) {
    const byId = Object.fromEntries(places.map((p) => [p.id, p]));
    const legs = (data.chain.legs ?? [])
      .map((l) => ({ place: byId[l.placeId], walk: l.walk, visit: l.visit }))
      .filter((l) => l.place);
    if (legs.length >= 2) {
      chain = {
        score: 0,
        total: data.chain.total,
        buffer: data.chain.buffer,
        walkBack: data.chain.walkBack,
        legs,
      };
    }
  }
  return { places, chain };
}
