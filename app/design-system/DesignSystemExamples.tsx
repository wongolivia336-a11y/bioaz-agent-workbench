"use client";

import { Columns3, Download, Filter, LayoutList, Pin, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionCard, Button, Dialog, Drawer, EmptyState, IconButton, Menu, MenuGroup, MenuItem, NavTabs, SegmentedControl, StatusChip, SurfaceCard } from "../../components/ui";

export function DesignSystemExamples() {
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [tab, setTab] = useState("overview");
  const [view, setView] = useState("list");
  return <div className="bioazExampleStack">
    <section className="bioazExampleBlock"><header><h3>Buttons & status</h3><span>stable</span></header><div className="bioazDesignSystemRow"><Button variant="primary" leadingIcon={<Plus size={16} />}>创建任务</Button><Button leadingIcon={<Download size={16} />}>导出</Button><Button variant="ghost">取消</Button><Button variant="danger" leadingIcon={<Trash2 size={16} />}>删除</Button><IconButton icon={<Pin size={16} />} label="固定" selected /><StatusChip tone="running" dot>处理中</StatusChip><StatusChip tone="success">已完成</StatusChip></div></section>
    <section className="bioazExampleBlock"><header><h3>Navigation & menu</h3><span>stable</span></header><div className="bioazExampleColumn"><NavTabs items={[{ id: "overview", label: "概览" }, { id: "files", label: "文件", count: 12 }]} value={tab} onChange={setTab} label="示例导航" /><div className="bioazDesignSystemRow"><SegmentedControl items={[{ id: "list", label: "列表", icon: <LayoutList size={14} /> }, { id: "grid", label: "分栏", icon: <Columns3 size={14} /> }]} value={view} onChange={setView} label="显示方式" /><Menu icon={<Filter size={16} />} label="筛选"><MenuGroup label="状态"><MenuItem active onSelect={() => undefined}>全部状态</MenuItem><MenuItem onSelect={() => undefined}>处理中</MenuItem></MenuGroup></Menu></div></div></section>
    <section className="bioazExampleBlock"><header><h3>Cards & empty state</h3><span>stable</span></header><div className="bioazDesignSystemGrid"><SurfaceCard><h4>Surface Card</h4><p>静态上下文与信息分组，没有点击反馈。</p></SurfaceCard><ActionCard><h4>Action Card</h4><p>整体可点击，用于进入能力或流程。</p></ActionCard><EmptyState variant="inline" title="暂无审核记录" description="任务完成审核后会显示在这里" /></div></section>
    <section className="bioazExampleBlock"><header><h3>Overlays</h3><span>stable</span></header><div className="bioazDesignSystemRow"><Button onClick={() => setDialog(true)}>打开 Dialog</Button><Button onClick={() => setDrawer(true)}>打开 Drawer</Button></div></section>
    {dialog ? <Dialog title="确认提交" description="提交后将进入专业审核流程。" onClose={() => setDialog(false)} footer={<><Button onClick={() => setDialog(false)}>取消</Button><Button variant="primary" onClick={() => setDialog(false)}>确认提交</Button></>}><p>Dialog 用于需要集中注意力的确认，不承载完整工作流。</p></Dialog> : null}
    {drawer ? <Drawer title="证据详情" eyebrow="当前任务" onClose={() => setDrawer(false)}><p>Drawer 保留当前页面上下文，用于查看详情和轻量操作。</p></Drawer> : null}
  </div>;
}
