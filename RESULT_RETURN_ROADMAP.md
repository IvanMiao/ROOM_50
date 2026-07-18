# ROOM/50 结果回传功能 Roadmap

## 目标

为 ROOM/50 增加一个明确选择、默认关闭的结果回传能力：

- **仅在本地生成**：保持当前行为，不创建服务器任务，结果只存在于用户的 Codex 工作区。
- **允许回传结果**：网站创建一次性任务；Codex 完成本地构建后，在用户确认下上传结果。

回传成功后，网站通过独立结果页展示建模摘要、预览图、无障碍检查和可下载文件，例如：

```text
/results/{jobId}
```

回传结果不得直接修改或覆盖 ROOM/50 主网站代码。

## 目标流程

```text
用户配置任务
   ↓
选择：仅本地 / 允许回传
   ↓
网站生成一次性任务 ID 和短期上传令牌
   ↓
Codex 在本地构建
   ↓
Codex 展示待回传文件并再次确认
   ↓
上传结果清单、截图和模型文件
   ↓
网站任务页显示结果
```

## Phase 0：确定边界与协议

**预计：1–2 个工程日**

先定义允许回传的内容，避免一开始就处理任意工作区文件。

第一版建议支持：

- `result-manifest.json`
- 轴测预览图
- 顶视证据图
- 无障碍证据图
- 可选 `.glb`
- Three.js 成品 ZIP 后续加入
- `.blend` 大文件后续加入

默认不得回传：

- 用户原始参考图
- Codex 对话记录
- 整个工作区
- Git 配置、环境变量和日志
- 未列入 manifest 的文件

新增公开结果协议：

```text
/agent/result-contract.json
```

建议结构：

```json
{
  "contractVersion": "1.0",
  "jobId": "...",
  "status": "complete",
  "engine": "threejs",
  "summary": "...",
  "checks": {
    "shellAreaM2": 50,
    "minimumRouteWidthM": 1.2,
    "turningZones": 3,
    "doorClearWidthM": 0.9,
    "loweredCounterHeightM": 0.76,
    "accessibleTableKneeClearanceM": 0.7
  },
  "artifacts": [],
  "knownGaps": [],
  "nextDecision": "..."
}
```

### 验收标准

- Three.js 和 Blender 结果可以使用同一份顶层 manifest 描述。
- 协议明确区分必需文件、可选文件和禁止回传内容。
- 协议具备版本字段，未来可以向后兼容。

## Phase 1：手动回传 MVP

**预计：2–4 个工程日**

这是最适合先上线的版本，不要求用户的 Codex 能访问外部上传接口。

流程：

1. Codex 按结果协议生成文件。
2. Codex 打包 `room50-result.zip`。
3. 用户回到网站。
4. 用户把 ZIP 拖入“导入 Codex 结果”区域。
5. 网站在浏览器内解析、验证并展示结果。

初期可以只在浏览器中展示，不上传服务器；刷新后结果消失。后续再增加“保存到网站”按钮。

需要验证：

- 必须存在 `result-manifest.json`。
- contract version 必须可识别。
- job/scenario ID 必须与 ROOM/50 匹配。
- manifest 中的文件名必须与实际文件一致。
- 图片和 GLB 必须满足大小限制。
- 拒绝 `../../file` 等路径穿越内容。
- 不自动执行 ZIP 中的 HTML 或 JavaScript。

### 验收标准

- 不支持网络回传的 Codex 环境仍然可用。
- 用户能在 ROOM/50 页面看到本地生成的预览和检查结果。
- 未经用户确认，不会有任何文件离开浏览器。

## Phase 2：回传任务后端

**预计：4–7 个工程日**

为当前 Netlify 静态网站增加独立的任务 API、元数据存储和对象存储。

建议 API：

```http
POST /api/jobs
GET  /api/jobs/{jobId}
POST /api/jobs/{jobId}/manifest
POST /api/jobs/{jobId}/artifacts
POST /api/jobs/{jobId}/complete
```

创建任务时返回：

```json
{
  "jobId": "...",
  "uploadToken": "...",
  "uploadUrl": "...",
  "resultUrl": "...",
  "expiresAt": "..."
}
```

任务状态：

```text
created → building → uploading → complete
                         ↘ failed
created/building/uploading → expired
```

关键设计：

- `uploadToken` 只能写入一个 job。
- Token 短期有效，任务完成后立即失效。
- 读取结果使用独立权限凭证。
- 大文件直接上传对象存储，不经过普通函数内存。
- 使用 `/complete` 明确结束上传。
- 部分上传失败不能影响已经存在的本地结果。

### 验收标准

- 未授权请求不能写入任务。
- Token 不能跨 job 使用或重复完成任务。
- 任务过期后不能继续上传。
- 删除任务时同步删除关联文件。

## Phase 3：网站增加“是否回传”选择

**预计：2–3 个工程日**

在 Prompt Builder 中增加：

```text
结果保存方式

● 仅保存在我的 Codex 工作区
○ 完成后回传到 ROOM/50
```

只有选择回传时才调用 `POST /api/jobs`。

生成的 Prompt 增加独立说明：

```text
OPTIONAL RESULT RETURN

The user has enabled result return for this task.

Before uploading:
1. Finish all local files.
2. Validate them against /agent/result-contract.json.
3. Show the user the exact files and sizes.
4. Obtain confirmation for the external upload.
5. Upload only the listed result artifacts.

Never upload the source reference image unless separately authorized.
If network upload is unavailable, create room50-result.zip for manual import.
```

短期 Token 可以随 Prompt 交给 Codex，但必须是单任务、仅上传、可过期的 capability token，不能是网站长期 API 密钥。

### 验收标准

- 默认选中“仅本地”。
- 仅本地模式不创建服务器记录。
- 允许回传不等于允许回传原始参考图。
- Prompt 同时提供自动上传和手动 ZIP 两条路径。

## Phase 4：Codex 直接回传

**预计：3–5 个工程日**

Codex 完成构建后：

1. 生成 manifest。
2. 计算文件大小和 SHA-256。
3. 向用户展示待上传清单。
4. 获得上传授权。
5. 上传文件。
6. 调用 `/complete`。
7. 返回网站结果页链接。

确认信息示例：

```text
准备回传：

- result-manifest.json — 4 KB
- axonometric-review.png — 1.8 MB
- top-evidence.png — 1.2 MB
- room50-accessible-cafe.glb — 18 MB

不包含原始参考图、工作区源码或对话记录。
```

如果 Codex 环境没有网络权限，则自动降级为 Phase 1 的 `room50-result.zip`，不能宣称已经回传。

### 验收标准

- 用户拒绝确认后不发生网络写入。
- 上传完成后网站能读取同一份 manifest。
- 断网或权限不足时明确降级为手动导入。

## Phase 5：结果页面

**预计：3–5 个工程日**

结果页建议展示：

- 任务状态与完成时间
- 用户意图与固定约束
- 轴测、顶视和无障碍证据图
- 50 m²、路线宽度、三个回转区等检查
- Agent 的 observed facts、assumptions 和 known gaps
- `.glb`、ZIP 或 `.blend` 下载入口
- “概念演示—不可用于施工”标签
- 删除结果按钮
- 过期时间和隐私状态

不得直接执行上传的 Three.js HTML。更安全的展示方式是：

- 截图直接展示。
- GLB 放入网站自有的受控查看器。
- Three.js ZIP 只提供下载。
- 后续如需在线运行，放入隔离域名和严格的 sandbox iframe。

### 验收标准

- 结果页清楚区分 Agent 报告、机器检查结果和用户原始意图。
- 上传内容不能执行在 ROOM/50 主站权限上下文中。
- 用户能删除自己的结果及关联文件。

## Phase 6：生产安全和运营控制

**预计：3–6 个工程日**

自动回传上线前补齐：

- 单文件和总容量限制
- MIME 与扩展名双重验证
- 文件哈希校验
- 上传频率限制
- 配额和自动过期清理
- 恶意文件扫描
- 私有结果访问控制
- 删除与数据保留策略
- 审计事件，但不记录上传 Token
- 成本监控
- API 版本兼容策略

建议 MVP 限制：

- Manifest：不超过 256 KB
- 每张图片：不超过 5 MB
- GLB：不超过 50 MB
- 第一版不接收任意 HTML、JS 或 `.blend`
- ZIP 仅在浏览器本地解析；服务器存储 ZIP 延后实现

## 推荐实施顺序

```text
结果协议
   ↓
浏览器本地导入 ZIP
   ↓
结果展示页面
   ↓
任务 API 与对象存储
   ↓
网站“允许回传”选项
   ↓
Codex 自动回传
   ↓
安全与配额加固
```

## 首个里程碑

第一个可交付版本应当是：

> 用户的 Codex 生成标准结果包，用户手动拖回 ROOM/50，并在网站上看到完整结果。

这个版本可以先验证结果格式、展示价值和用户操作路径，同时避免立即承担认证、外部写入、大文件存储和恶意文件处理的全部风险。

