import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Clock, Menu, Search, Sparkles, X } from "lucide-react";
import { ChatInput } from "../components/ChatInput";
import { MessageBubble } from "../components/MessageBubble";
import { Sidebar } from "../components/Sidebar";
import { clearToken, createChat, getCurrentUser, getChats, logoutUser, sendMessage } from "../lib/api";
import type { Chat, Message, User } from "../types";

export function ChatPage({
  user,
  onUserChange
}: {
  user: User;
  onUserChange: (user: User | null) => void;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const [dailyLimitNotice, setDailyLimitNotice] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSearchMessageId, setSelectedSearchMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? chats[0],
    [activeChatId, chats]
  );
  const daysLeft = getSubscriptionDaysLeft(user.subscriptionUntil);
  const shouldShowRenewalNotice =
    user.subscriptionActive && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
  const trimmedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!activeChat || !trimmedSearchQuery) return [];

    return activeChat.messages
      .filter((message) => message.content.toLowerCase().includes(trimmedSearchQuery))
      .map((message) => ({
        message,
        snippet: makeSearchSnippet(message.content, trimmedSearchQuery)
      }));
  }, [activeChat, trimmedSearchQuery]);
  const searchMatchIds = useMemo(
    () => new Set(searchResults.map((result) => result.message.id)),
    [searchResults]
  );

  useEffect(() => {
    getChats()
      .then((items) => {
        setChats(items);
        setActiveChatId(items[0]?.id ?? null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Не удалось загрузить чаты");
        clearToken();
        onUserChange(null);
      });
  }, [onUserChange]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSelectedSearchMessageId(null);
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [activeChat?.id]);

  useEffect(() => {
    if (!isAtBottom) return;
    scrollToBottom("smooth");
  }, [activeChat?.messages.length, isThinking, isAtBottom]);

  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!dailyLimitNotice) return;
    const timeout = window.setTimeout(() => setDailyLimitNotice(""), 5200);
    return () => window.clearTimeout(timeout);
  }, [dailyLimitNotice]);

  const updateScrollState = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setIsAtBottom(distanceToBottom < 120);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({
      top: element.scrollHeight,
      behavior
    });
    setIsAtBottom(true);
  };

  const scrollToMessage = (messageId: string) => {
    setSelectedSearchMessageId(messageId);
    messageRefs.current[messageId]?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  };

  const upsertChat = (chat: Chat) => {
    setChats((items) => {
      const exists = items.some((item) => item.id === chat.id);
      const next = exists ? items.map((item) => (item.id === chat.id ? chat : item)) : [chat, ...items];
      return next.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    });
    setActiveChatId(chat.id);
  };

  const handleNewChat = async () => {
    if (!user.subscriptionActive) {
      setError("Подписка закончилась. Продлите доступ, чтобы создавать новые чаты.");
      return;
    }

    try {
      setError("");
      const chat = await createChat();
      upsertChat(chat);
      setMobileSidebar(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать чат");
    }
  };

  const handleSend = async (content: string, files: File[]) => {
    if (!user.subscriptionActive) {
      setError("Подписка закончилась. Отправка сообщений недоступна до продления.");
      return;
    }

    setError("");
    let chat = activeChat;

    try {
      if (!chat) {
        chat = await createChat();
        upsertChat(chat);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать чат");
      return;
    }

    const now = new Date().toISOString();
    const optimisticUserMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: now,
      attachments: files.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size
      }))
    };

    const optimisticChat: Chat = {
      ...chat,
      title: chat.title === "Новый чат" && content ? content.split(/\s+/).slice(0, 4).join(" ") : chat.title,
      updatedAt: now,
      messages: [...chat.messages, optimisticUserMessage]
    };

    upsertChat(optimisticChat);
    setIsThinking(true);

    try {
      const updated = await sendMessage(chat.id, content, files);
      upsertChat(updated);
      getCurrentUser()
        .then((updatedUser) => {
          onUserChange(updatedUser);
          if (updatedUser.messageUsage.showWarning) {
            setDailyLimitNotice(`Осталось ${updatedUser.messageUsage.remaining} сообщений на сегодня.`);
          }
        })
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить сообщение");
      getCurrentUser().then(onUserChange).catch(() => undefined);
      setChats((items) => items.map((item) => (item.id === chat.id ? chat : item)));
    } finally {
      setIsThinking(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    onUserChange(null);
  };

  const refreshSubscription = async () => {
    try {
      const updated = await getCurrentUser();
      onUserChange(updated);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить статус подписки");
    }
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-ink text-zinc-100">
      <Sidebar
        chats={chats}
        user={user}
        activeChatId={activeChat?.id ?? null}
        collapsed={collapsed}
        onCollapse={() => setCollapsed((value) => !value)}
        onNewChat={handleNewChat}
        onSelectChat={(id) => {
          setActiveChatId(id);
          setMobileSidebar(false);
        }}
        onSettings={() => navigate("/settings")}
        onProfile={() => navigate("/profile")}
        onLogout={handleLogout}
      />

      <AnimatePresence>
        {mobileSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileSidebar(false)}
          >
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              className="h-full w-[min(320px,calc(100vw-24px))]"
              onClick={(event) => event.stopPropagation()}
            >
              <Sidebar
                chats={chats}
                user={user}
                activeChatId={activeChat?.id ?? null}
                collapsed={false}
                mobile
                onCollapse={() => setMobileSidebar(false)}
                onNewChat={handleNewChat}
                onSelectChat={(id) => {
                  setActiveChatId(id);
                  setMobileSidebar(false);
                }}
                onSettings={() => {
                  setMobileSidebar(false);
                  navigate("/settings");
                }}
                onProfile={() => {
                  setMobileSidebar(false);
                  navigate("/profile");
                }}
                onLogout={handleLogout}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(132,92,255,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent_26%)]" />

        <header className="relative z-10 flex min-h-16 items-center justify-between gap-3 border-b border-line bg-ink/70 px-3 py-3 backdrop-blur-xl sm:px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button className="icon-button md:hidden" onClick={() => setMobileSidebar(true)}>
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-100">
                {activeChat?.title ?? "Новый чат"}
              </div>
              <div className="text-xs text-zinc-500">AI Tutor · учебный чат</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className={`icon-button w-10 px-0 sm:w-auto sm:gap-2 sm:px-3 ${searchOpen ? "border-violet-300/30 bg-violet-400/10 text-white" : ""}`}
              onClick={() => setSearchOpen((value) => !value)}
              aria-label="Поиск по текущему чату"
            >
              <Search size={16} />
              <span className="hidden text-sm sm:inline">Поиск</span>
            </button>
            <div className="status-pill">
              <Sparkles size={14} />
              {user.name}
            </div>
          </div>
        </header>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="relative z-20 mx-auto mt-3 w-full max-w-4xl px-4"
            >
              <div className="search-panel">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSelectedSearchMessageId(null);
                    }}
                    placeholder="Найти в текущем чате..."
                  />
                  {searchQuery && (
                    <button
                      className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedSearchMessageId(null);
                      }}
                      aria-label="Очистить поиск"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {trimmedSearchQuery && (
                  <div className="mt-2 max-h-56 overflow-y-auto">
                    {searchResults.length ? (
                      searchResults.map((result) => (
                        <button
                          key={result.message.id}
                          className="search-result"
                          onClick={() => scrollToMessage(result.message.id)}
                        >
                          <span className="text-xs font-medium text-violet-200">
                            {result.message.role === "user" ? "Вы" : "AI Tutor"}
                          </span>
                          <span className="truncate text-sm text-zinc-300">{result.snippet}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-zinc-500">Совпадений нет</div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="relative z-10 mx-auto mt-4 w-full max-w-4xl px-4">
            <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          </div>
        )}

        {shouldShowRenewalNotice && (
          <div className="relative z-10 mx-auto mt-4 w-full max-w-4xl px-4">
            <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              До окончания подписки осталось {daysLeft} дн. Продлите доступ заранее, чтобы не потерять возможность пользоваться AI Tutor без перерыва.
            </div>
          </div>
        )}

        <AnimatePresence>
          {dailyLimitNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="relative z-10 mx-auto mt-4 w-full max-w-4xl px-4"
            >
              <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <span>{dailyLimitNotice}</span>
                <button
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-amber-100/80 transition hover:bg-white/10 hover:text-amber-50"
                  onClick={() => setDailyLimitNotice("")}
                  aria-label="Закрыть уведомление"
                >
                  <X size={15} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section ref={scrollRef} onScroll={updateScrollState} className="relative z-10 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4 px-3 py-5 sm:gap-6 sm:px-4 sm:py-8 md:px-6">
            {activeChat?.messages.length ? (
              activeChat.messages.map((message, index) => (
                <div
                  key={message.id}
                  ref={(element) => {
                    messageRefs.current[message.id] = element;
                  }}
                  className="scroll-mt-24"
                >
                  <MessageBubble
                    message={message}
                    isLatestAssistant={
                      message.role === "assistant" &&
                      index === activeChat.messages.length - 1 &&
                      !isThinking
                    }
                    isSearchMatch={searchOpen && searchMatchIds.has(message.id)}
                    isSelectedSearchMatch={selectedSearchMessageId === message.id}
                  />
                </div>
              ))
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="empty-state">
                  <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-200">
                    <Sparkles size={22} />
                  </div>
                  <h1>AI Tutor</h1>
                  <p>Задай вопрос, отправь задачу или прикрепи материал для разбора.</p>
                </div>
              </div>
            )}

            {isThinking && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 sm:gap-3"
              >
                <div className="avatar avatar-ai">
                  <Sparkles size={18} />
                </div>
                <div className="thinking">
                  <span />
                  <span />
                  <span />
                </div>
              </motion.div>
            )}
          </div>
        </section>

        <AnimatePresence>
          {!isAtBottom && (
            <motion.button
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.94 }}
              className="scroll-bottom-button"
              onClick={() => scrollToBottom("smooth")}
              aria-label="Перейти к последнему сообщению"
            >
              <ArrowDown size={19} />
            </motion.button>
          )}
        </AnimatePresence>

        <div className="relative z-10 border-t border-line bg-ink/72 pt-3 backdrop-blur-xl sm:pt-4">
          {user.subscriptionActive && user.messageUsage.remaining > 0 ? (
            <ChatInput disabled={isThinking} onSend={handleSend} />
          ) : user.subscriptionActive ? (
            <DailyLimitInput usage={user.messageUsage} />
          ) : (
            <SubscriptionExpiredInput onRefresh={refreshSubscription} />
          )}
        </div>
      </main>
    </div>
  );
}

function DailyLimitInput({ usage }: { usage: User["messageUsage"] }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-4 sm:pb-4">
      <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
        <div className="font-semibold text-amber-100">Дневной лимит сообщений исчерпан</div>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-300">
          Вы использовали все {usage.limit} сообщений на сегодня.

          Лимит автоматически обновится завтра.
        </p>
      </div>
    </div>
  );
}

function makeSearchSnippet(content: string, query: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  const index = normalized.toLowerCase().indexOf(query);
  if (index === -1) return normalized.slice(0, 120);

  const start = Math.max(0, index - 42);
  const end = Math.min(normalized.length, index + query.length + 72);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";
  return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

function getSubscriptionDaysLeft(subscriptionUntil: string) {
  const until = new Date(subscriptionUntil).getTime();
  if (Number.isNaN(until)) return null;
  const diff = until - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function SubscriptionExpiredInput({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-4 sm:pb-4">
      <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
        <div className="mb-3 flex items-center gap-3 text-red-100">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-400/15">
            <Clock size={20} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold">Подписка закончилась</div>
            <div className="text-sm text-red-100/80">Срок действия вашей подписки истёк.</div>
          </div>
        </div>
        <p className="mb-4 text-sm leading-6 text-zinc-300">
          Продлите доступ, чтобы продолжить пользоваться AI Tutor.
        </p>
        <div className="flex flex-wrap gap-2">
          <a className="new-chat-button h-11 w-auto px-5" href="https://t.me/FrenDoLot" target="_blank" rel="noreferrer">
            Продлить доступ
          </a>
          <button className="quick-action" onClick={onRefresh}>
            Проверить доступ
          </button>
        </div>
      </div>
    </div>
  );
}
