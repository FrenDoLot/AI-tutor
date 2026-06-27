import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Lock, ShieldCheck } from "lucide-react";
import { changePassword, logoutUser } from "../lib/api";
import type { User } from "../types";

export function ChangePasswordPage({
  user,
  onUserChange
}: {
  user: User;
  onUserChange: (user: User | null) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const updated = await changePassword(currentPassword, newPassword);
      onUserChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сменить пароль");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await logoutUser();
    onUserChange(null);
  };

  return (
    <main className="grid h-dvh place-items-center overflow-y-auto bg-ink px-3 py-4 text-zinc-100 sm:px-4">
      <motion.form
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl backdrop-blur-xl sm:p-6"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-100">
            <ShieldCheck size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">Смените временный пароль</h1>
            <p className="truncate text-sm text-zinc-400">{user.email}</p>
          </div>
        </div>

        <label className="auth-field">
          <Lock size={18} />
          <input
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Временный пароль"
            type="password"
          />
        </label>
        <label className="auth-field">
          <Lock size={18} />
          <input
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Новый пароль"
            type="password"
          />
        </label>

        {error && <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

        <button className="new-chat-button h-12" disabled={loading}>
          {loading ? "Сохранение..." : "Сменить пароль"}
        </button>
        <button type="button" className="mt-3 w-full text-sm text-zinc-500 hover:text-zinc-200" onClick={logout}>
          Выйти
        </button>
      </motion.form>
    </main>
  );
}
