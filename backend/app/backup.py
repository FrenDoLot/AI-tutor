from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import sqlite3
import subprocess
import tempfile
import threading
import time
import zipfile
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BASE_DIR.parent
load_dotenv(PROJECT_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
SQLITE_DB_FILE = DATA_DIR / "ai_tutor.sqlite3"
UPLOADS_DIR = DATA_DIR / "uploads"
BACKUP_DIR = Path(os.getenv("BACKUP_DIR", str(BASE_DIR / "backups"))).resolve()
BACKUP_LOG_FILE = DATA_DIR / "backup.log"
BACKUP_STATE_FILE = DATA_DIR / "backup_state.json"
BACKUP_LOCK_FILE = DATA_DIR / "backup.lock"

DAILY_RETENTION = int(os.getenv("BACKUP_DAILY_RETENTION", "7"))
WEEKLY_RETENTION = int(os.getenv("BACKUP_WEEKLY_RETENTION", "4"))
SCHEDULE_HOUR_UTC = int(os.getenv("BACKUP_SCHEDULE_HOUR_UTC", "2"))
SCHEDULER_INTERVAL_SECONDS = int(os.getenv("BACKUP_SCHEDULER_INTERVAL_SECONDS", "300"))


logger = logging.getLogger("ai_tutor.backup")


def configure_logging() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if logger.handlers:
        return

    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    file_handler = logging.FileHandler(BACKUP_LOG_FILE)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)


@contextmanager
def backup_lock():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(str(BACKUP_LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise RuntimeError("Backup is already running") from exc

    try:
        os.write(fd, str(os.getpid()).encode("utf-8"))
        os.close(fd)
        yield
    finally:
        try:
            BACKUP_LOCK_FILE.unlink()
        except FileNotFoundError:
            pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def archive_name(kind: str, created_at: datetime) -> str:
    timestamp = created_at.strftime("%Y%m%dT%H%M%SZ")
    return f"ai-tutor-{kind}-{timestamp}.zip"


def backup_kind_from_auto(now: datetime) -> str:
    return "daily"


def create_sqlite_snapshot(target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if not SQLITE_DB_FILE.exists():
        raise FileNotFoundError(f"SQLite database not found: {SQLITE_DB_FILE}")

    with sqlite3.connect(SQLITE_DB_FILE) as source:
        with sqlite3.connect(target) as destination:
            source.backup(destination)
            destination.execute("PRAGMA foreign_keys = OFF")
            destination.execute("DELETE FROM sessions")
            columns = {
                row[1]
                for row in destination.execute("PRAGMA table_info(users)").fetchall()
            }
            if {"reset_token", "reset_token_expires_at"}.issubset(columns):
                destination.execute(
                    "UPDATE users SET reset_token = NULL, reset_token_expires_at = NULL"
                )
            destination.commit()


def create_postgres_dump(target: Path) -> bool:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url.startswith(("postgres://", "postgresql://")):
        return False

    target.parent.mkdir(parents=True, exist_ok=True)
    command = os.getenv("BACKUP_PG_DUMP_COMMAND", "pg_dump")
    result = subprocess.run(
        [command, database_url, "--format=custom", f"--file={target}"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "pg_dump failed")
    return True


def write_manifest(target: Path, kind: str, created_at: datetime, db_engine: str) -> None:
    manifest = {
        "app": "AI Tutor",
        "kind": kind,
        "createdAt": created_at.isoformat(),
        "databaseEngine": db_engine,
        "includes": [
            "users",
            "profiles",
            "settings",
            "subscriptions",
            "chats",
            "messages",
            "attachments metadata",
            "uploaded files",
        ],
        "excludes": [
            "sessions",
            "reset tokens",
            "cache",
            "temporary files",
            "logs",
            "node_modules",
            "frontend dist",
        ],
    }
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def copy_uploads(target: Path) -> None:
    if not UPLOADS_DIR.exists():
        target.mkdir(parents=True, exist_ok=True)
        return
    shutil.copytree(UPLOADS_DIR, target)


def add_tree_to_zip(zip_file: zipfile.ZipFile, source: Path, arc_root: str) -> None:
    if not source.exists():
        return
    if source.is_file():
        zip_file.write(source, arc_root)
        return
    for path in source.rglob("*"):
        if path.is_file():
            zip_file.write(path, f"{arc_root}/{path.relative_to(source)}")


def build_archive(kind: str, created_at: datetime, output_file: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="ai-tutor-backup-") as temp_name:
        workspace = Path(temp_name)
        db_dir = workspace / "database"
        uploads_target = workspace / "uploads"
        metadata_dir = workspace / "metadata"
        metadata_dir.mkdir(parents=True, exist_ok=True)

        postgres_dump = db_dir / "postgres.dump"
        if create_postgres_dump(postgres_dump):
            db_engine = "postgresql"
        else:
            create_sqlite_snapshot(db_dir / "ai_tutor.sqlite3")
            db_engine = "sqlite"

        copy_uploads(uploads_target)
        legacy_chats = DATA_DIR / "chats.json"
        if legacy_chats.exists():
            shutil.copy2(legacy_chats, metadata_dir / "chats.json")

        write_manifest(metadata_dir / "manifest.json", kind, created_at, db_engine)

        output_file.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output_file, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            add_tree_to_zip(archive, db_dir, "database")
            add_tree_to_zip(archive, uploads_target, "uploads")
            add_tree_to_zip(archive, metadata_dir, "metadata")


def upload_to_remote(archive: Path) -> None:
    remote_dir = os.getenv("BACKUP_REMOTE_DIR", "").strip()
    remote_command = os.getenv("BACKUP_REMOTE_COMMAND", "").strip()

    if remote_dir:
        destination = Path(remote_dir).expanduser().resolve()
        destination.mkdir(parents=True, exist_ok=True)
        shutil.copy2(archive, destination / archive.name)

    if remote_command:
        command = remote_command.format(archive=str(archive), filename=archive.name)
        result = subprocess.run(
            command,
            shell=True,
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "Remote backup command failed")


def prune_backups(kind: str) -> None:
    retention = WEEKLY_RETENTION if kind == "weekly" else DAILY_RETENTION
    prune_backup_directory(BACKUP_DIR / kind, kind, retention)

    remote_dir = os.getenv("BACKUP_REMOTE_DIR", "").strip()
    if remote_dir:
        prune_backup_directory(Path(remote_dir).expanduser().resolve(), kind, retention)


def prune_backup_directory(kind_dir: Path, kind: str, retention: int) -> None:
    if not kind_dir.exists():
        return

    archives = sorted(
        kind_dir.glob(f"ai-tutor-{kind}-*.zip"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    for archive in archives[retention:]:
        archive.unlink()


def create_backup(kind: str = "auto") -> Path:
    configure_logging()
    started_at = utc_now()
    resolved_kind = backup_kind_from_auto(started_at) if kind == "auto" else kind
    if resolved_kind not in {"daily", "weekly", "pre-update"}:
        raise ValueError("Backup kind must be daily, weekly, pre-update, or auto")

    with backup_lock():
        output_file = BACKUP_DIR / resolved_kind / archive_name(resolved_kind, started_at)
        logger.info("Backup started: kind=%s file=%s", resolved_kind, output_file)
        build_archive(resolved_kind, started_at, output_file)
        upload_to_remote(output_file)
        if resolved_kind in {"daily", "weekly"}:
            prune_backups(resolved_kind)
        logger.info("Backup completed: kind=%s file=%s", resolved_kind, output_file)
        return output_file


def read_state() -> dict[str, str]:
    if not BACKUP_STATE_FILE.exists():
        return {}
    try:
        return json.loads(BACKUP_STATE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def write_state(state: dict[str, str]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def daily_backup_due(now: datetime) -> bool:
    state = read_state()
    last_run = state.get("lastDailyBackupAt")
    if last_run:
        try:
            last_run_at = datetime.fromisoformat(last_run)
            if now - last_run_at < timedelta(hours=23):
                return False
        except ValueError:
            pass
    return now.hour >= SCHEDULE_HOUR_UTC


def scheduler_loop() -> None:
    configure_logging()
    logger.info("Backup scheduler started")
    while True:
        try:
            now = utc_now()
            if daily_backup_due(now):
                archive = create_backup("auto")
                weekly_archive = None
                if now.weekday() == 0:
                    weekly_archive = create_backup("weekly")
                state = read_state()
                state["lastDailyBackupAt"] = now.isoformat()
                state["lastBackupFile"] = str(archive)
                if weekly_archive is not None:
                    state["lastWeeklyBackupFile"] = str(weekly_archive)
                write_state(state)
        except Exception as exc:
            logger.exception("Automatic backup failed: %s", exc)
        time.sleep(SCHEDULER_INTERVAL_SECONDS)


def start_backup_scheduler() -> None:
    if os.getenv("BACKUP_ENABLED", "1").strip().lower() in {"0", "false", "no"}:
        return
    thread = threading.Thread(target=scheduler_loop, name="ai-tutor-backup", daemon=True)
    thread.start()


def restore_backup(archive_file: Path, target_data_dir: Path = DATA_DIR) -> None:
    configure_logging()
    archive_file = archive_file.expanduser().resolve()
    if not archive_file.exists():
        raise FileNotFoundError(f"Backup archive not found: {archive_file}")

    with tempfile.TemporaryDirectory(prefix="ai-tutor-restore-") as temp_name:
        workspace = Path(temp_name)
        with zipfile.ZipFile(archive_file, "r") as archive:
            archive.extractall(workspace)

        db_file = workspace / "database" / "ai_tutor.sqlite3"
        postgres_dump = workspace / "database" / "postgres.dump"
        uploads = workspace / "uploads"
        target_data_dir.mkdir(parents=True, exist_ok=True)

        if db_file.exists():
            shutil.copy2(db_file, target_data_dir / "ai_tutor.sqlite3")
        elif postgres_dump.exists():
            database_url = os.getenv("DATABASE_URL", "").strip()
            if not database_url.startswith(("postgres://", "postgresql://")):
                raise RuntimeError("DATABASE_URL is required to restore PostgreSQL backups")
            command = os.getenv("BACKUP_PG_RESTORE_COMMAND", "pg_restore")
            result = subprocess.run(
                [command, "--clean", "--if-exists", "--dbname", database_url, str(postgres_dump)],
                check=False,
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip() or "pg_restore failed")
        else:
            raise RuntimeError("Backup archive does not contain a supported database dump")

        if uploads.exists():
            target_uploads = target_data_dir / "uploads"
            if target_uploads.exists():
                shutil.rmtree(target_uploads)
            shutil.copytree(uploads, target_uploads)

        legacy_chats = workspace / "metadata" / "chats.json"
        if legacy_chats.exists():
            shutil.copy2(legacy_chats, target_data_dir / "chats.json")

    logger.info("Backup restored from %s", archive_file)


def main() -> None:
    parser = argparse.ArgumentParser(description="AI Tutor backup utility")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create", help="Create a backup archive")
    create_parser.add_argument(
        "--kind",
        choices=["auto", "daily", "weekly", "pre-update"],
        default="auto",
    )

    restore_parser = subparsers.add_parser("restore", help="Restore a SQLite backup")
    restore_parser.add_argument("archive", type=Path)
    restore_parser.add_argument("--target-data-dir", type=Path, default=DATA_DIR)

    subparsers.add_parser("run-scheduler", help="Run the daily backup scheduler")

    args = parser.parse_args()
    if args.command == "create":
        print(create_backup(args.kind))
    elif args.command == "restore":
        restore_backup(args.archive, args.target_data_dir)
    elif args.command == "run-scheduler":
        scheduler_loop()


if __name__ == "__main__":
    main()
