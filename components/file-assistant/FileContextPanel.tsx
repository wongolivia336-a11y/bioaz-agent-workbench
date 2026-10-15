"use client";

import { FileText, PanelRightClose, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KnowledgeFile } from "../../lib/workbench/shellTypes";

type FileContextPanelProps = {
  file: KnowledgeFile;
  onClose: () => void;
};

type ContextMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  reference?: string;
};

const suggestions = [
  "总结这份文件",
  "找出关键数据",
  "这份文件有哪些风险？",
];

function answerFor(file: KnowledgeFile, question: string) {
  if (question.includes("风险")) {
    return `当前原型识别到 1 个需要关注的点：${file.title} 尚未接入真实解析结果。正式接入后，我会把依据定位到具体页码或表格单元格。`;
  }
  if (question.includes("关键数据")) {
    return `我会从 ${file.title} 中提取关键字段、数值和版本信息，并附上原文位置。当前演示先保留文件上下文，后续接入解析服务后显示真实结果。`;
  }
  return `这是一份「${file.kind}」，属于「${file.project}」。我可以围绕它继续回答内容、版本和来源问题，并把依据定位回原文件。`;
}

export function FileContextPanel({ file, onClose }: FileContextPanelProps) {
  const [messages, setMessages] = useState<ContextMessage[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = (value: string) => {
    const question = value.trim();
    if (!question || thinking) return;
    setMessages((current) => [...current, { id: `question-${Date.now()}`, role: "user", text: question }]);
    setText("");
    setThinking(true);
    window.setTimeout(() => {
      setMessages((current) => [...current, {
        id: `answer-${Date.now()}`,
        role: "assistant",
        text: answerFor(file, question),
        reference: "查看文件依据",
      }]);
      setThinking(false);
    }, 650);
  };

  return (
    <aside className="fileContextPanel" aria-label={`询问${file.title}`}>
      <header className="fileContextPanelHeader">
        <div className="fileContextPanelTitle">
          <div>
            <strong>AI 问答</strong>
            <small>围绕当前文件提问</small>
          </div>
        </div>
        <button className="iconButton" type="button" onClick={onClose} aria-label="收起文件问答" title="收起问答面板"><PanelRightClose size={16} /></button>
      </header>

      <div className="fileContextPanelBody">
        <div className="fileContextScope">
          <FileText size={14} />
          <span>{file.title}</span>
        </div>
        {!messages.length && !thinking ? (
          <div className="fileContextEmpty">
            <strong>可以问这份文件</strong>
            <p>可以询问摘要、关键数据或具体内容。</p>
            <div className="fileContextSuggestions">
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => send(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="fileContextMessages">
            {messages.map((message) => (
              <div className={`fileContextMessage ${message.role}`} key={message.id}>
                {message.role === "assistant" ? <span className="fileContextAgentMark"><img src="/logo/bioaz-logo.svg" alt="" /></span> : null}
                <div>
                  <p>{message.text}</p>
                  {message.reference ? <button className="fileContextReference" type="button">{message.reference}</button> : null}
                </div>
              </div>
            ))}
            {thinking ? <div className="fileContextThinking"><span className="fileContextAgentMark isThinking"><img src="/logo/bioaz-logo.svg" alt="" /></span><span>正在查找文件依据</span></div> : null}
          </div>
        )}
      </div>

      <form className="fileContextComposer" onSubmit={(event) => { event.preventDefault(); send(text); }}>
        <input ref={inputRef} value={text} onChange={(event) => setText(event.target.value)} placeholder="围绕当前文件提问..." aria-label="围绕当前文件提问" />
        <button className="fileContextSend" type="submit" aria-label="发送问题" disabled={!text.trim() || thinking}><Send size={15} /></button>
      </form>
    </aside>
  );
}
