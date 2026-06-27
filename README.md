# AI Tutor

AI Tutor — веб-приложение AI-репетитора с личными аккаунтами, историей чатов, загрузкой учебных материалов, подписками, дневными лимитами сообщений и автоматическими резервными копиями.

Проект построен как рабочий сервис, а не лендинг: после входа пользователь сразу попадает в чат. Frontend отвечает за интерфейс, backend является единственным источником истины для пользователей, чатов, подписок, лимитов, файлов и настроек.

## Возможности

- AI-чат в стиле современных ассистентов.
- Личные аккаунты пользователей, создаваемые администратором.
- Первый вход с обязательной сменой временного пароля.
- Сессии через bearer-token.
- Изолированные чаты, сообщения и вложения для каждого пользователя.
- Загрузка файлов: `PDF`, `DOCX`, `PPTX`, `TXT`, `PNG`, `JPG`, `JPEG`.
- Передача изображений и документов в Gemini как файлов, а не только как имён.
- Markdown, таблицы, код, формулы и цитаты в сообщениях.
- Поиск внутри текущего чата.
- Быстрый переход к последнему сообщению.
- Настройки темы, языка и длины ответов.
- Профиль пользователя, смена пароля, информация о подписке.
- Админ-панель для создания пользователей, продления подписок и настройки дневных лимитов.
- Подписки с блокировкой отправки новых сообщений после окончания срока.
- Дневной лимит сообщений, по умолчанию `30` сообщений в сутки.
- Автоматические backup-архивы базы и пользовательских данных.
- Адаптивный интерфейс для ПК, ноутбуков, планшетов и телефонов.

## Технологии

Frontend:

- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- React Router
- React Markdown
- KaTeX
- Lucide React

Backend:

- FastAPI
- Uvicorn
- SQLite в текущей локальной версии
- Подготовка backup-утилиты к PostgreSQL через `DATABASE_URL`
- Google Gemini API через `google-genai`
- Pydantic
- python-dotenv

Инфраструктура:

- Nginx для production reverse proxy.
- systemd для запуска backend на VPS.
- Backup scheduler внутри FastAPI.
- Опционально `rclone`, mounted cloud directory или другой внешний storage для резервных копий.

## Структура проекта

```text
AI-tutor/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── backup.py
│   │   └── __init__.py
│   ├── data/
│   │   ├── ai_tutor.sqlite3
│   │   ├── uploads/
│   │   ├── backup.log
│   │   └── backup_state.json
│   ├── backups/
│   │   ├── daily/
│   │   ├── weekly/
│   │   └── pre-update/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── styles.css
│   │   └── types.ts
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
├── scripts/
│   └── pre_update_backup.sh
├── BACKUP.md
├── PROJECT_RULES.md
├── .env.example
├── package.json
└── README.md
```

Назначение основных директорий:

- `frontend` — React-приложение, страницы, компоненты, стили, API-клиент.
- `frontend/src/pages` — основные экраны: чат, вход, профиль, настройки, админ-панель.
- `frontend/src/components` — переиспользуемые UI-компоненты чата.
- `frontend/src/lib/api.ts` — клиентские функции для запросов к backend.
- `backend` — FastAPI-приложение и server-side логика.
- `backend/app/main.py` — API, авторизация, чаты, Gemini, подписки, лимиты, настройки.
- `backend/app/backup.py` — создание и восстановление резервных копий.
- `backend/data` — локальная SQLite-база, загруженные файлы, состояние backup.
- `backend/data/uploads` — пользовательские вложения, разложенные по `user_id/chat_id/message_id`.
- `backend/backups` — локальные архивы резервных копий.
- `scripts` — служебные скрипты, например backup перед обновлением.
- `BACKUP.md` — отдельная документация по backup.
- `PROJECT_RULES.md` — обязательные правила адаптивности.

## Локальный запуск

### 1. Требования

Нужны:

- Python 3.11+
- Node.js 18+
- npm
- API-ключ Gemini

### 2. Установка backend-зависимостей

```bash
cd /path/to/AI-tutor
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Можно запускать и системным Python, если зависимости уже установлены, но виртуальное окружение предпочтительнее.

### 3. Установка frontend-зависимостей

```bash
cd /path/to/AI-tutor/frontend
npm install
```

### 4. Создание `.env`

В корне проекта:

```bash
cp .env.example .env
```

Заполнить минимум:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Не коммитить реальные ключи и пароли.

### 5. Запуск backend

Из корня проекта:

```bash
npm run backend
```

Команда запускает:

```bash
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8001
```

Backend будет доступен по адресу:

```text
http://127.0.0.1:8001
```

### 6. Запуск frontend

Во втором терминале из корня проекта:

```bash
npm run dev
```

Frontend будет доступен по адресу:

```text
http://127.0.0.1:5173
```

### 7. Сборка frontend

```bash
npm run build
```

### 8. Preview production-сборки

```bash
npm run preview
```

## Переменные окружения

Файл `.env.example` содержит безопасный шаблон. Реальный `.env` должен храниться только на машине разработчика или сервере.

Основные переменные:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
ADMIN_EMAIL=admin@aitutorapp.com
ADMIN_PASSWORD=
ADMIN_NAME=Administrator
```

- `GEMINI_API_KEY` — API-ключ Gemini. Обязателен для генерации ответов.
- `GEMINI_MODEL` — модель Gemini. Если не указана, используется `gemini-2.5-flash`.
- `ADMIN_EMAIL` — email администратора, создаваемого при первой инициализации базы.
- `ADMIN_PASSWORD` — пароль администратора при первой инициализации базы.
- `ADMIN_NAME` — имя администратора.

Backup:

```env
BACKUP_ENABLED=1
BACKUP_SCHEDULE_HOUR_UTC=2
BACKUP_DAILY_RETENTION=7
BACKUP_WEEKLY_RETENTION=4
BACKUP_REMOTE_DIR=/mnt/ai-tutor-backups
BACKUP_REMOTE_COMMAND=rclone copy {archive} remote:ai-tutor-backups
```

- `BACKUP_ENABLED` — включает или отключает автоматический backup scheduler.
- `BACKUP_SCHEDULE_HOUR_UTC` — час ежедневного backup по UTC.
- `BACKUP_DAILY_RETENTION` — сколько ежедневных копий хранить локально.
- `BACKUP_WEEKLY_RETENTION` — сколько еженедельных копий хранить локально.
- `BACKUP_REMOTE_DIR` — директория внешнего хранилища, куда копируются архивы.
- `BACKUP_REMOTE_COMMAND` — команда отправки архива во внешнее хранилище. `{archive}` заменяется на путь к архиву.

PostgreSQL future mode:

```env
DATABASE_URL=postgresql://user:password@host:5432/ai_tutor
BACKUP_PG_DUMP_COMMAND=pg_dump
BACKUP_PG_RESTORE_COMMAND=pg_restore
```

Сейчас приложение использует SQLite в `backend/data/ai_tutor.sqlite3`. PostgreSQL указан как направление масштабирования и уже учитывается backup-утилитой.

## Архитектура

Общая схема:

```text
User Browser
    |
    v
React Frontend
    |
    | HTTP / JSON / multipart form-data
    v
FastAPI Backend
    |
    +--> SQLite Database
    |
    +--> Uploaded Files Storage
    |
    +--> Gemini API
    |
    +--> Backup System
```

Frontend:

- отображает интерфейс;
- хранит только локальный session token;
- не принимает самостоятельных решений о доступе, подписках и лимитах;
- получает состояние пользователя и чатов от backend.

Backend:

- проверяет авторизацию;
- проверяет владельца каждого ресурса;
- проверяет подписку;
- проверяет дневной лимит сообщений;
- сохраняет пользователей, чаты, сообщения, настройки и файлы;
- формирует prompt для Gemini;
- передаёт в Gemini текст, историю текущего чата и прикреплённые файлы.

Gemini API:

- получает системный prompt;
- получает настройки пользователя;
- получает историю только текущего чата;
- получает вложения последнего сообщения как файлы.

Database:

- хранит пользователей, сессии, настройки, чаты, сообщения, вложения, лимиты и reset-токены.

## База данных

Текущая локальная база:

```text
backend/data/ai_tutor.sqlite3
```

Основные таблицы:

- `users` — пользователи, email, имя, аватар, хеш пароля, роль, тариф, дата окончания подписки, флаг обязательной смены пароля, reset-токены.
- `user_settings` — настройки пользователя: тема, язык, длина ответов, простота объяснений, примеры, практика, автозаголовки.
- `sessions` — активные session tokens. Не попадает в backup.
- `chats` — чаты пользователя, название, даты создания и обновления.
- `messages` — сообщения пользователя и AI, роль, текст, время создания.
- `attachments` — метаданные вложений: имя, тип, размер, путь к файлу.
- `app_settings` — глобальные настройки приложения, сейчас дневной лимит сообщений и порог предупреждения.
- `daily_message_usage` — сколько пользовательских сообщений отправлено за текущий день и дата последнего сброса.

Связь данных:

```text
User
  |
  +-- UserSettings
  +-- Sessions
  +-- Chats
        |
        +-- Messages
              |
              +-- Attachments
```

Каждый объект привязан к `user_id`. Backend всегда фильтрует данные по текущему авторизованному пользователю.

## Авторизация и пользователи

Самостоятельная регистрация отключена:

```text
POST /api/auth/register -> 403
```

Пользователей создаёт администратор в админ-панели. При создании указываются:

- имя;
- email;
- тариф;
- срок подписки.

Система генерирует временный пароль. При первом входе пользователь обязан сменить пароль. Пока `must_change_password = true`, доступ к AI Tutor закрыт.

Пароли не хранятся в открытом виде. Backend использует PBKDF2-HMAC-SHA256 с солью.

## Работа сессий

При успешном входе:

1. Backend проверяет email и пароль.
2. Создаёт случайный token.
3. Сохраняет token в таблицу `sessions`.
4. Возвращает token во frontend.
5. Frontend сохраняет token в `localStorage`.
6. Все защищённые запросы идут с заголовком:

```http
Authorization: Bearer <token>
```

При выходе:

- frontend вызывает `/api/auth/logout`;
- backend удаляет token из `sessions`;
- frontend удаляет token из `localStorage`;
- пользователь перенаправляется на страницу входа.

Почему sessions не сохраняются в backup:

- это временные данные доступа;
- после восстановления проекта пользователи должны войти заново;
- backup не должен переносить активные сессии и reset-токены.

## Подписки

У каждого пользователя есть:

- `plan`;
- `subscription_until`.

Backend проверяет подписку:

- при входе;
- перед созданием нового чата;
- перед отправкой сообщения;
- перед защищёнными действиями, где нужен активный доступ.

Если подписка активна:

- пользователь может пользоваться AI Tutor полностью.

Если подписка закончилась:

- пользователь может открыть старые чаты;
- может читать историю;
- может просматривать прикреплённые материалы;
- не может отправлять новые сообщения;
- Gemini не вызывается.

Продление:

1. Администратор открывает админ-панель.
2. Выбирает пользователя.
3. Нажимает продление на 1 неделю, 1 месяц, 3 месяца или 1 год.
4. Backend обновляет `subscription_until`.
5. История, настройки, профиль и файлы сохраняются.

## Дневной лимит сообщений

По умолчанию:

- дневной лимит: `30` пользовательских сообщений;
- предупреждение: после `25-го` сообщения.

Сообщением считается только сообщение пользователя. Ответ AI в лимит не входит.

Backend хранит:

- `app_settings.daily_message_limit`;
- `app_settings.warning_after_messages`;
- `daily_message_usage.used_count`;
- `daily_message_usage.reset_date`.

Проверка выполняется только на backend:

1. Перед сохранением сообщения backend проверяет лимит.
2. Если лимит исчерпан, сообщение не сохраняется и Gemini не вызывается.
3. Если лимит доступен, backend сохраняет сообщение пользователя.
4. После сохранения пользовательского сообщения счётчик увеличивается на 1.
5. При новом UTC-дне счётчик автоматически сбрасывается.

Frontend только отображает готовое состояние из `user.messageUsage`.

Администратор может изменить дневной лимит и порог предупреждения через админ-панель без изменения исходного кода.

## Чаты и сообщения

Каждый пользователь видит только свои чаты.

Новый чат:

- создаёт новый `chat_id`;
- не смешивает контекст с другими чатами;
- начинается с пустой истории.

Отправка сообщения:

1. Frontend отправляет `content` и файлы как `multipart/form-data`.
2. Backend проверяет авторизацию.
3. Backend проверяет подписку.
4. Backend проверяет дневной лимит.
5. Backend проверяет владельца чата.
6. Backend валидирует файлы.
7. Backend сохраняет сообщение пользователя.
8. Backend сохраняет вложения.
9. Backend отправляет prompt и файлы в Gemini.
10. Backend сохраняет ответ AI.
11. Backend возвращает актуальный чат.

Контекст Gemini включает только историю текущего чата. История других чатов и других пользователей никогда не используется.

## Файлы и вложения

Поддерживаемые форматы:

- `PDF` до 20 МБ;
- `DOCX` до 20 МБ;
- `PPTX` до 20 МБ;
- `TXT` до 5 МБ;
- `PNG` до 15 МБ;
- `JPG` до 15 МБ;
- `JPEG` до 15 МБ.

Видео и архивы не поддерживаются.

Файлы сохраняются в:

```text
backend/data/uploads/<user_id>/<chat_id>/<message_id>/<attachment_id>.<ext>
```

Gemini получает:

- текст пользователя;
- историю текущего чата;
- описание вложений;
- bytes файла через `types.Part.from_bytes`.

Для изображений backend передаёт сам файл, поэтому модель может анализировать скриншоты, фотографии, интерфейсы и текст на изображении.

## Резервное копирование

Backup-система находится в:

```text
backend/app/backup.py
```

Автоматический scheduler запускается при старте FastAPI, если backup включён.

Что входит в backup:

- пользователи;
- профили;
- настройки;
- подписки;
- чаты;
- сообщения;
- названия чатов;
- метаданные вложений;
- SQLite snapshot;
- загруженные файлы.

Что не входит:

- sessions;
- reset-токены;
- логи;
- кэш;
- `node_modules`;
- временные файлы;
- frontend build output.

Локальные архивы:

```text
backend/backups/daily
backend/backups/weekly
backend/backups/pre-update
```

Retention:

- последние 7 daily backup;
- последние 4 weekly backup.

Команды:

```bash
npm run backup:daily
npm run backup:weekly
npm run backup:pre-update
python3 -m backend.app.backup restore backend/backups/daily/<archive>.zip
```

Перед обновлением проекта:

```bash
./scripts/pre_update_backup.sh
```

Внешнее хранилище настраивается через `BACKUP_REMOTE_DIR` или `BACKUP_REMOTE_COMMAND`. Подробности в `BACKUP.md`.

## Развёртывание на сервере

Ниже базовый сценарий для Ubuntu VPS.

### 1. Подготовить сервер

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm nginx git
```

Для HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Клонировать проект

```bash
cd /opt
sudo git clone <repo-url> ai-tutor
sudo chown -R $USER:$USER /opt/ai-tutor
cd /opt/ai-tutor
```

### 3. Установить backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 4. Установить frontend и собрать production build

```bash
cd frontend
npm install
npm run build
cd ..
```

### 5. Создать `.env`

```bash
cp .env.example .env
nano .env
```

Минимум:

```env
GEMINI_API_KEY=your_key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=strong_initial_admin_password
ADMIN_NAME=Administrator
BACKUP_ENABLED=1
```

Важно: `ADMIN_PASSWORD` используется при первом создании администратора. Если админ уже существует, смена `.env` сама по себе не меняет его пароль в базе.

### 6. systemd для backend

Создать unit:

```bash
sudo nano /etc/systemd/system/ai-tutor-backend.service
```

Пример:

```ini
[Unit]
Description=AI Tutor FastAPI backend
After=network.target

[Service]
WorkingDirectory=/opt/ai-tutor
EnvironmentFile=/opt/ai-tutor/.env
ExecStart=/opt/ai-tutor/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Права:

```bash
sudo chown -R www-data:www-data /opt/ai-tutor/backend/data /opt/ai-tutor/backend/backups
sudo systemctl daemon-reload
sudo systemctl enable ai-tutor-backend
sudo systemctl start ai-tutor-backend
sudo systemctl status ai-tutor-backend
```

### 7. Nginx

Создать конфиг:

```bash
sudo nano /etc/nginx/sites-available/ai-tutor
```

Пример:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    root /opt/ai-tutor/frontend/dist;
    index index.html;

    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Активировать:

```bash
sudo ln -s /etc/nginx/sites-available/ai-tutor /etc/nginx/sites-enabled/ai-tutor
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Домен и HTTPS

1. В DNS домена создать `A`-запись на IP VPS.
2. Проверить, что сайт открывается по HTTP.
3. Выпустить сертификат:

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot обновит Nginx-конфиг и включит HTTPS.

### 9. Backup на сервере

Настроить внешний storage:

```env
BACKUP_REMOTE_COMMAND=rclone copy {archive} remote:ai-tutor-backups
```

или mounted directory:

```env
BACKUP_REMOTE_DIR=/mnt/ai-tutor-backups
```

Проверить ручной backup:

```bash
cd /opt/ai-tutor
sudo -u www-data /opt/ai-tutor/.venv/bin/python -m backend.app.backup create --kind daily
```

Перед deploy обновления:

```bash
./scripts/pre_update_backup.sh
git pull
source .venv/bin/activate
pip install -r backend/requirements.txt
cd frontend && npm install && npm run build && cd ..
sudo systemctl restart ai-tutor-backend
sudo systemctl reload nginx
```

## Адаптивность

Главное правило проекта: любая новая функция, страница, модальное окно, меню, кнопка, форма или компонент должны поддерживать Responsive Design.

Поддерживаемые устройства:

- настольные компьютеры;
- ноутбуки;
- планшеты в портретной и горизонтальной ориентации;
- Android-смартфоны;
- iPhone.

Запрещено:

- создавать отдельную мобильную версию;
- дублировать страницы для разных устройств;
- добавлять функции только для ПК;
- ломать существующие responsive layout patterns.

Подробные правила находятся в `PROJECT_RULES.md`.

## Правила разработки

- Backend — единственный источник истины.
- Frontend только отображает данные и отправляет действия пользователя.
- Не хранить важные пользовательские данные только во frontend.
- Все операции с чатами, сообщениями, файлами и настройками должны проверять владельца.
- История разных пользователей не должна смешиваться.
- История разных чатов не должна смешиваться в prompt.
- Подписки и лимиты проверяются только backend.
- Не хранить пароли в открытом виде.
- Не коммитить реальные API-ключи, пароли, токены и `.env`.
- Не хранить active sessions и reset-токены в backup.
- Не принимать неподдерживаемые файлы.
- Не отправлять Gemini только имя изображения, если пользователь прикрепил изображение.
- Перед изменениями в production делать backup.
- Новые UI-компоненты должны сохранять адаптивность.
- Не переписывать архитектуру без явной необходимости.

## Основные API endpoints

Auth:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

User:

- `GET /api/me`
- `PATCH /api/me/settings`
- `PATCH /api/me/profile`
- `DELETE /api/me/history`

Admin:

- `GET /api/admin/users`
- `POST /api/admin/users`
- `POST /api/admin/users/{user_id}/extend`
- `GET /api/admin/limits`
- `PATCH /api/admin/limits`

Chats:

- `GET /api/chats`
- `POST /api/chats`
- `GET /api/chats/{chat_id}`
- `POST /api/chats/{chat_id}/messages`

## Проверки перед сдачей изменений

Backend:

```bash
python3 -m py_compile backend/app/main.py
python3 -m py_compile backend/app/backup.py
```

Frontend:

```bash
npm run build
```

Backup:

```bash
npm run backup:daily
```

Для изменений, связанных с авторизацией, подписками, лимитами и файлами, дополнительно проверить вручную:

- вход админа;
- создание пользователя;
- первый вход и смену пароля;
- отправку сообщения;
- загрузку файла;
- истечение подписки;
- дневной лимит сообщений;
- сохранение и восстановление истории чатов.

## Roadmap

Идеи для будущего развития:

- PostgreSQL как основная production-база.
- Миграции базы данных через Alembic.
- Автоматическая регистрация пользователей.
- Интеграция платежей и автоматическое продление подписок.
- Email-рассылка reset-ссылок вместо MVP-возврата token в UI.
- Глобальный поиск по всем чатам.
- Поиск по загруженным документам.
- Расширенная аналитика использования для администратора.
- Роли и права доступа для нескольких администраторов.
- WebSocket/SSE streaming ответов AI.
- Очередь фоновых задач для тяжёлой обработки файлов.
- Object storage для uploads и backups.
- Docker Compose для локальной разработки и deploy.
- E2E-тесты через Playwright.
- Unit-тесты backend-логики лимитов, подписок и файлов.

## Важные замечания

- Текущий production-like backend слушает `127.0.0.1:8001`.
- Текущий frontend dev server слушает `127.0.0.1:5173`.
- SQLite-файл и uploads содержат пользовательские данные. Не удалять их без backup.
- Фронтенд не должен сам решать, есть ли доступ к AI. Он показывает состояние, которое пришло от backend.
- Перед любым обновлением проекта запускать pre-update backup.
