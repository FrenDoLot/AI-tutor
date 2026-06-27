import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Brush, Languages, MessageSquareText, Trash2 } from "lucide-react";
import { clearHistory, updateSettings } from "../lib/api";
import type { ReactNode } from "react";
import type { User, UserSettings } from "../types";

const themeOptions = [
  { value: "dark", label: "Тёмная тема" },
  { value: "light", label: "Светлая тема" },
  { value: "system", label: "Системная тема" }
];

const languageOptions = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" }
];

const answerLengthOptions = [
  { value: "short", label: "Кратко" },
  { value: "balanced", label: "Обычно" },
  { value: "deep", label: "Подробно" }
];

export function SettingsPage({
  user,
  onUserChange
}: {
  user: User;
  onUserChange: (user: User | null) => void;
}) {
  const [settings, setSettings] = useState<UserSettings>(user.settings);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const navigate = useNavigate();

  const canClear = useMemo(() => !clearing, [clearing]);

  const saveSettings = async (next: UserSettings) => {
    setSettings(next);
    setError("");
    setStatus("Сохранение...");
    try {
      const saved = await updateSettings(next);
      setSettings(saved);
      onUserChange({ ...user, settings: saved });
      setStatus("Сохранено");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить настройки");
      setStatus("");
    }
  };

  const setSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    saveSettings({ ...settings, [key]: value });
  };

  const removeHistory = async () => {
    if (!canClear) return;
    setClearing(true);
    setError("");
    try {
      await clearHistory();
      setConfirmOpen(false);
      navigate("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось очистить историю");
    } finally {
      setClearing(false);
    }
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
              <h1 className="truncate text-xl font-semibold sm:text-2xl">Настройки</h1>
              <p className="text-sm text-zinc-500">Параметры личного AI Tutor</p>
            </div>
          </div>
          {status && <span className="hidden text-sm text-zinc-500 sm:block">{status}</span>}
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <SettingsCard icon={<Brush size={18} />} title="Внешний вид">
            <SegmentedControl
              value={settings.theme}
              options={themeOptions}
              onChange={(value) => setSetting("theme", value)}
            />
          </SettingsCard>

          <SettingsCard icon={<Languages size={18} />} title="Язык интерфейса">
            <SegmentedControl
              value={settings.language}
              options={languageOptions}
              onChange={(value) => setSetting("language", value)}
            />
          </SettingsCard>

          <SettingsCard icon={<MessageSquareText size={18} />} title="Длина ответов AI">
            <SegmentedControl
              value={settings.answerLength}
              options={answerLengthOptions}
              onChange={(value) => setSetting("answerLength", value)}
            />
          </SettingsCard>

          <SettingsCard icon={<Trash2 size={18} />} title="Очистка истории">
            <p className="mb-4 text-sm leading-6 text-zinc-400">
              Будут удалены все ваши чаты, сообщения и названия чатов. Аккаунт, настройки и подписка сохранятся.
            </p>
            {!confirmOpen ? (
              <button className="danger-button" onClick={() => setConfirmOpen(true)}>
                Очистить всю историю
              </button>
            ) : (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  Подтвердите удаление всей истории. Это действие нельзя отменить.
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="danger-button w-auto px-5" disabled={clearing} onClick={removeHistory}>
                    {clearing ? "Удаление..." : "Удалить историю"}
                  </button>
                  <button className="quick-action" onClick={() => setConfirmOpen(false)}>
                    Отмена
                  </button>
                </div>
              </motion.div>
            )}
          </SettingsCard>
        </div>
      </div>
    </main>
  );
}

function SettingsCard({
  icon,
  title,
  children
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-2xl backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400/15 text-violet-100">
          {icon}
        </div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SegmentedControl({
  value,
  options,
  onChange
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => (
        <button
          key={option.value}
          className={`settings-option ${value === option.value ? "settings-option-active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
