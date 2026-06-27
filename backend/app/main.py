from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import shutil
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, EmailStr, Field

from backend.app.backup import start_backup_scheduler

BASE_DIR = Path(__file__).resolve().parents[1]
DB_FILE = BASE_DIR / "data" / "ai_tutor.sqlite3"
UPLOADS_DIR = BASE_DIR / "data" / "uploads"
ALLOWED_EXTENSIONS = {"pdf", "docx", "pptx", "txt", "png", "jpg", "jpeg"}
FILE_LIMITS = {
    "pdf": 20 * 1024 * 1024,
    "docx": 20 * 1024 * 1024,
    "pptx": 20 * 1024 * 1024,
    "txt": 5 * 1024 * 1024,
    "png": 15 * 1024 * 1024,
    "jpg": 15 * 1024 * 1024,
    "jpeg": 15 * 1024 * 1024,
}
MIME_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "txt": "text/plain",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
}

load_dotenv()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

SYSTEM_PROMPT = """
Ты — AI Tutor.

Ты — современный AI-репетитор. Твоя задача — помогать пользователю понимать материал, а не просто отвечать на вопросы.

Правила:
- Не рассказывай пользователю, как ты собираешься отвечать.
- Не описывай свой план действий.
- Не используй сухие заготовки вроде "Понял запрос", "Вот как я начну", "Сначала выделим главную идею".
- Начинай сразу по существу.
- Объясняй простыми словами.
- Если тема сложная — разбивай её на маленькие понятные части.
- Приводи реальные примеры и аналогии.
- Если пользователь просит кратко — отвечай кратко.
- Если пользователь просит подробно — объясняй глубже.

Если пользователь решает задачу:
- сначала дай небольшую подсказку;
- если пользователь просит полное решение — покажи его пошагово.

Если пользователь просит проверить ответ:
- покажи место ошибки;
- объясни причину;
- покажи правильный вариант.

Если пользователь прикрепил файл:
- используй содержимое файла как главный источник информации;
- если прикреплено изображение, анализируй само изображение: текст, интерфейс, фото, схему или скриншот;
- не отвечай шаблонно, что не можешь анализировать изображения, если изображение передано в запросе.

Главная цель — чтобы пользователь действительно понял материал после ответа.
""".strip()


class Attachment(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    chat_id: str = Field(alias="chatId")
    message_id: str = Field(alias="messageId")
    name: str
    type: str
    size: int
    created_at: str = Field(alias="createdAt")
    file_path: str | None = Field(default=None, alias="filePath")


@dataclass
class PreparedUpload:
    filename: str
    extension: str
    mime_type: str
    data: bytes


class Message(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    chat_id: str = Field(alias="chatId")
    role: Literal["user", "assistant"]
    content: str
    created_at: str = Field(alias="createdAt")
    attachments: list[Attachment] = []


class Chat(BaseModel):
    id: str
    user_id: str = Field(alias="userId")
    title: str
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    messages: list[Message] = []


class UserSettings(BaseModel):
    theme: str = "dark"
    language: str = "ru"
    answer_length: str = Field(default="balanced", alias="answerLength")
    simple_language: bool = Field(default=True, alias="simpleLanguage")
    more_examples: bool = Field(default=True, alias="moreExamples")
    more_practice: bool = Field(default=False, alias="morePractice")
    auto_title: bool = Field(default=True, alias="autoTitle")


class MessageUsage(BaseModel):
    used: int
    limit: int
    remaining: int
    warning_after: int = Field(alias="warningAfter")
    show_warning: bool = Field(alias="showWarning")
    reset_date: str = Field(alias="resetDate")


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    avatar: str | None = None
    role: Literal["admin", "user"] = "user"
    plan: str = "MONTH"
    subscription_until: str = Field(alias="subscriptionUntil")
    must_change_password: bool = Field(alias="mustChangePassword")
    subscription_active: bool = Field(alias="subscriptionActive")
    message_usage: MessageUsage = Field(alias="messageUsage")
    settings: UserSettings


class AuthRequest(BaseModel):
    email: EmailStr
    password: str


class AdminCreateUserRequest(BaseModel):
    name: str
    email: EmailStr
    plan: str = "MONTH"
    subscription_duration: str = Field(alias="subscriptionDuration")


class AdminExtendSubscriptionRequest(BaseModel):
    subscription_duration: str = Field(alias="subscriptionDuration")


class AdminLimitsRequest(BaseModel):
    daily_message_limit: int = Field(alias="dailyMessageLimit")
    warning_after_messages: int = Field(alias="warningAfterMessages")


class AdminLimits(BaseModel):
    daily_message_limit: int = Field(alias="dailyMessageLimit")
    warning_after_messages: int = Field(alias="warningAfterMessages")


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(alias="currentPassword")
    new_password: str = Field(alias="newPassword")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(alias="newPassword")


class ProfileUpdateRequest(BaseModel):
    name: str
    avatar: str | None = None


class AdminUser(BaseModel):
    id: str
    email: str
    name: str
    role: Literal["admin", "user"]
    plan: str
    subscription_until: str = Field(alias="subscriptionUntil")
    must_change_password: bool = Field(alias="mustChangePassword")
    created_at: str = Field(alias="createdAt")


class AdminCreateUserResponse(BaseModel):
    user: AdminUser
    temporary_password: str = Field(alias="temporaryPassword")


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


class PasswordResetResponse(BaseModel):
    ok: bool
    reset_token: str | None = Field(default=None, alias="resetToken")


app = FastAPI(title="AI Tutor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect_db() -> sqlite3.Connection:
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with connect_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                avatar TEXT,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_settings (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                theme TEXT NOT NULL DEFAULT 'dark',
                language TEXT NOT NULL DEFAULT 'ru',
                answer_length TEXT NOT NULL DEFAULT 'balanced',
                simple_language INTEGER NOT NULL DEFAULT 1,
                more_examples INTEGER NOT NULL DEFAULT 1,
                more_practice INTEGER NOT NULL DEFAULT 0,
                auto_title INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS attachments (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                size INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS daily_message_usage (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                used_count INTEGER NOT NULL DEFAULT 0,
                reset_date TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_chats_user_updated ON chats(user_id, updated_at);
            CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
            """
        )
        ensure_column(conn, "users", "role", "TEXT NOT NULL DEFAULT 'user'")
        ensure_column(conn, "users", "plan", "TEXT NOT NULL DEFAULT 'MONTH'")
        ensure_column(conn, "users", "subscription_until", "TEXT")
        ensure_column(conn, "users", "must_change_password", "INTEGER NOT NULL DEFAULT 0")
        ensure_column(conn, "users", "reset_token", "TEXT")
        ensure_column(conn, "users", "reset_token_expires_at", "TEXT")
        ensure_column(conn, "attachments", "file_path", "TEXT")
        conn.execute(
            "UPDATE users SET subscription_until = ? WHERE subscription_until IS NULL",
            ((datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),),
        )
        seed_app_settings(conn)
        seed_admin(conn)


@app.on_event("startup")
def startup() -> None:
    init_db()
    start_backup_scheduler()


def ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def seed_app_settings(conn: sqlite3.Connection) -> None:
    defaults = {
        "daily_message_limit": "30",
        "warning_after_messages": "25",
    }
    for key, value in defaults.items():
        conn.execute(
            "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",
            (key, value),
        )


def extension_from_filename(filename: str | None) -> str:
    if not filename or "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower().strip()


def validate_upload(filename: str | None, data: bytes) -> PreparedUpload:
    safe_name = Path(filename or "file").name
    extension = extension_from_filename(safe_name)
    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Формат файла `{safe_name}` не поддерживается. Можно загрузить: {allowed}.",
        )

    limit = FILE_LIMITS[extension]
    if len(data) > limit:
        limit_mb = limit // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"Файл `{safe_name}` слишком большой. Лимит для .{extension}: до {limit_mb} МБ.",
        )

    return PreparedUpload(
        filename=safe_name,
        extension=extension,
        mime_type=MIME_TYPES[extension],
        data=data,
    )


def save_upload_file(
    user_id: str,
    chat_id: str,
    message_id: str,
    attachment_id: str,
    extension: str,
    data: bytes,
) -> str:
    directory = UPLOADS_DIR / user_id / chat_id / message_id
    directory.mkdir(parents=True, exist_ok=True)
    file_path = directory / f"{attachment_id}.{extension}"
    file_path.write_bytes(data)
    return str(file_path.relative_to(BASE_DIR))


def add_duration(base: datetime, duration: str) -> datetime:
    days_by_duration = {
        "WEEK": 7,
        "MONTH": 30,
        "THREE_MONTHS": 90,
        "YEAR": 365,
    }
    return base + timedelta(days=days_by_duration.get(duration, 30))


def is_subscription_active(subscription_until: str | None) -> bool:
    if not subscription_until:
        return False
    try:
        until = datetime.fromisoformat(subscription_until)
    except ValueError:
        return False
    return until > datetime.now(timezone.utc)


def current_usage_date() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def get_admin_limits(conn: sqlite3.Connection) -> AdminLimits:
    seed_app_settings(conn)
    rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
    values = {row["key"]: row["value"] for row in rows}
    daily_limit = max(1, int(values.get("daily_message_limit", "30")))
    warning_after = int(values.get("warning_after_messages", "25"))
    warning_after = min(max(0, warning_after), daily_limit)
    return AdminLimits(dailyMessageLimit=daily_limit, warningAfterMessages=warning_after)


def get_message_usage(conn: sqlite3.Connection, user_id: str) -> MessageUsage:
    limits = get_admin_limits(conn)
    today = current_usage_date()
    row = conn.execute(
        "SELECT * FROM daily_message_usage WHERE user_id = ?",
        (user_id,),
    ).fetchone()

    if row is None:
        conn.execute(
            "INSERT INTO daily_message_usage (user_id, used_count, reset_date) VALUES (?, ?, ?)",
            (user_id, 0, today),
        )
        used = 0
    elif row["reset_date"] != today:
        conn.execute(
            "UPDATE daily_message_usage SET used_count = 0, reset_date = ? WHERE user_id = ?",
            (today, user_id),
        )
        used = 0
    else:
        used = int(row["used_count"])

    remaining = max(0, limits.daily_message_limit - used)
    show_warning = limits.warning_after_messages > 0 and used == limits.warning_after_messages and remaining > 0
    return MessageUsage(
        used=used,
        limit=limits.daily_message_limit,
        remaining=remaining,
        warningAfter=limits.warning_after_messages,
        showWarning=show_warning,
        resetDate=today,
    )


def ensure_message_limit_available(conn: sqlite3.Connection, user_id: str) -> MessageUsage:
    usage = get_message_usage(conn, user_id)
    if usage.remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail=f"Вы использовали все {usage.limit} сообщений на сегодня.\n\nЛимит автоматически обновится завтра.",
        )
    return usage


def increment_message_usage(conn: sqlite3.Connection, user_id: str) -> MessageUsage:
    today = current_usage_date()
    get_message_usage(conn, user_id)
    conn.execute(
        """
        UPDATE daily_message_usage
        SET used_count = used_count + 1, reset_date = ?
        WHERE user_id = ?
        """,
        (today, user_id),
    )
    return get_message_usage(conn, user_id)


def generate_temporary_password() -> str:
    return secrets.token_urlsafe(9)


def seed_admin(conn: sqlite3.Connection) -> None:
    admin_email = os.getenv("ADMIN_EMAIL", "admin@aitutorapp.com").lower().strip()
    admin_password = os.getenv("ADMIN_PASSWORD", "TutorAdmin!2026#Q7m9")
    admin_name = os.getenv("ADMIN_NAME", "Administrator")

    existing = conn.execute("SELECT id FROM users WHERE email = ?", (admin_email,)).fetchone()
    if existing:
        conn.execute("UPDATE users SET role = 'admin', must_change_password = 0 WHERE id = ?", (existing["id"],))
        return

    admin_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO users (
            id, email, name, avatar, password_hash, created_at, role, plan,
            subscription_until, must_change_password
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            admin_id,
            admin_email,
            admin_name,
            None,
            hash_password(admin_password),
            now_iso(),
            "admin",
            "ADMIN",
            add_duration(datetime.now(timezone.utc), "YEAR").isoformat(),
            0,
        ),
    )
    conn.execute("INSERT INTO user_settings (user_id) VALUES (?)", (admin_id,))


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, expected = stored.split("$", 1)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return hmac.compare_digest(digest.hex(), expected)


def settings_from_row(row: sqlite3.Row) -> UserSettings:
    return UserSettings(
        theme=row["theme"],
        language=row["language"],
        answerLength=row["answer_length"],
        simpleLanguage=bool(row["simple_language"]),
        moreExamples=bool(row["more_examples"]),
        morePractice=bool(row["more_practice"]),
        autoTitle=bool(row["auto_title"]),
    )


def get_user_settings(conn: sqlite3.Connection, user_id: str) -> UserSettings:
    row = conn.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    if row is None:
        conn.execute("INSERT INTO user_settings (user_id) VALUES (?)", (user_id,))
        row = conn.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
    return settings_from_row(row)


def user_from_row(conn: sqlite3.Connection, row: sqlite3.Row) -> UserPublic:
    subscription_until = row["subscription_until"] or now_iso()
    return UserPublic(
        id=row["id"],
        email=row["email"],
        name=row["name"],
        avatar=row["avatar"],
        role=row["role"],
        plan=row["plan"],
        subscriptionUntil=subscription_until,
        mustChangePassword=bool(row["must_change_password"]),
        subscriptionActive=is_subscription_active(subscription_until) or row["role"] == "admin",
        messageUsage=get_message_usage(conn, row["id"]),
        settings=get_user_settings(conn, row["id"]),
    )


def create_session(conn: sqlite3.Connection, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user_id, now_iso()),
    )
    return token


def get_current_user(authorization: str | None = Header(default=None)) -> UserPublic:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")

    token = authorization.removeprefix("Bearer ").strip()
    with connect_db() as conn:
        row = conn.execute(
            """
            SELECT users.*
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=401, detail="Invalid session")
        return user_from_row(conn, row)


def get_workspace_user(user: UserPublic = Depends(get_current_user)) -> UserPublic:
    if user.must_change_password:
        raise HTTPException(status_code=403, detail="Password change required")
    if not user.subscription_active:
        raise HTTPException(status_code=402, detail="Subscription expired")
    return user


def get_unlocked_user(user: UserPublic = Depends(get_current_user)) -> UserPublic:
    if user.must_change_password:
        raise HTTPException(status_code=403, detail="Password change required")
    return user


def get_admin_user(user: UserPublic = Depends(get_current_user)) -> UserPublic:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def admin_user_from_row(row: sqlite3.Row) -> AdminUser:
    return AdminUser(
        id=row["id"],
        email=row["email"],
        name=row["name"],
        role=row["role"],
        plan=row["plan"],
        subscriptionUntil=row["subscription_until"] or "",
        mustChangePassword=bool(row["must_change_password"]),
        createdAt=row["created_at"],
    )


def rows_to_attachments(rows: list[sqlite3.Row]) -> list[Attachment]:
    return [
        Attachment(
            id=row["id"],
            userId=row["user_id"],
            chatId=row["chat_id"],
            messageId=row["message_id"],
            name=row["name"],
            type=row["type"],
            size=row["size"],
            createdAt=row["created_at"],
            filePath=row["file_path"] if "file_path" in row.keys() else None,
        )
        for row in rows
    ]


def get_chat_with_messages(conn: sqlite3.Connection, chat_id: str, user_id: str) -> Chat:
    chat_row = conn.execute(
        "SELECT * FROM chats WHERE id = ? AND user_id = ?",
        (chat_id, user_id),
    ).fetchone()
    if chat_row is None:
        raise HTTPException(status_code=404, detail="Chat not found")

    message_rows = conn.execute(
        "SELECT * FROM messages WHERE chat_id = ? AND user_id = ? ORDER BY created_at ASC",
        (chat_id, user_id),
    ).fetchall()

    attachments_by_message: dict[str, list[Attachment]] = {}
    if message_rows:
        placeholders = ",".join("?" for _ in message_rows)
        attachment_rows = conn.execute(
            f"SELECT * FROM attachments WHERE message_id IN ({placeholders}) AND user_id = ?",
            [*[row["id"] for row in message_rows], user_id],
        ).fetchall()
        for attachment in rows_to_attachments(attachment_rows):
            attachments_by_message.setdefault(attachment.message_id, []).append(attachment)

    messages = [
        Message(
            id=row["id"],
            userId=row["user_id"],
            chatId=row["chat_id"],
            role=row["role"],
            content=row["content"],
            createdAt=row["created_at"],
            attachments=attachments_by_message.get(row["id"], []),
        )
        for row in message_rows
    ]

    return Chat(
        id=chat_row["id"],
        userId=chat_row["user_id"],
        title=chat_row["title"],
        createdAt=chat_row["created_at"],
        updatedAt=chat_row["updated_at"],
        messages=messages,
    )


def make_title(text: str, attachments: list[Attachment]) -> str:
    if text.strip():
        title = " ".join(text.strip().replace("\n", " ").split()[:4])
        return title[:36]
    if attachments:
        return attachments[0].name.rsplit(".", 1)[0][:36]
    return "Новый чат"


def format_settings(settings: UserSettings) -> str:
    length = {
        "short": "короткие ответы",
        "balanced": "сбалансированные ответы",
        "deep": "подробные ответы",
    }.get(settings.answer_length, "сбалансированные ответы")

    flags = [
        length,
        "простой язык" if settings.simple_language else "обычный уровень сложности",
        "больше примеров" if settings.more_examples else "без лишних примеров",
        "больше практических задач" if settings.more_practice else "практика только когда уместно",
    ]
    return "; ".join(flags)


def format_history(messages: list[Message]) -> str:
    lines: list[str] = []

    for message in messages[-14:]:
        if message.role == "assistant" and "Понял запрос:" in message.content:
            continue

        role = "Пользователь" if message.role == "user" else "AI Tutor"
        content = message.content.strip()
        if not content and message.attachments:
            content = "Прикрепил файл без текстового сообщения."

        if message.attachments:
            files = ", ".join(
                f"{item.name} ({item.type}, {item.size} байт)"
                for item in message.attachments
            )
            content = f"{content}\n[Вложения: {files}]".strip()

        if content:
            lines.append(f"{role}: {content}")

    return "\n\n".join(lines)


def generate_ai_answer(
    chat: Chat,
    user_message: Message,
    settings: UserSettings,
    uploads: list[PreparedUpload],
) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return (
            "Не вижу `GEMINI_API_KEY` в окружении, поэтому не могу обратиться к Gemini. "
            "Добавь ключ в `.env` и перезапусти backend."
        )

    prompt = f"""
Настройки пользователя:
{format_settings(settings)}

История только текущего чата:
{format_history([*chat.messages, user_message])}

Вложения последнего сообщения:
{", ".join(f"{item.filename} ({item.mime_type}, {len(item.data)} байт)" for item in uploads) or "нет"}

Если приложены изображения, анализируй содержимое самих изображений: текст, интерфейс, фото, схему или скриншот.
Если приложены документы, используй их как главный источник ответа.
Ответь на последнее сообщение пользователя как AI Tutor. Не используй историю других чатов.
""".strip()

    try:
        client = genai.Client(api_key=api_key)
        contents: list[types.Part] = [types.Part.from_text(text=prompt)]
        for upload in uploads:
            contents.append(types.Part.from_text(text=f"Файл: {upload.filename}"))
            contents.append(types.Part.from_bytes(data=upload.data, mime_type=upload.mime_type))

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.75,
                top_p=0.95,
            ),
        )
    except Exception as exc:
        return f"Не получилось получить ответ Gemini: {exc}"

    return (response.text or "").strip() or "Не получилось сформировать ответ. Попробуй переформулировать вопрос."


@app.post("/api/auth/register")
def register_disabled() -> None:
    raise HTTPException(status_code=403, detail="Self registration is disabled")


@app.post("/api/auth/login")
def login(payload: AuthRequest) -> AuthResponse:
    email = payload.email.lower().strip()
    with connect_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row is None or not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_session(conn, row["id"])
        return AuthResponse(token=token, user=user_from_row(conn, row))


@app.post("/api/auth/change-password")
def change_password(
    payload: ChangePasswordRequest,
    user: UserPublic = Depends(get_current_user),
) -> AuthResponse:
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must contain at least 8 characters")

    with connect_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user.id,)).fetchone()
        if row is None or not verify_password(payload.current_password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid current password")

        conn.execute(
            """
            UPDATE users
            SET password_hash = ?, must_change_password = 0, reset_token = NULL,
                reset_token_expires_at = NULL
            WHERE id = ?
            """,
            (hash_password(payload.new_password), user.id),
        )
        updated = conn.execute("SELECT * FROM users WHERE id = ?", (user.id,)).fetchone()
        return AuthResponse(token=create_session(conn, user.id), user=user_from_row(conn, updated))


@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest) -> PasswordResetResponse:
    email = payload.email.lower().strip()
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    with connect_db() as conn:
        row = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            conn.execute(
                "UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?",
                (token, expires_at, row["id"]),
            )

    # MVP: token is returned to the UI instead of sending email. Email provider can be added later.
    return PasswordResetResponse(ok=True, resetToken=token)


@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordRequest) -> dict[str, bool]:
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must contain at least 8 characters")

    with connect_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE reset_token = ?", (payload.token,)).fetchone()
        if row is None:
            raise HTTPException(status_code=400, detail="Invalid reset token")

        expires_at = row["reset_token_expires_at"]
        if not expires_at or datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Reset token expired")

        conn.execute(
            """
            UPDATE users
            SET password_hash = ?, must_change_password = 0, reset_token = NULL,
                reset_token_expires_at = NULL
            WHERE id = ?
            """,
            (hash_password(payload.new_password), row["id"]),
        )
        return {"ok": True}


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)) -> dict[str, bool]:
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        with connect_db() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    return {"ok": True}


@app.get("/api/me")
def me(user: UserPublic = Depends(get_current_user)) -> UserPublic:
    return user


@app.patch("/api/me/settings")
def update_settings(
    settings: UserSettings,
    user: UserPublic = Depends(get_unlocked_user),
) -> UserSettings:
    with connect_db() as conn:
        conn.execute(
            """
            UPDATE user_settings
            SET theme = ?, language = ?, answer_length = ?, simple_language = ?,
                more_examples = ?, more_practice = ?, auto_title = ?
            WHERE user_id = ?
            """,
            (
                settings.theme,
                settings.language,
                settings.answer_length,
                int(settings.simple_language),
                int(settings.more_examples),
                int(settings.more_practice),
                int(settings.auto_title),
                user.id,
            ),
        )
        return get_user_settings(conn, user.id)


@app.patch("/api/me/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    user: UserPublic = Depends(get_unlocked_user),
) -> UserPublic:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    avatar = payload.avatar.strip() if payload.avatar else None
    with connect_db() as conn:
        conn.execute(
            "UPDATE users SET name = ?, avatar = ? WHERE id = ?",
            (name, avatar, user.id),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user.id,)).fetchone()
        return user_from_row(conn, row)


@app.delete("/api/me/history")
def clear_history(user: UserPublic = Depends(get_unlocked_user)) -> dict[str, bool]:
    with connect_db() as conn:
        conn.execute("DELETE FROM chats WHERE user_id = ?", (user.id,))

    user_uploads = UPLOADS_DIR / user.id
    if user_uploads.exists():
        shutil.rmtree(user_uploads)

    return {"ok": True}


@app.get("/api/admin/users")
def admin_list_users(_: UserPublic = Depends(get_admin_user)) -> list[AdminUser]:
    with connect_db() as conn:
        rows = conn.execute(
            "SELECT * FROM users ORDER BY created_at DESC",
        ).fetchall()
        return [admin_user_from_row(row) for row in rows]


@app.get("/api/admin/limits")
def admin_get_limits(_: UserPublic = Depends(get_admin_user)) -> AdminLimits:
    with connect_db() as conn:
        return get_admin_limits(conn)


@app.patch("/api/admin/limits")
def admin_update_limits(
    payload: AdminLimitsRequest,
    _: UserPublic = Depends(get_admin_user),
) -> AdminLimits:
    if payload.daily_message_limit < 1:
        raise HTTPException(status_code=400, detail="Daily message limit must be at least 1")
    if payload.warning_after_messages < 0:
        raise HTTPException(status_code=400, detail="Warning threshold cannot be negative")
    if payload.warning_after_messages > payload.daily_message_limit:
        raise HTTPException(status_code=400, detail="Warning threshold cannot be greater than daily limit")

    with connect_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            ("daily_message_limit", str(payload.daily_message_limit)),
        )
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            ("warning_after_messages", str(payload.warning_after_messages)),
        )
        return get_admin_limits(conn)


@app.post("/api/admin/users")
def admin_create_user(
    payload: AdminCreateUserRequest,
    _: UserPublic = Depends(get_admin_user),
) -> AdminCreateUserResponse:
    email = payload.email.lower().strip()
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    temporary_password = generate_temporary_password()
    subscription_until = add_duration(datetime.now(timezone.utc), payload.subscription_duration).isoformat()
    user_id = str(uuid.uuid4())

    with connect_db() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        conn.execute(
            """
            INSERT INTO users (
                id, email, name, avatar, password_hash, created_at, role, plan,
                subscription_until, must_change_password
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                email,
                payload.name.strip(),
                None,
                hash_password(temporary_password),
                now_iso(),
                "user",
                payload.plan,
                subscription_until,
                1,
            ),
        )
        conn.execute("INSERT INTO user_settings (user_id) VALUES (?)", (user_id,))
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return AdminCreateUserResponse(user=admin_user_from_row(row), temporaryPassword=temporary_password)


@app.post("/api/admin/users/{user_id}/extend")
def admin_extend_subscription(
    user_id: str,
    payload: AdminExtendSubscriptionRequest,
    _: UserPublic = Depends(get_admin_user),
) -> AdminUser:
    with connect_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="User not found")

        current_until = row["subscription_until"]
        base = datetime.now(timezone.utc)
        if current_until and is_subscription_active(current_until):
            base = datetime.fromisoformat(current_until)

        conn.execute(
            "UPDATE users SET subscription_until = ? WHERE id = ?",
            (add_duration(base, payload.subscription_duration).isoformat(), user_id),
        )
        updated = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return admin_user_from_row(updated)


@app.get("/api/chats")
def list_chats(user: UserPublic = Depends(get_unlocked_user)) -> list[Chat]:
    with connect_db() as conn:
        chat_rows = conn.execute(
            "SELECT id FROM chats WHERE user_id = ? ORDER BY updated_at DESC",
            (user.id,),
        ).fetchall()
        return [get_chat_with_messages(conn, row["id"], user.id) for row in chat_rows]


@app.post("/api/chats")
def create_chat(user: UserPublic = Depends(get_workspace_user)) -> Chat:
    timestamp = now_iso()
    chat_id = str(uuid.uuid4())
    with connect_db() as conn:
        conn.execute(
            """
            INSERT INTO chats (id, user_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (chat_id, user.id, "Новый чат", timestamp, timestamp),
        )
        return get_chat_with_messages(conn, chat_id, user.id)


@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: str, user: UserPublic = Depends(get_unlocked_user)) -> Chat:
    with connect_db() as conn:
        return get_chat_with_messages(conn, chat_id, user.id)


@app.post("/api/chats/{chat_id}/messages")
async def send_message(
    chat_id: str,
    content: str = Form(""),
    files: list[UploadFile] = File(default=[]),
    user: UserPublic = Depends(get_workspace_user),
) -> Chat:
    timestamp = now_iso()
    prepared_uploads = [
        validate_upload(file.filename, await file.read())
        for file in files
    ]

    with connect_db() as conn:
        ensure_message_limit_available(conn, user.id)
        chat = get_chat_with_messages(conn, chat_id, user.id)
        user_message_id = str(uuid.uuid4())

        conn.execute(
            """
            INSERT INTO messages (id, user_id, chat_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_message_id, user.id, chat_id, "user", content.strip(), timestamp),
        )

        attachments: list[Attachment] = []
        for upload in prepared_uploads:
            attachment_id = str(uuid.uuid4())
            file_path = save_upload_file(
                user_id=user.id,
                chat_id=chat_id,
                message_id=user_message_id,
                attachment_id=attachment_id,
                extension=upload.extension,
                data=upload.data,
            )
            attachment = Attachment(
                id=attachment_id,
                userId=user.id,
                chatId=chat_id,
                messageId=user_message_id,
                name=upload.filename,
                type=upload.mime_type,
                size=len(upload.data),
                createdAt=timestamp,
                filePath=file_path,
            )
            attachments.append(attachment)
            conn.execute(
                """
                INSERT INTO attachments (id, user_id, chat_id, message_id, name, type, size, created_at, file_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    attachment.id,
                    user.id,
                    chat_id,
                    user_message_id,
                    attachment.name,
                    attachment.type,
                    attachment.size,
                    attachment.created_at,
                    attachment.file_path,
                ),
            )

        user_message = Message(
            id=user_message_id,
            userId=user.id,
            chatId=chat_id,
            role="user",
            content=content.strip(),
            createdAt=timestamp,
            attachments=attachments,
        )
        increment_message_usage(conn, user.id)

        assistant_text = generate_ai_answer(chat, user_message, user.settings, prepared_uploads)
        conn.execute(
            """
            INSERT INTO messages (id, user_id, chat_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), user.id, chat_id, "assistant", assistant_text, now_iso()),
        )

        if chat.title == "Новый чат" and user.settings.auto_title:
            conn.execute(
                "UPDATE chats SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?",
                (make_title(content, attachments), now_iso(), chat_id, user.id),
            )
        else:
            conn.execute(
                "UPDATE chats SET updated_at = ? WHERE id = ? AND user_id = ?",
                (now_iso(), chat_id, user.id),
            )

        return get_chat_with_messages(conn, chat_id, user.id)
