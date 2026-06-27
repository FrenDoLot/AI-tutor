import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Paperclip, SendHorizontal, X } from "lucide-react";

const quickActions = [
  "📘 ЕГЭ",
  "📙 ОГЭ",
  "🧮 Математика",
  "⚛ Физика",
  "📜 История",
  "💻 Программирование",
  "🇬🇧 Английский",
  "🧪 Химия",
  "🧬 Биология",
  "🌍 География"
];

const fileLimits: Record<string, number> = {
  pdf: 20 * 1024 * 1024,
  docx: 20 * 1024 * 1024,
  pptx: 20 * 1024 * 1024,
  txt: 5 * 1024 * 1024,
  png: 15 * 1024 * 1024,
  jpg: 15 * 1024 * 1024,
  jpeg: 15 * 1024 * 1024
};

const allowedExtensions = Object.keys(fileLimits);

type ChatInputProps = {
  disabled: boolean;
  onSend: (message: string, files: File[]) => void;
};

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = (message = value, payloadFiles = files) => {
    if (!message.trim() && payloadFiles.length === 0) return;
    setFileError("");
    onSend(message.trim(), payloadFiles);
    setValue("");
    setFiles([]);
    if (inputRef.current) {
      inputRef.current.style.height = window.innerWidth < 640 ? "52px" : "58px";
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const resize = () => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = window.innerWidth < 640 ? "52px" : "58px";
    element.style.height = `${Math.min(element.scrollHeight, 190)}px`;
  };

  const validateFiles = (items: File[]) => {
    for (const file of items) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!allowedExtensions.includes(extension)) {
        return `Формат файла "${file.name}" не поддерживается. Можно загрузить: ${allowedExtensions.join(", ")}.`;
      }

      const limit = fileLimits[extension];
      if (file.size > limit) {
        return `Файл "${file.name}" слишком большой. Лимит для .${extension}: до ${Math.round(limit / 1024 / 1024)} МБ.`;
      }
    }

    return "";
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-4 sm:pb-4">
      <form onSubmit={handleSubmit} className="input-shell">
        {!!files.length && (
          <div className="mb-3 flex flex-wrap gap-2">
            {files.map((file) => (
              <span key={file.name} className="attachment-chip">
                <span className="min-w-0 truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label="Убрать файл"
                  onClick={() => setFiles((items) => items.filter((item) => item !== file))}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}

        {fileError && (
          <div className="mb-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {fileError}
          </div>
        )}

        <div className="flex items-end gap-2 sm:gap-3">
          <label className="icon-button cursor-pointer" title="Прикрепить файл">
            <Paperclip size={19} />
            <input
              className="hidden"
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                const error = validateFiles(selected);
                if (error) {
                  setFileError(error);
                  event.target.value = "";
                  return;
                }

                setFileError("");
                setFiles(selected);
                if (selected.length) {
                  submit(value.trim() || "Проанализируй прикрепленный материал.", selected);
                }
                event.target.value = "";
              }}
            />
          </label>

          <textarea
            ref={inputRef}
            value={value}
            rows={1}
            onInput={resize}
            onKeyDown={handleKeyDown}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Спроси тему, отправь задачу или прикрепи материал..."
            className="min-h-[52px] flex-1 resize-none bg-transparent py-3.5 text-[14px] leading-6 text-zinc-100 outline-none placeholder:text-zinc-500 sm:min-h-[58px] sm:py-4 sm:text-[15px]"
          />

          <button className="send-button" disabled={disabled} aria-label="Отправить">
            <SendHorizontal size={19} />
          </button>
        </div>
      </form>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 sm:mt-3">
        {quickActions.map((action) => (
          <motion.button
            key={action}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="quick-action"
            onClick={() => submit(`Помоги подготовиться: ${action.replace(/^\S+\s/, "")}`, [])}
          >
            {action}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
