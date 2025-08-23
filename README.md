# Dog Stopwatch — Cordova

Готовый Cordova-проект. Вся логика в папке `www/`.

## Локальная сборка (если не используешь Appflow)
1) Установи Node.js и Java 17.
2) `npm i -g cordova`
3) `npm i`
4) `npm run platform:add`
5) `npm run build:android`
APK появится в: `platforms/android/app/build/outputs/apk/debug/app-debug.apk`

## Структура
- `www/` — твой сайт секундомера (index.html + assets)
- `config.xml` — настройки приложения/иконок
- `package.json` — скрипты и dev-зависимость cordova
