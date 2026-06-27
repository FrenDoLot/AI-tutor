import { AnimatePresence, motion } from "framer-motion";
import {
  LogOut,
  Menu,
  MessageSquarePlus,
  PanelLeftClose,
  Settings,
  UserRound
} from "lucide-react";
import type { ReactNode } from "react";
import type { Chat, User } from "../types";

type SidebarProps = {
  chats: Chat[];
  user: User;
  activeChatId: string | null;
  collapsed: boolean;
  mobile?: boolean;
  onCollapse: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onSettings: () => void;
  onProfile: () => void;
  onLogout: () => void;
};

const defaultIcons = ["📘", "📄", "💻", "📐", "🧮", "⚛"];

export function Sidebar({
  chats,
  user,
  activeChatId,
  collapsed,
  mobile = false,
  onCollapse,
  onNewChat,
  onSelectChat,
  onSettings,
  onProfile,
  onLogout
}: SidebarProps) {
  return (
    <motion.aside
      animate={{ width: mobile ? "100%" : collapsed ? 76 : 300 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`${mobile ? "flex" : "hidden md:flex"} h-dvh min-w-0 shrink-0 flex-col border-r border-line bg-white/[0.035] backdrop-blur-xl`}
    >
      <div className="flex h-16 items-center gap-3 border-b border-line px-4">
        <button className="icon-button" onClick={onCollapse} aria-label="Свернуть панель">
          {collapsed ? <Menu size={19} /> : <PanelLeftClose size={19} />}
        </button>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="min-w-0 truncate font-semibold tracking-normal text-zinc-100"
            >
              AI Tutor
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-3">
        <button className="new-chat-button min-w-0" onClick={onNewChat}>
          <MessageSquarePlus size={18} />
          {!collapsed && <span>Новый чат</span>}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {chats.map((chat, index) => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`chat-row ${chat.id === activeChatId ? "chat-row-active" : ""}`}
            title={chat.title}
          >
            {chat.title !== "Новый чат" && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-sm">
                {defaultIcons[index % defaultIcons.length]}
              </span>
            )}
            {!collapsed && <span className="min-w-0 truncate">{chat.title}</span>}
          </button>
        ))}
      </nav>

      <div className="space-y-1 border-t border-line p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-400/15 text-sm font-semibold text-violet-100">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-zinc-100">{user.name}</div>
              <div className="truncate text-xs text-zinc-500">{user.email}</div>
            </div>
          )}
        </div>
        <FooterAction collapsed={collapsed} icon={<Settings size={18} />} label="Настройки" onClick={onSettings} />
        <FooterAction collapsed={collapsed} icon={<UserRound size={18} />} label="Профиль" onClick={onProfile} />
        <FooterAction collapsed={collapsed} icon={<LogOut size={18} />} label="Выход" onClick={onLogout} />
      </div>
    </motion.aside>
  );
}

function FooterAction({
  collapsed,
  icon,
  label,
  onClick
}: {
  collapsed: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button className="chat-row" title={label} onClick={onClick}>
      <span className="grid h-8 w-8 shrink-0 place-items-center">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
