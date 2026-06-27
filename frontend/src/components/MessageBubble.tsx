import { motion } from "framer-motion";
import { Bot, FileText, UserRound } from "lucide-react";
import type { Message } from "../types";
import { TypingText } from "./TypingText";

export function MessageBubble({
  message,
  isLatestAssistant,
  isSearchMatch = false,
  isSelectedSearchMatch = false
}: {
  message: Message;
  isLatestAssistant: boolean;
  isSearchMatch?: boolean;
  isSelectedSearchMatch?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && <Avatar kind="assistant" />}
      <div
        className={`message-bubble ${isUser ? "message-user" : "message-ai"} ${
          isSearchMatch ? "message-search-match" : ""
        } ${isSelectedSearchMatch ? "message-search-selected" : ""}`}
      >
        {!!message.attachments?.length && (
          <div className="mb-3 flex flex-wrap gap-2">
            {message.attachments.map((file) => (
              <span key={file.name} className="attachment-chip">
                <FileText size={14} />
                <span className="min-w-0 truncate">{file.name}</span>
              </span>
            ))}
          </div>
        )}
        <TypingText text={message.content} enabled={!isUser && isLatestAssistant} />
      </div>
      {isUser && <Avatar kind="user" />}
    </motion.div>
  );
}

function Avatar({ kind }: { kind: "assistant" | "user" }) {
  return (
    <div className={`avatar ${kind === "assistant" ? "avatar-ai" : "avatar-user"}`}>
      {kind === "assistant" ? <Bot size={18} /> : <UserRound size={18} />}
    </div>
  );
}
