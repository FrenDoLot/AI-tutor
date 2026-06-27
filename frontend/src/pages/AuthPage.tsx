import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Lock, Mail } from "lucide-react";
import { loginUser, requestPasswordReset, resetPassword } from "../lib/api";
import type { User } from "../types";

export function AuthPage({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      if (mode === "forgot") {
        const response = await requestPasswordReset(email);
        setResetToken(response.resetToken ?? "");
        setNotice(
          response.resetToken
            ? "MVP: токен восстановления показан здесь вместо email."
            : "Если email существует, ссылка для восстановления будет отправлена."
        );
        setMode("reset");
      } else if (mode === "reset") {
        await resetPassword(resetToken, password);
        setNotice("Пароль обновлён. Теперь можно войти.");
        setMode("login");
        setPassword("");
      } else {
        const user = await loginUser(email, password);
        onAuth(user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid h-dvh place-items-center overflow-y-auto bg-ink px-3 py-4 text-zinc-100 sm:px-4">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(132,92,255,0.22),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_30%)]" />

      <motion.form
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        onSubmit={submit}
        className="relative w-full max-w-[420px] rounded-2xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl backdrop-blur-xl sm:p-6"
      >
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-100">
            <GraduationCap size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">AI Tutor</h1>
            <p className="text-sm text-zinc-400">Личное учебное пространство</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            className={`auth-tab ${mode === "login" ? "auth-tab-active" : ""}`}
            onClick={() => setMode("login")}
          >
            Вход
          </button>
          <button
            type="button"
            className={`auth-tab ${mode !== "login" ? "auth-tab-active" : ""}`}
            onClick={() => setMode("forgot")}
          >
            Забыли пароль?
          </button>
        </div>

        {mode !== "reset" && (
          <label className="auth-field">
            <Mail size={18} />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              type="email"
              autoComplete="email"
            />
          </label>
        )}

        {mode === "reset" && (
          <label className="auth-field">
            <Lock size={18} />
            <input
              value={resetToken}
              onChange={(event) => setResetToken(event.target.value)}
              placeholder="Токен восстановления"
            />
          </label>
        )}

        {mode !== "forgot" && (
          <label className="auth-field">
            <Lock size={18} />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "reset" ? "Новый пароль" : "Пароль"}
              type="password"
              autoComplete={mode === "reset" ? "new-password" : "current-password"}
            />
          </label>
        )}

        {error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
        {notice && <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>}

        {resetToken && mode === "reset" && (
          <div className="mb-4 break-all rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-300">
            Токен: {resetToken}
          </div>
        )}

        <button className="new-chat-button h-12" disabled={loading}>
          {loading
            ? "Проверка..."
            : mode === "forgot"
              ? "Получить ссылку"
              : mode === "reset"
                ? "Сменить пароль"
                : "Войти"}
        </button>
      </motion.form>
    </main>
  );
}
