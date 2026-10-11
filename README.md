# dsh-mermaid

<!-- Bump the badge with the @deepseek-ai/dsh-tools peerDependency. -->
[![DeepSeek Harness ≥ 0.2.1-alpha.2](https://img.shields.io/badge/DeepSeek_Harness-%E2%89%A5%200.2.1--alpha.2-5b6ee1)](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-alpha.2)

面向 DeepSeek Harness 的 Mermaid 图表插件：模型经 `mermaid_render` 工具出图，图表以“会话中产物”常驻回合末尾，点开即得右侧边栏的缩放大画布。单包发布、自带渲染引擎，上游 DSH 无需任何改动。

## 安装

```sh
dsh plugin --profile web add github:Preference-cmd/dsh-mermaid
```

安装后重启该 profile。包内自带构建产物，pnpm 无需构建权限。

## 它做了什么

- **`mermaid_render` 工具**（宿主侧）：接受图源和可选的短 `title`，原样返回 ```mermaid 围栏，并把 `{ source, title? }` 持久化到结果元数据里，重放时按同一来源重绘；无解析器、无无头浏览器。
- **转录卡片**（浏览器侧）：先把图源交给客户端的围栏渲染器，客户端不支持时用自带引擎绘制。SVG 以 React 元素进入页面——引擎在 `securityLevel: 'strict'` 下净化输出，丢弃全部 `on*` 属性与 `javascript:` URL，不使用 `dangerouslySetInnerHTML`。
- **回合末尾产物行**（浏览器侧）：从会话日志回放已定稿的图，按标题常驻在回合收尾消息之后，不展开过程流也可见。
- **侧栏查看器**（浏览器侧）：点“在视图中打开”进入右侧边栏大画布，滚轮缩放、拖拽平移；同一调用的图重复打开会聚焦同一个标签页。

![回合末尾的产物行（左下）与右侧边栏查看器](assets/turn-tail-viewer.png)

## 已知限制

- 卡片自己的渲染器把图表贴合转录列宽。缩放/平移视口属于客户端的围栏渲染器；有该渲染器的客户端卡片继续使用它，回退渲染不重新实现——无论如何，查看器标签页都是大画布表面。
- 回合末尾只读根 `mermaid_render` 调用，与文件交付 Definition 的范围一致：PTC dispatch 子调用里产生的图表不会出现在回合末尾。
- 查看器标签页把文档放在内存态导航参数里（plan-review 形态）：侧栏布局恢复后重开它只会显示过期提示而非图表。图表的持久副本在会话日志里，经转录卡片或回合末尾行回到它。
- 引擎 chunk 内联了 Mermaid 自己的分图逻辑：客户端模块系统把包内 chunk 物化为单一闭包，chunk 之间的同步 require 无法应答。
- 卡片永不退化：引擎加载中或失败时，结果保持围栏原有的代码块渲染。
- 助手手写的 ```mermaid 围栏不在本插件范围内：只有在客户端 Markdown 渲染器支持它们的地方才会渲染。把该渲染器做进 DSH core 是覆盖所有客户端且不用每个插件各带一份引擎的唯一路径。
- 调试开关：页面启动前设 `window.__DSH_MERMAID_RENDERER__ = 'card'`（或 `'client'`）可固定由哪个渲染器绘制。
- 参考：[DeepSeek Harness 插件教程](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)。
