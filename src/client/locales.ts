/** Locale namespace owned by this plugin's card. */
export const NS = 'dshMermaid'

/** Chinese dictionary; the key set is the source of truth. */
export const zh = {
  preparing: '准备中',
  running: '正在绘制图表',
  copy: '复制',
  copied: '已复制',
  footnotes: '引用',
  zoomIn: '放大',
  zoomOut: '缩小',
  reset: '复位',
  openViewer: '在视图中打开',
  viewerTitle: 'Mermaid 图',
  viewerLoading: '正在加载渲染引擎',
  viewerFailed: '引擎无法绘制这张图；源码保留在转录卡片上。',
  viewerExpired: '此视图不保留图表内容；回到转录，从它的卡片重新打开。',
} satisfies Record<string, string>

/** Every key the card translates. */
export type MermaidKey = keyof typeof zh

/** English dictionary; completeness is checked against {@link MermaidKey}. */
export const en = {
  preparing: 'Preparing',
  running: 'Rendering diagram',
  copy: 'Copy',
  copied: 'Copied',
  footnotes: 'References',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  reset: 'Reset zoom',
  openViewer: 'Open in viewer',
  viewerTitle: 'Mermaid diagram',
  viewerLoading: 'Loading the rendering engine',
  viewerFailed: 'The engine could not draw this diagram; its source stays on the transcript card.',
  viewerExpired: 'This view keeps no diagram content; reopen it from its transcript card.',
} satisfies Record<MermaidKey, string>
