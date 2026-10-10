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
} satisfies Record<MermaidKey, string>
