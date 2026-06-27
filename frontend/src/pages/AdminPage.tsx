import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, MessageSquare, Plus, RefreshCw } from "lucide-react";
import {
  adminCreateUser,
  adminExtendSubscription,
  getAdminLimits,
  getAdminUsers,
  logoutUser,
  updateAdminLimits
} from "../lib/api";
import type { AdminCreateUserResponse, AdminLimits, AdminUser, User } from "../types";

const durationOptions = [
  { value: "WEEK", label: "1 неделя" },
  { value: "MONTH", label: "1 месяц" },
  { value: "THREE_MONTHS", label: "3 месяца" },
  { value: "YEAR", label: "1 год" }
];

export function AdminPage({
  user,
  onUserChange
}: {
  user: User;
  onUserChange: (user: User | null) => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("MONTH");
  const [duration, setDuration] = useState("MONTH");
  const [created, setCreated] = useState<AdminCreateUserResponse | null>(null);
  const [limits, setLimits] = useState<AdminLimits | null>(null);
  const [dailyMessageLimit, setDailyMessageLimit] = useState(30);
  const [warningAfterMessages, setWarningAfterMessages] = useState(25);
  const [limitsStatus, setLimitsStatus] = useState("");
  const [error, setError] = useState("");

  const loadUsers = () => {
    getAdminUsers().then(setUsers).catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки"));
  };

  useEffect(loadUsers, []);

  useEffect(() => {
    getAdminLimits()
      .then((response) => {
        setLimits(response);
        setDailyMessageLimit(response.dailyMessageLimit);
        setWarningAfterMessages(response.warningAfterMessages);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки лимитов"));
  }, []);

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setCreated(null);

    try {
      const response = await adminCreateUser(name, email, plan, duration);
      setCreated(response);
      setName("");
      setEmail("");
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать пользователя");
    }
  };

  const extend = async (userId: string, subscriptionDuration: string) => {
    setError("");
    try {
      const updated = await adminExtendSubscription(userId, subscriptionDuration);
      setUsers((items) => items.map((item) => (item.id === userId ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось продлить подписку");
    }
  };

  const saveLimits = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLimitsStatus("");
    try {
      const updated = await updateAdminLimits(dailyMessageLimit, warningAfterMessages);
      setLimits(updated);
      setDailyMessageLimit(updated.dailyMessageLimit);
      setWarningAfterMessages(updated.warningAfterMessages);
      setLimitsStatus("Лимиты сохранены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить лимиты");
    }
  };

  const logout = async () => {
    await logoutUser();
    onUserChange(null);
  };

  return (
    <main className="h-dvh overflow-y-auto bg-ink px-3 py-4 text-zinc-100 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">Админ-панель</h1>
            <p className="truncate text-sm text-zinc-500">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <Link className="icon-button w-auto px-3" to="/chat">
              <MessageSquare size={18} />
              <span className="hidden sm:inline">Чат</span>
            </Link>
            <button className="icon-button w-auto px-3" onClick={logout}>
              <LogOut size={18} />
              <span className="hidden sm:inline">Выход</span>
            </button>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
          <div className="space-y-5">
            <motion.form
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={createUser}
              className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl backdrop-blur-xl sm:p-5"
            >
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <Plus size={18} />
                Новый пользователь
              </h2>
              <label className="auth-field">
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Имя пользователя" />
              </label>
              <label className="auth-field">
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
              </label>
              <label className="auth-field">
                <input value={plan} onChange={(event) => setPlan(event.target.value)} placeholder="Тариф" />
              </label>
              <select className="select-field" value={duration} onChange={(event) => setDuration(event.target.value)}>
                {durationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
              {created && (
                <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  <div className="break-all">Email: {created.user.email}</div>
                  <div className="break-all">Временный пароль: {created.temporaryPassword}</div>
                </div>
              )}
              <button className="new-chat-button h-12">Создать аккаунт</button>
            </motion.form>

            <motion.form
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={saveLimits}
              className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-2xl backdrop-blur-xl sm:p-5"
            >
              <h2 className="mb-4 flex items-center gap-2 font-semibold">
                <MessageSquare size={18} />
                Лимиты сообщений
              </h2>
              <label className="profile-label">Дневной лимит</label>
              <label className="auth-field">
                <input
                  value={dailyMessageLimit}
                  onChange={(event) => setDailyMessageLimit(Number(event.target.value))}
                  min={1}
                  type="number"
                />
              </label>
              <label className="profile-label">Предупреждать после</label>
              <label className="auth-field">
                <input
                  value={warningAfterMessages}
                  onChange={(event) => setWarningAfterMessages(Number(event.target.value))}
                  min={0}
                  type="number"
                />
              </label>
              {limits && (
                <p className="mb-4 text-sm text-zinc-500">
                  Сейчас: {limits.warningAfterMessages} / {limits.dailyMessageLimit}
                </p>
              )}
              {limitsStatus && (
                <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {limitsStatus}
                </div>
              )}
              <button className="new-chat-button h-12">Сохранить лимиты</button>
            </motion.form>
          </div>

          <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl backdrop-blur-xl sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Пользователи</h2>
              <button className="icon-button" onClick={loadUsers}>
                <RefreshCw size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {users.map((item) => (
                <div key={item.id} className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{item.name}</div>
                      <div className="break-all text-sm text-zinc-500">{item.email}</div>
                    </div>
                    <div className="text-right text-sm text-zinc-400">
                      <div>{item.role}</div>
                      <div>{item.plan}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-zinc-400">
                    Подписка до: {new Date(item.subscriptionUntil).toLocaleDateString("ru-RU")}
                    {item.mustChangePassword ? " · временный пароль" : ""}
                  </div>
                  {item.role !== "admin" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {durationOptions.map((option) => (
                        <button key={option.value} className="quick-action" onClick={() => extend(item.id, option.value)}>
                          + {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
