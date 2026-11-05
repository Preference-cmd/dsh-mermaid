# dsh-mermaid

<!-- Bump the badge with the @deepseek-ai/dsh-tools peerDependency. -->
[![DeepSeek Harness ≥ 0.2.1-alpha.2](https://img.shields.io/badge/DeepSeek_Harness-%E2%89%A5%200.2.1--alpha.2-5b6ee1)](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-alpha.2)
[![MIT license](https://img.shields.io/github/license/Preference-cmd/dsh-mermaid)](./LICENSE)

<!-- 最近一次验证的 DeepSeek Harness 版本；兼容性下限仍以 @deepseek-ai/dsh-tools 的 peerDependency 为准。 -->
最近一次验证：DeepSeek Harness 0.2.2-rc.1，CI 以该版本执行 typecheck 与构建，并以该版本的发布 tag 跑浏览器场景。

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

## 为什么无法做到这样

助手自己手写的 mermaid 围栏无法在上游渲染成图：官方仓库的 Markdown 渲染器没有为代码围栏留出扩展插槽，本插件无法替它画。所以插件选择了另一条路——`mermaid_render` 的结果经自己的卡片与查看器渲染（见上）。在带围栏渲染器的客户端里（下图为作者分支），同样的围栏无需任何插件即可直接成图：

![带围栏渲染器的客户端里，助手手写的 mermaid 围栏直接成图](assets/fence-renderer.png)

参考：[DeepSeek Harness 插件教程](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)。

## 兼容性

插件源码在 DeepSeek Harness 0.2.1-alpha.2 至 0.2.2-rc.1 的每个已发布版本上都通过类型检查（逐版本验证），插件用到的宿主工具契约与客户端 slot 名在整个区间内保持兼容。

| 面 | 要求 |
| --- | --- |
| 宿主 | `@deepseek-ai/dsh-tools`：`>=0.2.1-alpha.2 <0.3.0` 或 `^0.2.2-alpha.2` |
| Cordis | `@deepseek-ai/cordis`：`^4.0.5-alpha.1` 或 `^4.0.6-alpha.1`；0.2.1 系列要求 ~4.0.5，0.2.2-alpha 系列要求 ~4.0.6-alpha.x，0.2.2-rc.1 要求 ~4.1.0 |
| 客户端 | 宿主提供的 `@deepseek-ai/dsh-client-ui-slots` 等客户端包，插件不单独声明 |
| React | 插件的 client bundle 把 React 标记为 external，实际运行在宿主客户端的 React 18 上 |

peer 区间按 semver 的预发布规则分段写：带预发布标签的版本只能被同一 [major, minor, patch] 元组上的比较符满足，所以 `>=0.2.1-alpha.2 <0.3.0` 并不包含 `0.2.2-rc.1`，`^4.0.5-alpha.1` 也不包含 `4.0.6-alpha.1`。

构建期的 `@types/react` 与宿主的 React 18 对齐。React 19 的 npm 包不带类型声明，类型全部来自 `@types/react`；与宿主错配时，宿主 slot 的类型重载会选到别的签名，表现为与运行时无关的类型错误。

类型检查覆盖整个区间；浏览器场景验证的是 0.2.2-rc.1（stock 上游与作者分支各跑一次）。两道 CI 把上面的结论固定下来。`Host compatibility` 工作流在每次推送与 PR 上跑 `scripts/verify-version-matrix.mjs`，对区间内每个已发布版本逐版 typecheck，并检查自己的 peer 区间确实放行这些宿主；同一工作流在 `main` 推送与每周一次的计划任务上，把插件装进一份钉在发布 tag 上的 stock 上游检出，用浏览器跑 `tests/standalone-upstream.e2e.ts`——上游没有内置围栏渲染器，插件必须用自己的引擎把图画出来。

## 许可证

本项目以 [MIT](./LICENSE) 许可证发布。
