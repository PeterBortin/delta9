# delta⁹ — ППО / TG-TRACKER

Статичний застосунок. Бекенда немає.

## Деплой на GitHub Pages

1. Завантаж вміст цієї теки в корінь репозиторію (щоб `index.html` був у корені).
2. Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `root`.
3. Відкрий видану URL-адресу.

`file://` не підійде: Telegram-клієнт і ES-модулі вимагають http(s).

## Структура

```
index.html          головний файл
js/support.js       рантайм інтерфейсу
js/sim.js           симуляція ППО
js/terrain.js       рельєф / висотні профілі
js/weather.js       вітер і погода
js/osm.js           обʼєкти OSM (критична інфраструктура)
js/tgcore.js        газетир, парсер повідомлень, трекер, тривоги
js/tgclient.js      клієнт Telegram (GramJS, завантажується на вимогу)
assets/             курсор і анімації
```

## Telegram

1. `my.telegram.org` → API development tools → створи app → `api_id`, `api_hash`.
2. Панель «Загрози» → введи `api_id`, `api_hash`, номер телефону → код → 2FA-пароль.
3. Ключі й сесія зберігаються лише в `localStorage` браузера. У коді їх немає.

Використовуй окремий акаунт: Telegram може блокувати акаунти за автоматизований доступ.

## Без Telegram

- «Демо-режим» у панелі «Загрози» — 15 вбудованих повідомлень, працює офлайн.
- Тривоги по областях тягнуться з публічного API (ubilling), токен не потрібен.

## Зовнішні залежності (CDN, потрібен інтернет)

MapLibre GL, deck.gl, PIXI, satellite.js, тайли ArcGIS/CARTO, Open-Meteo, Nominatim, geoBoundaries, DeepState.
