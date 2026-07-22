"use client";

import {
  ArrowLeft,
  FileSearch,
  Lightbulb,
  ListChecks,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// ── Types ──────────────────────────────────────────────────────────────────
export interface FileQaSuggestion {
  label: string;
  icon: "search" | "summary" | "ideas";
  prompt: string;
}

export interface FileQaMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  references?: FileQaReference[];
}

export interface FileQaReference {
  id: string;
  title: string;
  subtitle: string;
  icon: "file" | "list" | "package";
}

export interface FileQaAssistantProps {
  /** 欢迎区域的标题 */
  title?: string;
  /** 欢迎区域的描述 */
  description?: string;
  /** 顶部三个快捷卡片配置 */
  suggestions?: FileQaSuggestion[];
  /** 初始对话消息 */
  initialMessages?: FileQaMessage[];
  /** 发送消息时的回调 */
  onSend?: (text: string) => void | Promise<void>;
  /** 返回上一级的回调 */
  onBack?: () => void;
  /** 是否显示返回按钮 */
  showBack?: boolean;
  /** 项目筛选上下文 */
  projectContext?: { project: string; business: string };
  /** 外部控制是否进入聊天状态 */
  chatOpen?: boolean;
  /** 聊天状态变化回调 */
  onChatOpenChange?: (open: boolean) => void;
}

// ── Default suggestions ────────────────────────────────────────────────────
const defaultSuggestions: FileQaSuggestion[] = [
  {
    label: "搜索文件内容",
    icon: "search",
    prompt: "帮我搜索与当前项目相关的所有文件内容",
  },
  {
    label: "总结关键结论",
    icon: "summary",
    prompt: "总结当前项目的关键结论和发现",
  },
  {
    label: "拓展思路方向",
    icon: "ideas",
    prompt: "基于项目资料，帮我拓展下一步工作思路",
  },
];

// ── Icon mapping ───────────────────────────────────────────────────────────
function SuggestionIcon({
  type,
  size = 20,
}: {
  type: FileQaSuggestion["icon"];
  size?: number;
}) {
  switch (type) {
    case "search":
      return <FileSearch size={size} />;
    case "summary":
      return <ListChecks size={size} />;
    case "ideas":
      return <Lightbulb size={size} />;
    default:
      return <Sparkles size={size} />;
  }
}

// ── Component ──────────────────────────────────────────────────────────────
export function FileQaAssistant({
  title = "文件问答助手",
  description = "基于项目文件与资料，我可以帮你搜索、总结和拓展思路。",
  suggestions = defaultSuggestions,
  initialMessages = [],
  onSend,
  onBack,
  showBack = false,
  projectContext,
  chatOpen: controlledChatOpen,
  onChatOpenChange,
}: FileQaAssistantProps) {
  // Internal state
  const [internalChatOpen, setInternalChatOpen] = useState(false);
  const chatOpen = controlledChatOpen ?? internalChatOpen;
  const setChatOpen = useCallback(
    (value: boolean) => {
      if (controlledChatOpen === undefined) {
        setInternalChatOpen(value);
      }
      onChatOpenChange?.(value);
    },
    [controlledChatOpen, onChatOpenChange]
  );

  const [messages, setMessages] = useState<FileQaMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatOpen]);

  const handleSend = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || thinking) return;

      const userMessage: FileQaMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        text: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setText("");
      setThinking(true);

      // Call external handler
      if (onSend) {
        try {
          await onSend(trimmed);
        } catch {
          // ignore
        }
      }

      // Simulate assistant response (mock)
      window.setTimeout(() => {
        const assistantMessage: FileQaMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          text: `我已结合${projectContext?.project ?? "项目"}范围内的文件与任务，整理了相关内容。`,
          timestamp: new Date(),
          references: [
            {
              id: "ref-1",
              title: "样本9_双批次报告_v3.docx",
              subtitle: `${projectContext?.project ?? "项目"} · 数字同事产出`,
              icon: "file",
            },
            {
              id: "ref-2",
              title: "batch9_raw.xlsx",
              subtitle: `${projectContext?.project ?? "项目"} · 人工资料`,
              icon: "list",
            },
          ],
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setThinking(false);
      }, 800);
    },
    [thinking, onSend, projectContext]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: FileQaSuggestion) => {
      setChatOpen(true);
      // Delay to ensure chat is open before sending
      window.setTimeout(() => {
        handleSend(suggestion.prompt);
      }, 50);
    },
    [handleSend, setChatOpen]
  );

  const handleBack = useCallback(() => {
    setChatOpen(false);
    onBack?.();
  }, [setChatOpen, onBack]);

  // ── Render: Chat view (fullscreen) ───────────────────────────────────────
  if (chatOpen) {
    return (
      <section className="fileQaChat" aria-label="文件问答聊天界面">
        {/* Header */}
        <header className="fileQaChatHeader">
          <div className="fileQaChatHeaderLeft">
            {showBack && (
              <button
                className="fileQaBackButton"
                type="button"
                aria-label="返回"
                onClick={handleBack}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <span className="fileQaChatMark">
              <Sparkles size={16} />
            </span>
            <strong>{title}</strong>
          </div>
          <button
            className="fileQaChatClose"
            type="button"
            aria-label="关闭"
            onClick={handleBack}
          >
            <X size={18} />
          </button>
        </header>

        {/* Messages */}
        <div className="fileQaChatBody" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="fileQaChatEmpty">
              <div className="fileQaChatEmptyMark">
                <img src="/logo/bioaz-logo.svg" alt="" />
              </div>
              <strong>开始对话</strong>
              <p>输入你的问题，或选择上方的快捷入口开始。</p>
            </div>
          ) : (
            <div className="fileQaChatMessages">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`fileQaChatMessage ${msg.role}`}
                >
                  {msg.role === "assistant" && (
                    <div className="fileQaChatAvatar">
                      <img src="/logo/bioaz-logo.svg" alt="" />
                    </div>
                  )}
                  <div className="fileQaChatBubble">
                    <p>{msg.text}</p>
                    {msg.references && msg.references.length > 0 && (
                      <div className="fileQaChatReferences">
                        {msg.references.map((ref) => (
                          <button
                            key={ref.id}
                            type="button"
                            className="fileQaChatRefItem"
                          >
                            <span className="fileQaChatRefIcon">
                              {ref.icon === "file" && (
                                <FileSearch size={15} />
                              )}
                              {ref.icon === "list" && (
                                <ListChecks size={15} />
                              )}
                              {ref.icon === "package" && (
                                <Sparkles size={15} />
                              )}
                            </span>
                            <span className="fileQaChatRefText">
                              <strong>{ref.title}</strong>
                              <small>{ref.subtitle}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="fileQaChatMessage assistant">
                  <div className="fileQaChatAvatar">
                    <img src="/logo/bioaz-logo.svg" alt="" />
                  </div>
                  <div className="fileQaChatBubble">
                    <div className="fileQaChatThinking">
                      <span className="fileQaChatThinkingLogo">
                        <img src="/logo/bioaz-logo.svg" alt="" />
                      </span>
                      <span>正在思考中...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          className="fileQaChatComposer"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(text);
          }}
        >
          <label className="fileQaChatAddBtn" aria-label="添加文件">
            <Plus size={18} />
            <input type="file" multiple />
          </label>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="关于这些文件，你想知道什么？"
            aria-label="输入问题"
          />
          <button
            className="fileQaChatSendBtn"
            type="submit"
            aria-label="发送"
            disabled={!text.trim() || thinking}
          >
            <Send size={16} />
          </button>
        </form>
      </section>
    );
  }

  // ── Render: Home view (initial) ──────────────────────────────────────────
  return (
    <section className="fileQaHome" aria-label="文件问答助手首页">
      {/* Welcome area */}
      <div className="fileQaHomeWelcome">
        <div className="fileQaHomeMark">
          <img src="/logo/bioaz-logo.svg" alt="" />
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {/* Three suggestion cards */}
      <div className="fileQaHomeCards">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            className="fileQaHomeCard"
            onClick={() => handleSuggestionClick(suggestion)}
          >
            <span className="fileQaHomeCardIcon">
              <SuggestionIcon type={suggestion.icon} />
            </span>
            <span className="fileQaHomeCardText">
              <strong>{suggestion.label}</strong>
            </span>
            <span className="fileQaHomeCardArrow">
              <Send size={14} />
            </span>
          </button>
        ))}
      </div>

      {/* Input area */}
      <form
        className="fileQaHomeComposer"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(text);
        }}
      >
        <label className="fileQaHomeAddBtn" aria-label="添加文件">
          <Plus size={18} />
          <input type="file" multiple />
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="描述你想了解的内容，或直接提问..."
          aria-label="输入问题"
        />
        <button
          className="fileQaHomeSendBtn"
          type="submit"
          aria-label="发送"
          disabled={!text.trim()}
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
