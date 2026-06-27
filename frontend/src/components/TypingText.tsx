import { useEffect, useState } from "react";
import { MarkdownMessage } from "./MarkdownMessage";

export function TypingText({ text, enabled }: { text: string; enabled: boolean }) {
  const [visible, setVisible] = useState(enabled ? "" : text);

  useEffect(() => {
    if (!enabled) {
      setVisible(text);
      return;
    }

    setVisible("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += Math.max(1, Math.round(text.length / 180));
      setVisible(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 14);

    return () => window.clearInterval(timer);
  }, [enabled, text]);

  return <MarkdownMessage content={visible} />;
}
