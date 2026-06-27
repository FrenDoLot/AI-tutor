import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      className="prose prose-invert max-w-none prose-p:leading-7 prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/35 prose-table:overflow-hidden"
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {content}
    </ReactMarkdown>
  );
}
