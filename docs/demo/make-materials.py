# -*- coding: utf-8 -*-
"""
生成 docs/demo/materials/ 里的演示材料。

原型里的解析是 mock：按文件**种类**走固定剧本（docx / pdf / xlsx → BB-001 方案；
图片 → 给药分组表截图 OCR；txt 或文件名带「微信 / 聊天」的 → 客户沟通记录），
不读内容。所以这些文件的作用是**演示时看着像真的**——名字规范、打开有东西、跟剧本对得上。

依赖：python-docx、openpyxl、Pillow（这台机器都有）。重新生成：python docs/demo/make-materials.py
"""
from pathlib import Path

from docx import Document
from docx.shared import Pt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent / "materials"
OUT.mkdir(exist_ok=True)

GROUPS = [
    ("G1", "对照", "0", "2", "IV infusion · Q1W × 3", "核心"),
    ("G2", "低剂量", "3", "2", "IV infusion · Q1W × 3", "核心"),
    ("G3", "中剂量", "10", "2", "IV infusion · Q1W × 3", "核心"),
    ("G4", "高剂量", "30", "2", "IV infusion · Q1W × 3", "核心"),
    ("S2", "低剂量 · 卫星", "3", "1", "IV infusion · 单次", "卫星 PK"),
    ("S3", "中剂量 · 卫星", "10", "1", "IV infusion · 单次", "卫星 PK"),
    ("S4", "高剂量 · 卫星", "30", "1", "IV infusion · 单次", "卫星 PK"),
]


def protocol_docx():
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Microsoft YaHei"
    style.font.size = Pt(10.5)
    doc.add_heading("BB-001 食蟹猴 28 天 DRF/毒理试验方案", level=0)
    doc.add_paragraph("方案编号：BB-001-TOX-28D · 版本 v2.0 · 2026-09-15 · 委托方：XX药业 · 保密")
    doc.add_heading("1. 实验设计", level=1)
    doc.add_paragraph(
        "受试物 BB-001 为双载荷抗体偶联药物（IMQ + MMAF），生物制品初免。"
        "食蟹猴，7 个队列共 11 只：4 个核心组每组 2 只（雌雄各半），3 个卫星组每组 1 只用于单次给药 PK。"
        "给药途径 IV infusion 约 60 分钟，核心组每周一次共 3 次，卫星组单次给药。观察期 28 天。"
    )
    doc.add_heading("2. 分组与给药", level=1)
    table = doc.add_table(rows=1, cols=6)
    table.style = "Light Grid Accent 1"
    for cell, head in zip(table.rows[0].cells, ["组别", "剂量组", "剂量 (mg/kg)", "动物数", "给药", "类型"]):
        cell.text = head
    for row in GROUPS:
        cells = table.add_row().cells
        for cell, value in zip(cells, row):
            cell.text = value
    doc.add_heading("3. 采样计划", level=1)
    doc.add_paragraph("TK：核心组每只 16 个时点（第 1 次与第 3 次给药后各 8 点）；卫星组 PK 每只 11 个时点。血清，每点 0.5 mL。")
    doc.add_paragraph("临床病理：核心组 6 个时点（血液学、血清生化、凝血、尿液）。细胞因子：核心组 21 点、卫星组 7 点。")
    doc.add_paragraph("ADA：核心组 5 点、卫星组 4 点，血清留样。免疫分型：核心组 4 点，全血。")
    doc.add_heading("4. 生物分析", level=1)
    doc.add_paragraph("游离 IMQ、游离 MMAF：LC-MS/MS，方法开发与资格确认。")
    doc.add_paragraph("dpADC、spADC-IMQ、spADC-MMAF、Total mAb：可由 ELISA 或 LC-MS/MS 检测，需选定平台。")
    doc.add_paragraph("细胞因子 10-plex：多重免疫分析，平台待定。免疫分型 Panel A / B：流式细胞术。")
    doc.add_heading("5. 交付", level=1)
    doc.add_paragraph("28 天 DRF/毒理综合报告（中文），Word 报价单 + Excel 报价明细。报价区域与币种以商务确认为准。")
    doc.save(OUT / "BB-001_食蟹猴28天DRF毒理试验方案_v2.0_20260915.docx")


def sample_list_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = "采样计划"
    head = ["组别", "动物数", "TK/PK 时点", "临床病理时点", "细胞因子时点", "ADA 时点", "免疫分型时点", "基质"]
    ws.append(head)
    for cell in ws[1]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill("solid", fgColor="EEF0F5")
    rows = [
        ["G1–G4 核心", 8, 16, 6, 21, 5, 4, "血清 / 全血 / 尿液"],
        ["S2–S4 卫星", 3, 11, 0, 7, 4, 0, "血清"],
    ]
    for row in rows:
        ws.append(row)
    ws.append([])
    ws.append(["合计采样事件", 37, "份数", 479, "", "", "", "同点合并一次穿刺"])
    for col, width in zip("ABCDEFGH", [14, 10, 12, 14, 14, 10, 14, 22]):
        ws.column_dimensions[col].width = width
    ws2 = wb.create_sheet("分析物")
    ws2.append(["分析物", "基质", "平台", "状态"])
    for cell in ws2[1]:
        cell.font = Font(bold=True)
    for row in [
        ["游离 IMQ", "血清", "LC-MS/MS", "方法开发"],
        ["游离 MMAF", "血清", "LC-MS/MS", "方法开发"],
        ["dpADC", "血清", "ELISA / LC-MS/MS", "平台待定"],
        ["spADC-IMQ", "血清", "ELISA / LC-MS/MS", "平台待定"],
        ["spADC-MMAF", "血清", "ELISA / LC-MS/MS", "平台待定"],
        ["Total mAb", "血清", "ELISA / LC-MS/MS", "平台待定"],
        ["细胞因子 10-plex", "血清", "多重免疫分析", "平台待定"],
    ]:
        ws2.append(row)
    wb.save(OUT / "BB-001_采样计划与分析物清单_20260916.xlsx")


def _font(size):
    for name in ["msyh.ttc", "msyhbd.ttc", "simhei.ttf", "simsun.ttc"]:
        try:
            return ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)
        except OSError:
            continue
    return ImageFont.load_default()


def dosing_table_png():
    cols = ["组别", "剂量组", "剂量 (mg/kg)", "动物数", "给药", "类型"]
    widths = [70, 130, 120, 80, 210, 90]
    w = sum(widths) + 40
    row_h = 38
    h = 40 + row_h * (len(GROUPS) + 1) + 40
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)
    title_font, cell_font, small = _font(18), _font(15), _font(12)
    d.text((20, 12), "表 2  分组与给药  ·  BB-001 食蟹猴 28 天 DRF", fill="#1a1d24", font=title_font)
    y = 48
    x = 20
    d.rectangle([x, y, x + sum(widths), y + row_h], fill="#EEF0F5")
    for col, cw in zip(cols, widths):
        d.text((x + 10, y + 10), col, fill="#1a1d24", font=cell_font)
        x += cw
    for i, row in enumerate(GROUPS):
        y += row_h
        x = 20
        d.line([20, y, 20 + sum(widths), y], fill="#D7DCE5")
        for value, cw in zip(row, widths):
            d.text((x + 10, y + 10), value, fill="#2b2f38", font=cell_font)
            x += cw
    d.line([20, y + row_h, 20 + sum(widths), y + row_h], fill="#D7DCE5")
    d.text((20, h - 26), "截图自方案 v2.0 · 微信转发 · 2026-09-19", fill="#8b95a3", font=small)
    img.save(OUT / "给药分组表_方案截图_20260919.png")


def chat_txt():
    lines = [
        "微信群：XX药业-BB-001 报价沟通",
        "导出时间：2026-09-18 17:42",
        "",
        "[09-17 10:12] 王经理（XX药业）：方案发你了，麻烦按 28 天 DRF 出个报价，PK 卫星组也要。",
        "[09-17 10:15] 赵敏（BioAZ）：收到，方案我先读一遍，下午给你识别出来的参数你确认。",
        "[09-17 10:31] 王经理（XX药业）：报告要中文的，Word 加 Excel 明细都要。",
        "[09-17 10:33] 李博（XX药业）：细胞因子那块用 10-plex，平台你们定，报价里单列。",
        "[09-17 11:02] 赵敏（BioAZ）：好，细胞因子和免疫分型我们价目里可能没有现成档，到时候会标出来。",
        "[09-18 09:20] 王经理（XX药业）：区域按国内走，人民币，不用美元。",
        "[09-18 09:24] 王经理（XX药业）：交付时间下周三前能给初版吗？",
        "[09-18 09:40] 赵敏（BioAZ）：可以，周三前给初版，无价目的项会先留空让你们确认。",
        "[09-18 14:05] 李博（XX药业）：ADA 只做筛选，确证和滴度先不做。",
        "[09-18 14:06] 赵敏（BioAZ）：明白，ADA 按筛选算。",
    ]
    (OUT / "微信沟通记录_XX药业_BB-001报价_20260918.txt").write_text("\n".join(lines), encoding="utf-8")


def prior_quote_pdf():
    """最小的合法 PDF（ASCII 内容）：作为「往期报价」的道具，mock 会把它当方案读——README 里说明了。"""
    text_lines = [
        "BioAZ - Quotation TK-2039 (prior quote, mock)",
        "Client: XX Pharma   Date: 2026-06-12   Currency: USD",
        "Single/Repeat dose oligonucleotide toxicity",
        "Package price: 4,120.00   Total: 4,120.00",
        "For demo only. Content is placeholder.",
    ]
    content = "BT /F1 12 Tf 50 740 Td 16 TL " + " ".join(f"({line}) Tj T*" for line in text_lines) + " ET"
    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = "%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objs, start=1):
        offsets.append(len(out.encode("latin-1")))
        out += f"{i} 0 obj\n{obj}\nendobj\n"
    xref = len(out.encode("latin-1"))
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n" + "".join(f"{o:010d} 00000 n \n" for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    (OUT / "往期报价_TK-2039_XX药业_20260612.pdf").write_bytes(out.encode("latin-1"))


if __name__ == "__main__":
    protocol_docx()
    sample_list_xlsx()
    dosing_table_png()
    chat_txt()
    prior_quote_pdf()
    for path in sorted(OUT.iterdir()):
        print(f"{path.name}  {path.stat().st_size:,} B")
