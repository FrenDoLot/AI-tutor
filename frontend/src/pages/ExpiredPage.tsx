import { motion } from "framer-motion";
import { Clock, LogOut } from "lucide-react";
import { logoutUser } from "../lib/api";
import type { User } from "../types";

export function ExpiredPage({
  user,
  onUserChange
}: {
  user: User;
  onUserChange: (user: User | null) => void;
}) {
  const logout = async () => {
    await logoutUser();
    onUserChange(null);
  };

  return (
    <main className="grid h-dvh place-items-center overflow-y-auto bg-ink px-3 py-4 text-zinc-100 sm:px-4">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-white/[0.055] p-5 text-center shadow-2xl backdrop-blur-xl sm:p-6"
      >
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 text-red-100">
          <Clock size={26} />
        </div>
        <h1 className="text-xl font-semibold">Срок действия подписки закончился.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Аккаунт <span className="break-all">{user.email}</span> сохранён. Чаты, сообщения, настройки и профиль не удаляются.
        </p>
        <a className="new-chat-button mt-6 h-12" href="https://t.me/FrenDoLot" target="_blank" rel="noreferrer">
          Связаться с администратором
        </a>
        <button className="mt-3 inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200" onClick={logout}>
          <LogOut size={16} />
          Выйти
        </button>
      </motion.div>
    </main>
  );
}
