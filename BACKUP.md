# AI Tutor Backup

Backups are created automatically by the FastAPI backend scheduler.

## What Is Included

- users, profiles, settings, subscriptions;
- chats, messages, chat titles;
- attachment metadata;
- uploaded files from `backend/data/uploads`;
- current SQLite database snapshot.

Temporary sessions, reset tokens, logs, cache, `node_modules`, and frontend build output are not included.

## Local Storage

Archives are written to:

```text
backend/backups/daily
backend/backups/weekly
backend/backups/pre-update
```

Retention:

- daily: last 7 archives;
- weekly: last 4 archives.

## Cloud Storage

Configure one of these environment variables in `.env`:

```env
BACKUP_REMOTE_DIR=/mnt/ai-tutor-backups
```

or:

```env
BACKUP_REMOTE_COMMAND=rclone copy {archive} remote:ai-tutor-backups
```

The backup system does not depend on a specific cloud provider. Replace the mounted directory or command when the storage provider changes.

## Manual Commands

```bash
npm run backup:daily
npm run backup:weekly
npm run backup:pre-update
python3 -m backend.app.backup restore backend/backups/daily/<archive>.zip
```

Before updating the project, run:

```bash
./scripts/pre_update_backup.sh
```

## PostgreSQL

The project currently uses SQLite. If `DATABASE_URL` starts with `postgres://` or `postgresql://`, the backup utility uses `pg_dump` and stores `database/postgres.dump` in the archive.
