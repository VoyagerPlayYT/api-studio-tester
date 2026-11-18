# API STUDIO TESTER // HTTP CLIENT & BENCHMARK

![Version](https://img.shields.io/badge/version-1.0.0-orange)
![Backend](https://img.shields.io/badge/backend-FastAPI%20%2B%20httpx-009688)
![Engine](https://img.shields.io/badge/client-Async%20Zero--CORS-F97316)
![Database](https://img.shields.io/badge/db-SQLite%20Collections-0284C7)

Полноценный легковесный веб-аналог Postman и Insomnia: конструктор HTTP-запросов (GET, POST, PUT, DELETE, PATCH, HEAD), редактор заголовков, query-параметров, Bearer-токенов, Basic Auth, форматирование JSON-тела в 1 клик, замер точного времени отклика сервера (мс), история запросов и сохранение коллекций в базе данных SQLite.

## Технические возможности

- **Асинхронный прокси-движок на HTTPX:** Запросы отправляются с серверного бекенда, что полностью исключает ограничения CORS браузера и позволяет тестировать любые API, локальные микросервисы и внутренние порты сервера.
- **Прецизионный замер задержки (Latency Benchmark):** Замер времени ответа сервера с точностью до сотых долей миллисекунды (`perf_counter`) и подсчет размера полезной нагрузки (Bytes / KB).
- **Коллекции и папки в SQLite:** Группировка сохраненных запросов, быстрая загрузка параметров и заголовков.
- **Журнал истории (Request Audit Trail):** Автоматическая фиксация каждого выполненного запроса с кодом статуса и временем выполнения в SQLite.
- **JSON Prettifier:** Встроенный инструмент форматирования и валидации синтаксиса JSON-тела запроса.

## Запуск в 1 клик

```cmd
start.bat
```
Скрипт установит `fastapi`, `httpx`, `uvicorn` и запустит API Studio Tester на `http://localhost:8015`.
