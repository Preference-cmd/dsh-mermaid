# dsh-mermaid

<!-- Bump the badge with the @deepseek-ai/dsh-tools peerDependency. -->
[![DeepSeek Harness ≥ 0.2.1-alpha.2](https://img.shields.io/badge/DeepSeek_Harness-%E2%89%A5%200.2.1--alpha.2-5b6ee1)](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-alpha.2)

面向 DeepSeek Harness 的 Mermaid 图表插件：模型经 `mermaid_render` 工具出图，图表以“会话中产物”常驻回合末尾，点开即得右侧边栏的缩放大画布。单包发布、自带渲染引擎，上游 DSH 无需任何改动。

## 安装

```sh
dsh plugin --profile web add github:Preference-cmd/dsh-mermaid
```

安装后重启该 profile。包内自带构建产物，pnpm 无需构建权限。

## 贡献内容

- **宿主侧**：`mermaid_render` 工具（无解析器、无无头浏览器）。它接受图源和一个可选的简短 `title`（≤ 200 个字符）为图表命名；拒绝空图，把图源原样以 ```mermaid 围栏返回，并发布 `output.presentationMeta = { source, title? }` 供回放稳定的卡片使用。标题用于命名转录卡片的过程行、回合末尾行和查看器标签页；未传参数时，图表自己的 frontmatter `title:` 会补位。
- **浏览器侧**：`mermaid_render` 的键控 `tool.call.toolview` 卡片。它先把图源交给共享的 `MarkdownText` 渲染器——带 Mermaid 围栏支持的客户端会直接画出图表，并贡献自己的缩放/平移视口。“在视图中打开”按钮会打开右侧边栏的查看器标签页：图表占满整个窗格，自带缩放与平移（滚轮、拖拽和工具栏；缩放锚定在指针或窗格中心）。标签页按 Session 与工具调用寻址，重开同一调用的图表会聚焦它已有的标签页。
- **浏览器侧，回合末尾**：一个 state-only 的 conversation Definition 把已记录的 `mermaid_render` 调用与其 append-origin 结果配对并按回合发布；`conversation.chat.turnTail` 行在回合收尾消息之后为每张定稿图表渲染一条紧凑条目——这正是产物式的表面，图表在这里保持可见，无需展开过程流。不记录任何新事件：回合末尾从会话日志回放。
- **浏览器侧，回退渲染**：把 ```mermaid 围栏渲染为普通代码块的客户端——上游 DSH 就是如此——会改用卡片自带的渲染器画图。引擎作为包内 `lib/client.mermaid.js` chunk（约 3.5 MB，内联并压缩）随包发布，只在第一张图绘制时经客户端模块系统的 `require.async` 拉取，永不进入页面 bundle。组装好的 SVG 以 React 元素（而非标记串）进入 React：引擎在 `securityLevel: 'strict'` 下净化输出，DOM-to-React 映射丢弃所有 `on*` 属性和 `javascript:` URL，没有任何内容走 `dangerouslySetInnerHTML`。

## 已知限制

- 卡片自己的渲染器把图表贴合转录列宽。缩放/平移视口属于客户端的围栏渲染器；有该渲染器的客户端卡片继续使用它，回退渲染不重新实现——无论如何，查看器标签页都是大画布表面。
- 回合末尾只读根 `mermaid_render` 调用，与文件交付 Definition 的范围一致：PTC dispatch 子调用里产生的图表不会出现在回合末尾。
- 查看器标签页把文档放在内存态导航参数里（plan-review 形态）：侧栏布局恢复后重开它只会显示过期提示而非图表。图表的持久副本在会话日志里，经转录卡片或回合末尾行回到它。
- 引擎 chunk 内联了 Mermaid 自己的分图逻辑：客户端模块系统把包内 chunk 物化为单一闭包，chunk 之间的同步 require 无法应答。
- 卡片永不退化：引擎加载中或失败时，结果保持围栏原有的代码块渲染。
- 助手手写的 ```mermaid 围栏不在本插件范围内：只有在客户端 Markdown 渲染器支持它们的地方才会渲染。把该渲染器做进 DSH core 是覆盖所有客户端且不用每个插件各带一份引擎的唯一路径。
- 调试开关：页面启动前设 `window.__DSH_MERMAID_RENDERER__ = 'card'`（或 `'client'`）可固定由哪个渲染器绘制。
- 参考：[DeepSeek Harness 插件教程](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)。
