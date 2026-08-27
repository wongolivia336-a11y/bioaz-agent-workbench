"use client";

import { Download } from "lucide-react";
import { QuotePreviewModal } from "./QuotePreviewModal";
import { money, quoteCategories } from "./QuotePaper";
import { quoteItems, quoteMeta, quoteParams, quoteSubtotals, type QuoteNote } from "../../lib/workbench/quoteData";
import type { MailResourceRef } from "../../lib/workbench/mailboxData";
import type { Ticket } from "../../lib/workbench/ticketData";

/* 随行产物的预览与下载。
   -------------------------------------------------------------------
   预览渲染的是审核画布里的同一份纸面，连批注记号和右栏清单都一样——
   撰写人拿回这一版，看到的应该就是审批人当时看到的那一屏。
   只给一份干净的纸，他还得对着别处的清单在纸上找行，
   而「哪一行」正是批注最要紧的那个信息。

   只有原型确实持有内容的文件才给这两个动作。其余附件（压缩包、别人的 PDF）在
   原型里没有字节，与其摆两个点了没反应的按钮，不如不摆：一个高保真原型里，
   按钮存在就是在承诺一件事做得到。 */

export type TicketFileView = "quote-doc" | "quote-sheet";

/** 这份附件在原型里有没有可渲染的内容。没有就返回 null，调用方据此决定给不给动作。 */
export function ticketFileView(ticket: Ticket, file: MailResourceRef): TicketFileView | null {
  if (ticket.kind !== "dmpk-quotation") return null;
  if (file.name.endsWith(".xlsx")) return "quote-sheet";
  if (file.name.endsWith(".docx")) return "quote-doc";
  return null;
}

/* 下载给的是原型手里真有的那份数据，导成 CSV。
   不伪造 .xlsx/.docx 的字节：那需要一个真的写文件库，而拿一个改了扩展名的
   文本文件冒充，只会在客户双击打开报错的那一刻穿帮。文件名照实写 .csv。 */
const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
const csvRows = (view: TicketFileView) => {
  if (view === "quote-doc") {
    return [
      ["Category", "Item", "Description"],
      ...quoteCategories.flatMap((category) =>
        quoteItems.filter((item) => item.category === category).map((item) => [category, item.item, item.description])),
      [`Package Price (${quoteMeta.currency})`, "", money(quoteMeta.packagePrice)],
      [`Total Price (${quoteMeta.currency})`, "", money(quoteMeta.totalPrice)],
    ];
  }
  return [
    ["Category", "Item", "Description", "Unit Price"],
    ...quoteCategories.flatMap((category) =>
      quoteItems.filter((item) => item.category === category)
        .map((item) => [category, item.item, item.description, item.unitPrice === undefined ? "" : money(item.unitPrice)])),
    [],
    ["可编辑参数", "取值"],
    ...quoteParams.map((param) => [param.label, param.value]),
    [],
    ["小计", "金额"],
    ...quoteSubtotals.map((sub) => [sub.label, money(sub.amount)]),
    ["Standard Price", money(quoteMeta.standardPrice)],
    ["Discounted Price", money(quoteMeta.discountedPrice)],
  ];
};

export function downloadTicketFile(file: MailResourceRef, view: TicketFileView) {
  const body = csvRows(view).map((row) => row.map(csvCell).join(",")).join("\r\n");
  /* BOM：没有它 Excel 会把 UTF-8 的中文读成乱码。 */
  const blob = new Blob([`﻿${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${file.name.replace(/\.[^.]+$/, "")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function TicketFilePreview({ file, view, notes = [], onClose }: {
  file: MailResourceRef;
  view: TicketFileView;
  notes?: QuoteNote[];
  onClose: () => void;
}) {
  return (
    <QuotePreviewModal
      title={file.name}
      description={file.meta}
      initialForm={view === "quote-sheet" ? "sheet" : "doc"}
      notes={notes}
      onClose={onClose}
      footer={
        <button className="reworkAction" type="button" onClick={() => downloadTicketFile(file, view)}>
          <Download size={14} aria-hidden="true" />下载
        </button>
      }
    />
  );
}
