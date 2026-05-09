# RabbitMQTelegram-API

Три микросервиса на Nest.js, связанные через RabbitMQ. На вход — HTTP, на
выход — уведомления в Telegram:

- **producer** — HTTP-эндпоинт, валидирует пейлоад, оборачивает в event
  envelope и публикует в брокер с publisher confirms и ретраями.
- **consumer** — общий обработчик событий, читает из своей очереди с
  ручным ack, ретраит ошибки через dead-letter цикл, отбрасывает дубли по
  кешу идемпотентности.
- **telegram** — та же подписочная механика, только хендлер ходит в
  Telegram Bot API.

Всё собрано как Nest-монорепо (`apps/*` + `libs/*`), каждый сервис
упаковывается в свой контейнер, `docker-compose` поднимает стек целиком
вместе с RabbitMQ.

## Стек

- Nest.js 10, TypeScript 5.5
- `amqp-connection-manager` + `amqplib` (auto-reconnect, publisher confirms)
- `class-validator` / `class-transformer` — валидация HTTP-пейлоадов
- `joi` — валидация env (fail-fast при старте)
- `@nestjs/swagger` — документация producer API
- `jest` + `supertest` — unit / e2e

---

# Запуск

## 1. Что нужно поставить

| инструмент       | версия                  | зачем                              |
|------------------|-------------------------|------------------------------------|
| Docker           | 24+                     | единственное обязательное для рекомендуемого пути |
| Docker Compose   | v2 (`docker compose`)   | идёт вместе с современным Docker   |
| Node.js          | 20+ (только для `npm run`) | локальная разработка без Docker    |
| Telegram-бот     | —                       | чтобы сообщения реально доходили   |

Свободные порты на хосте: `3000`, `3001`, `3002`, `5672`, `15672`. Все
переопределяются через `.env`, если что-то занято.

## 2. Получить Telegram-бота

1. Открыть [@BotFather](https://t.me/BotFather), выполнить `/newbot`.
   Указать имя и username, BotFather пришлёт токен вида
   `123456:ABC-XYZ…`. Это значение для `TELEGRAM_BOT_TOKEN`.
2. Решить, куда бот будет писать:
   - **Личка:** написать боту любое сообщение, открыть в браузере
     `https://api.telegram.org/bot<TOKEN>/getUpdates`, найти в JSON
     `"chat":{"id":…}`. Это число — `chat_id`.
   - **Группа:** добавить бота в группу, написать любое сообщение, тот же
     URL. Для групп `chat_id` будет отрицательным, например
     `-1001234567890`.
3. Опционально: прописать `TELEGRAM_DEFAULT_CHAT_ID` в `.env`, чтобы
     можно было слать запросы без `recipient`. Иначе передаём его в
     каждом запросе.

## 3. Запуск через Docker (рекомендуемый путь)

```bash
git clone https://github.com/phpassist3/RabbitMQTelegram-API.git
cd RabbitMQTelegram-API
cp .env.example .env
# открыть .env, прописать TELEGRAM_BOT_TOKEN (и при желании TELEGRAM_DEFAULT_CHAT_ID)

docker compose up --build -d
docker compose ps
```

Когда `rabbitmq` показывает `(healthy)`, а три сервиса — `running`, стек
готов. Логи:

```bash
docker compose logs -f producer consumer telegram
```

## 4. Проверка работоспособности

```bash
# health producer-а
curl http://localhost:3000/api/health
# → {"status":"ok",...}

# отправить уведомление
curl -X POST http://localhost:3000/api/events/notifications \
  -H 'content-type: application/json' \
  -d '{
    "type": "notification.created",
    "payload": {
      "channel": "telegram",
      "recipient": "<ВАШ_CHAT_ID>",
      "title": "Тест",
      "message": "Привет от RabbitMQTelegram-API"
    }
  }'
# → 202 {"id":"<uuid>","acceptedAt":"2026-…"}
```

Бот должен отправить сообщение в чат за секунду-другую. Тот же UUID
проходит насквозь через брокер — повторный запрос с тем же `id` ничего
не делает (на стороне consumer-ов есть кеш идемпотентности).

Полезные UI на время работы стека:

- Producer Swagger: <http://localhost:3000/api/docs>
- RabbitMQ Management: <http://localhost:15672> (guest / guest по умолчанию)

## 5. Остановка / очистка

```bash
docker compose down              # остановить контейнеры, тома сохранить
docker compose down -v           # ещё и снести том rabbitmq
```

## 6. Локальная разработка без Docker

RabbitMQ всё равно нужен — проще всего поднять его той же картинкой:

```bash
docker run --rm -p 5672:5672 -p 15672:15672 rabbitmq:3.13-management
```

Дальше из корня проекта:

```bash
cp .env.example .env
npm install

# в трёх терминалах:
npm run start:producer:dev
npm run start:consumer:dev
npm run start:telegram:dev
```

`*:dev` использует `nest start --watch`, так что сохранение файла
перезапускает процесс.

---

# HTTP API

## `POST /api/events/notifications`

Тело запроса:

```json
{
  "id": "11111111-2222-4333-8444-555555555555",
  "type": "notification.created",
  "payload": {
    "channel": "telegram",
    "recipient": "123456789",
    "title": "Order placed",
    "message": "Order #42 was created.",
    "metadata": { "orderId": 42 }
  }
}
```

| поле                 | обязательное | комментарий                                         |
|----------------------|--------------|-----------------------------------------------------|
| `id`                 | нет          | UUID v4. Если не передан — генерится на стороне producer-а и возвращается в ответе. По нему consumer-ы делают идемпотентность, поэтому передавать свой `id` — самый надёжный способ сделать API exactly-once для клиента, который ретраит. |
| `type`               | да           | дискриминатор события, произвольная строка ≤ 128 символов |
| `payload.channel`    | да           | сейчас поддерживается только `"telegram"`           |
| `payload.recipient`  | да           | telegram chat id; можно оставить пустым, если задан `TELEGRAM_DEFAULT_CHAT_ID` |
| `payload.title`      | нет          | рендерится `<b>…</b>` над сообщением                |
| `payload.message`    | да           | plain text, ≤ 4000 символов                         |
| `payload.metadata`   | нет          | рендерится списком `• key: <code>value</code>`      |

Ответы:

- `202 Accepted` — опубликовано; тело `{ id, acceptedAt }`
- `400 Bad Request` — валидация не прошла (нет полей, длина больше лимита и т.д.)
- `503 Service Unavailable` — брокер не принял сообщение за
  `RABBITMQ_PUBLISH_RETRIES + 1` попыток. Можно ретраить с тем же `id`.

Swagger UI на `/api/docs` показывает схему интерактивно.

---

# Конфигурация

Все env-переменные валидируются на старте. Если обязательной нет — процесс
не поднимается с понятной ошибкой.

| переменная                     | дефолт                  | где используется    |
|--------------------------------|-------------------------|---------------------|
| `RABBITMQ_URL`                 | —                       | все                 |
| `PRODUCER_PORT`                | 3000                    | producer            |
| `PRODUCER_API_PREFIX`          | `api`                   | producer            |
| `RABBITMQ_PUBLISH_RETRIES`     | 5                       | producer            |
| `RABBITMQ_PUBLISH_BACKOFF_MS`  | 500 (× 2^попытки)       | producer            |
| `RABBITMQ_PUBLISH_TIMEOUT_MS`  | 5000                    | producer            |
| `CONSUMER_PORT`                | 3001                    | consumer            |
| `CONSUMER_PREFETCH`            | 10                      | consumer, telegram  |
| `CONSUMER_MAX_ATTEMPTS`        | 5                       | consumer            |
| `CONSUMER_RETRY_DELAY_MS`      | 5000                    | consumer            |
| `IDEMPOTENCY_CACHE_SIZE`       | 10000                   | consumer, telegram  |
| `TELEGRAM_PORT`                | 3002                    | telegram            |
| `TELEGRAM_BOT_TOKEN`           | —                       | telegram            |
| `TELEGRAM_DEFAULT_CHAT_ID`     | —                       | telegram (fallback) |
| `TELEGRAM_API_TIMEOUT_MS`      | 8000                    | telegram            |
| `TELEGRAM_MAX_ATTEMPTS`        | 5                       | telegram            |
| `TELEGRAM_RETRY_DELAY_MS`      | 5000                    | telegram            |

---

# Надёжность

## Producer

- Publisher работает на `amqp-connection-manager` через confirm-канал:
  `publish()` резолвится только после ack от брокера.
- Неуспешный publish ретраится с экспоненциальным backoff
  (`RABBITMQ_PUBLISH_BACKOFF_MS × 2^попытки`) до `RABBITMQ_PUBLISH_RETRIES`
  попыток. После этого HTTP-запрос отдаёт `503`, и клиент повторяет с
  тем же `id`.
- Соединение восстанавливается автоматически в фоне; сообщения,
  отправленные в момент короткого обрыва, буферизуются до возврата
  линка — в пределах per-publish таймаута.

## Consumer и Telegram

- Оба подписчика читают с `noAck=false` и зовут `ack` только после
  успешного завершения хендлера.
- При ошибке хендлера сообщение `nack`-ается с `requeue=false` и попадает
  в соседнюю `*.retry.q` (TTL = `*_RETRY_DELAY_MS`), у которой DLX
  настроен обратно на основную очередь. Получаем отложенный redelivery
  без поллинга и без hot-loop через `nack(requeue=true)`.
- Количество циклов читается из AMQP-заголовка `x-death`. После
  `*_MAX_ATTEMPTS` сообщение паркуется в `*.dead.q` для ручного разбора.
- Идемпотентность: ограниченный in-memory `Set` недавно обработанных
  `id`-шников отбрасывает дубли, которые приходят из retry-цикла или
  из at-least-once семантики брокера. Для multi-instance деплоя меняется
  на Redis-стор — интерфейс лежит в
  `libs/messaging/src/idempotency.store.ts`.
- Producer проставляет всем сообщениям `persistent=true`, очереди durable,
  поэтому in-flight сообщения переживают рестарт брокера.

## Graceful shutdown

Каждый сервис подписан на `OnApplicationShutdown` и закрывает свой канал
и соединение. In-flight хендлеры успевают отработать до завершения
процесса.

---

# Тесты

```bash
npm test          # все unit-тесты (jest)
npm run test:cov  # с покрытием
npm run test:e2e  # producer HTTP e2e (publisher замокан)
```

Покрыто:

- `InMemoryIdempotencyStore` — FIFO-эвикция, отбрасывание дублей, валидация
- `RabbitSubscriber.dispatch` — ack при успехе, nack-with-retry, dead-queue
  при достижении max attempts, malformed payload, hit идемпотентности
- `PublisherService` — happy path, retry-then-succeed, отказ после ретраев
- `EventsService` — генерация и проброс `id`
- `NotificationsHandler` — форматирование, fallback на default-чат, проброс
  ошибок, дроп не-telegram сообщений
- `formatNotification` — экранирование HTML, рендер метаданных
- HTTP e2e — валидация, успешный путь, отказ на oversized payload

E2e-сьют мокает брокер через `Test.overrideProvider`, поэтому реальный
RabbitMQ для него не нужен.

---

# Структура проекта

```
apps/
  producer/      HTTP-приём + publisher
  consumer/      общий обработчик событий
  telegram/      диспатчер в Telegram
libs/
  contracts/     event envelope + константы топологии  (alias: @app/contracts)
  messaging/     RabbitSubscriber, кеш идемпотентности (alias: @app/messaging)
docker-compose.yml
```

Каждый сервис — обычное Nest-приложение со своим `AppModule`,
`ConfigModule` (env через Joi) и feature-модулями. Библиотеки подключаются
через TypeScript path aliases, объявленные в `tsconfig.json` и
зарегистрированные в `nest-cli.json`.

---

# Что осознанно осталось за кадром

То, чем имеет смысл заниматься, если эта штука уйдёт из категории
"демо":

- Заменить in-memory кеш идемпотентности на общий стор (для Redis хватает
  `SETEX <id> 24h 1`).
- Структурное JSON-логирование (pino) и метрики Prometheus на `/metrics`.
- Объявление топологии брокера вынести в одноразовый bootstrap-шаг,
  чтобы не пере-asserить-ить её при каждом старте consumer-а.
- Авторизация перед producer API.
- Конкретно по Telegram: распознавать `4xx` (chat not found, bot blocked,
  …) и сразу класть в dead-queue, не тратить `MAX_ATTEMPTS` циклов на
  то, что заведомо не починится.

---

# Траблшутинг

**`Config validation error: "TELEGRAM_BOT_TOKEN" is required`**
Telegram-сервис без токена не стартует. Прописать в `.env`,
`docker compose up -d telegram`.

**Producer возвращает `503`, хотя брокер живой**
Смотреть `docker compose logs producer` — обычно AMQP-креды в `.env` не
совпадают с теми, с которыми RabbitMQ инициализировался. Если меняли
`RABBITMQ_USER` / `RABBITMQ_PASS` после первого запуска, нужно ещё
`docker compose down -v`, чтобы снести том со старым пользователем.

**Бот не доставляет, хотя producer ответил `202`**
Сообщение принято брокером, со стороны producer-а всё ок. Смотрим
`docker compose logs telegram`. После `MAX_ATTEMPTS` сообщение лежит в
`events.telegram.dead.q`, его можно вытащить из management-UI
(<http://localhost:15672> → Queues → `events.telegram.dead.q` → Get
messages).

**Порт занят**
Переопределяем в `.env`: `PRODUCER_PORT=3010`,
`RABBITMQ_AMQP_PORT=5673` и т.п. compose проксирует их в контейнеры.
