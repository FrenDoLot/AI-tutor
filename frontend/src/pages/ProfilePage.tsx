import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarClock, LogOut, Lock, MessageSquare, Save, UserRound } from "lucide-react";
import { changePassword, logoutUser, updateProfile } from "../lib/api";
import type { User } from "../types";

export function ProfilePage({
  user,
  onUserChange
}: {
  user: User;
  onUserChange: (user: User | null) => void;
}) {
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar ?? "");
  const [profileStatus, setProfileStatus] = useState("");
  const [profileError, setProfileError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const daysLeft = useMemo(() => getSubscriptionDaysLeft(user.subscriptionUntil), [user.subscriptionUntil]);
  const subscriptionDate = useMemo(
    () => new Date(user.subscriptionUntil).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }),
    [user.subscriptionUntil]
  );

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setProfileError("");
    setProfileStatus("");
    setSavingProfile(true);
    try {
      const updated = await updateProfile(name, avatar.trim() || null);
      onUserChange(updated);
      setProfileStatus("Сохранено");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Не удалось сохранить профиль");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordStatus("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Новый пароль и подтверждение не совпадают");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Новый пароль должен содержать минимум 8 символов");
      return;
    }

    setSavingPassword(true);
    try {
      const updated = await changePassword(currentPassword, newPassword);
      onUserChange(updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("Пароль изменён");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Не удалось изменить пароль");
    } finally {
      setSavingPassword(false);
    }
  };

  const logout = async () => {
    await logoutUser();
    onUserChange(null);
  };

  return (
    <main className="h-dvh overflow-y-auto bg-ink px-3 py-4 text-zinc-100 sm:px-4 sm:py-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link className="icon-button" to="/chat" aria-label="Назад в чат">
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold sm:text-2xl">Профиль</h1>
              <p className="truncate text-sm text-zinc-500">{user.email}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <section className="profile-card">
              <div className="mb-5 flex items-center gap-4">
                <AvatarPreview name={name} avatar={avatar} />
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">Личная информация</h2>
                  <p className="text-sm text-zinc-500">Имя и аватар пользователя</p>
                </div>
              </div>

              <form onSubmit={saveProfile}>
                <label className="profile-label">Имя пользователя</label>
                <label className="auth-field">
                  <UserRound size={18} />
                  <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>

                <label className="profile-label">Email</label>
                <div className="mb-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">
                  {user.email}
                </div>

                <label className="profile-label">Аватар</label>
                <label className="auth-field">
                  <UserRound size={18} />
                  <input
                    value={avatar}
                    onChange={(event) => setAvatar(event.target.value)}
                    placeholder="Ссылка на изображение или оставьте пустым"
                  />
                </label>

                {profileError && <Notice kind="error" text={profileError} />}
                {profileStatus && <Notice kind="success" text={profileStatus} />}

                <button className="new-chat-button h-12" disabled={savingProfile}>
                  <Save size={18} />
                  {savingProfile ? "Сохранение..." : "Сохранить профиль"}
                </button>
              </form>
            </section>

            <section className="profile-card">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-400/15 text-violet-100">
                  <Lock size={18} />
                </div>
                <div>
                  <h2 className="font-semibold">Безопасность</h2>
                  <p className="text-sm text-zinc-500">Изменение пароля</p>
                </div>
              </div>

              <form onSubmit={savePassword}>
                <label className="auth-field">
                  <Lock size={18} />
                  <input
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="Текущий пароль"
                    type="password"
                    autoComplete="current-password"
                  />
                </label>
                <label className="auth-field">
                  <Lock size={18} />
                  <input
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Новый пароль"
                    type="password"
                    autoComplete="new-password"
                  />
                </label>
                <label className="auth-field">
                  <Lock size={18} />
                  <input
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Подтвердите новый пароль"
                    type="password"
                    autoComplete="new-password"
                  />
                </label>

                {passwordError && <Notice kind="error" text={passwordError} />}
                {passwordStatus && <Notice kind="success" text={passwordStatus} />}

                <button className="new-chat-button h-12" disabled={savingPassword}>
                  {savingPassword ? "Сохранение..." : "Изменить пароль"}
                </button>
              </form>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="profile-card">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-100">
                  <CalendarClock size={18} />
                </div>
                <h2 className="font-semibold">Подписка</h2>
              </div>
              <dl className="space-y-3 text-sm">
                <InfoRow label="Статус" value={user.subscriptionActive ? "Активна" : "Закончилась"} />
                <InfoRow label="Действует до" value={subscriptionDate} />
                <InfoRow label="Осталось" value={daysLeft > 0 ? `${daysLeft} дн.` : "0 дн."} />
              </dl>
            </section>

            <section className="profile-card">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-400/15 text-violet-100">
                  <MessageSquare size={18} />
                </div>
                <h2 className="font-semibold">Лимит сообщений</h2>
              </div>
              <InfoRow
                label="Сообщений сегодня"
                value={`${user.messageUsage.used} / ${user.messageUsage.limit}`}
              />
            </section>

            <section className="profile-card">
              <button className="danger-button" onClick={logout}>
                <LogOut size={18} />
                Выйти из аккаунта
              </button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function AvatarPreview({ name, avatar }: { name: string; avatar: string }) {
  const initial = (name || "A").slice(0, 1).toUpperCase();
  return (
    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-violet-300/20 bg-violet-400/15 text-xl font-semibold text-violet-100">
      {avatar ? (
        <img className="h-full w-full object-cover" src={avatar} alt="" onError={(event) => {
          event.currentTarget.style.display = "none";
        }} />
      ) : (
        initial
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-100">{value}</dd>
    </div>
  );
}

function Notice({ kind, text }: { kind: "error" | "success"; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        kind === "error"
          ? "border-red-400/20 bg-red-500/10 text-red-100"
          : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      }`}
    >
      {text}
    </motion.div>
  );
}

function getSubscriptionDaysLeft(subscriptionUntil: string) {
  const until = new Date(subscriptionUntil).getTime();
  if (Number.isNaN(until)) return 0;
  const diff = until - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
