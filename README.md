# Gmail agent monorepo

Два приложения и общий пакет с Prisma.

| Путь | Назначение | Деплой |
|------|------------|--------|
| `apps/admin` | Админка (Next.js) | [Vercel](https://vercel.com) |
| `apps/agent` | Обработчик писем (Lambda handler) | AWS Lambda **container image** |
| `packages/db` | `schema.prisma`, экспорт `prisma` | только как npm-workspace пакет |

## CI/CD в одном репозитории

Два независимых канала выката:

| Что | Как |
|-----|-----|
| **Админка (`apps/admin`)** | Подключение репозитория к [Vercel](https://vercel.com), Root Directory `apps/admin`. Деплой идёт по их правилам (обычно каждый пуш в выбранную ветку). GitHub Actions для этого не нужен. |
| **Агент Lambda + миграции БД** | `.github/workflows/deploy.yml`: OIDC в AWS, `prisma migrate deploy`, сборка Docker `apps/agent`, push в ECR, `update-function-code`. Запускается при пуше в `main`, если менялись `apps/agent`, `packages/db`, корневые `package.json` / `package-lock.json` или сам workflow; иначе — вручную (**Actions → Deploy Gmail Agent → Run workflow**). |

Так коммиты только в админку не гоняют пайплайн Lambda и не трогают AWS.

## Локально

```bash
cp .env.example .env
# задать DATABASE_URL и DIRECT_URL (см. .env.example; без PgBouncer — одинаковые URL)
npm install
npm run dev:admin
```

**PgBouncer:** в `packages/db/prisma/schema.prisma` заданы `url` (пул) и `directUrl` (прямой Postgres). Запросы приложения идут через `DATABASE_URL`; `prisma migrate` и `db push` используют `DIRECT_URL`.

**`.env`:** держите файл в **корне** репозитория. Скрипты `db:migrate` / `db:generate` в пакете `@gmail-agent/db` подгружают его через `dotenv-cli` (`../../.env`), иначе Prisma из `packages/db` не видит `DIRECT_URL`. `postinstall` по-прежнему только `prisma generate` — на Vercel переменные задаются в UI, не из файла.

## Vercel (admin)

1. Импорт репозитория GitHub.
2. **Root Directory**: `apps/admin`.
3. **Environment Variables**: `DATABASE_URL` (строка через PgBouncer) и `DIRECT_URL` (прямой Postgres для миграций из CI/локально; на рантайме Vercel не обязателен, если миграции не гоняете на билде).
4. `vercel.json` в `apps/admin` уже переопределяет install/build на установку из **корня** монорепозитория и сборку воркспейса `@gmail-agent/admin`.

Проверка БД: `GET /api/health` (без `DATABASE_URL` на билде клиент Prisma всё равно генерируется).

## AWS Lambda (agent)

1. Собрать образ из **корня** репозитория:

   ```bash
   docker build \
     --build-arg DATABASE_URL="$DATABASE_URL" \
     --build-arg DIRECT_URL="$DIRECT_URL" \
     -f apps/agent/Dockerfile -t gmail-agent:latest .
   ```

2. Запушить в ECR, создать Lambda **Function URL** или триггер (SQS/EventBridge) по мере готовности логики.
3. В конфигурации функции задать `DATABASE_URL` (желательно через PgBouncer). `DIRECT_URL` Lambda обычно не нужен, если миграции выполняются не в функции.

### GitHub Actions (`deploy.yml`)

Job **`deploy`** (environment **`production`**): `npm ci` → **`prisma migrate deploy`** → **`prisma generate`** → Docker (`apps/agent/Dockerfile`, build-args `DATABASE_URL` / `DIRECT_URL`) → push в ECR → **`aws lambda update-function-code`**.

Секреты GitHub (**Settings → Secrets and variables**, для environment **production** — если используете защищённое окружение):

| Секрет | Назначение |
|--------|------------|
| `DATABASE_URL` | Prisma (CI + build образа) |
| `DIRECT_URL` | Prisma `directUrl` (миграции, generate) |
| `AWS_ROLE_ARN` | OIDC для `configure-aws-credentials` |
| `AWS_LAMBDA_IMAGE_URI` | Полный URI образа в ECR с тегом (куда пушить) |
| `AWS_LAMBDA_FUNCTION_NAME` | Имя Lambda для обновления кода |

Шаг **Ensure ECR repository exists** создаёт репозиторий, если его ещё нет (имя берётся из `AWS_LAMBDA_IMAGE_URI`).

## Архитектура

- Один Postgres, одна схема Prisma; админка и агент — отдельные рантаймы, общий контракт данных через `@gmail-agent/db`.
- Версионирование схемы — миграции Prisma в `packages/db/prisma/migrations` (добавите по мере развития).
