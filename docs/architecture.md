# 团队版 Todo + 版本管理平台 —— 功能模块架构设计

> 配套文档：[types/data-model.ts](../types/data-model.ts)（数据结构定稿）
> 本文回答"平台由哪些模块组成、各自干什么、怎么协作"。

---

## 1. 架构总览（四层 + 一个地基）

```
┌──────────────────────────── 视图层（按角色分面） ────────────────────────────┐
│  学生视图      班主任视图       校长视图        全局看板        历史搜索       │
│  课程表/待办   风险看板/排考    节奏总览/重合   负载热力图/需求  时间线检索    │
│  能力画像      单元进度         里程碑总结      进度表                       │
└──────┬──────────────────────────────────────────────────────────────────────┘
       │ 查询接口 / 命令
┌──────▼────────────────────────── 应用层（业务模块） ────────────────────────┐
│  任务管理模块   版本节奏模块   导出模块    AI 集成模块   搜索模块            │
│  TodoModule     ReleaseModule  Export     AIModule      SearchModule        │
│                                                      通知模块  权限模块     │
│                                                      Notify     Auth/RBAC   │
└──────┬──────────────────────────────────────────────────────────────────────┘
       │ 调用（纯函数，无副作用）
┌──────▼────────────────────────── 引擎层（纯计算） ──────────────────────────┐
│  调度引擎 SchedulingEngine      风险引擎 RiskEngine      分析引擎 Analytics  │
│  suggestExamSlots               scanRisks(5类)          requirementProgress │
│  buildStudentLoad/容量检查       风险处置建议            buildProfile        │
│                                                        summarizeMilestones │
│                                                        loadHeatmap/overlap │
└──────┬──────────────────────────────────────────────────────────────────────┘
       │ 读写（所有写操作必经）
┌──────▼────────────────────────── 数据层 ────────────────────────────────────┐
│  仓储层 Repositories（Todo/Version/Unit/Exam/Employee/Requirement/Mainline）│
│  事件日志 EventLog（append-only，唯一写通道，实体变更双写同事务）            │
└──────┬──────────────────────────────────────────────────────────────────────┘
       │
┌──────▼────────────────────────── 存储层 ────────────────────────────────────┐
│  todos / requirements / employees / versions / units / exams /             │
│  site_releases / mainlines / events / comments                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**一个地基**：`EventLog`（事件日志）。它不是"辅助功能"，而是整个平台的写通道——
所有模块的状态变更都落一条 Event，历史搜索、时间线、能力画像、里程碑总结、LLM 分析全部从它推导。

---

## 2. 模块清单（职责 / 输入 / 输出 / 依赖）

### 2.1 引擎层（纯函数，无副作用，可单测）

| 模块 | 职责 | 输入 | 输出 |
|---|---|---|---|
| **调度引擎** | 排考避让、容量检查、负载计算 | 单元、考生、负载画像、时间范围 | 可用考试时间段、`StudentLoad[]` |
| **风险引擎** | 五类风险扫描（冲突/过载/欠账/延期/漂移） | 版本、Todo、负载 | `RiskItem[]`（含建议动作） |
| **分析引擎** | 进度/画像/里程碑/热力图/重合计算 | 各实体 + Event | `RequirementProgress`、`CapabilityProfile`、`MilestoneSummary[]`、`LoadHeatmapCell[]`、`SpanOverlap[]` |

**核心原则**：引擎层零副作用——"输入数据 → 输出结果"，不写库、不发通知、不碰 UI。
这样它们可以独立单测，也可以被业务模块、AI 模块、导出模块复用。

### 2.2 应用层（业务模块，编排引擎 + 读写数据）

| 模块 | 职责 | 对应目的 |
|---|---|---|
| **任务管理 TodoModule** | 作业 CRUD、状态流转（按类型校验合法流转）、指派、拆解、检查项、审批；写操作双写 Event | 员工待办 |
| **版本节奏 ReleaseModule** | 版本/单元/考试/局点管理；按 `Mainline.unitTemplate` 一键生成单元排课；登记转测结果与补考；登记局点上线 | 版本管理 |
| **导出 ExportModule** | `buildExport` 生成 `ExportBundle`；**存储富对象 → 导出扁平化**转换；版本/范围/时间窗可选 | 目的1 |
| **AI 集成 AIModule** | 组装 prompt（快照+历史+风险）、调用 LLM、把"每人该干啥"建议转成 Todo 草稿、分类汇总结果落地 | 目的1 |
| **搜索 SearchModule** | 历史事件全文检索（`HistorySearchQuery`）、按实体查时间线 | 目的1 |
| **通知 NotifyModule** | `reminderAt` 提醒、状态变化通知、风险预警推送（watchers/责任人） | 协作 |
| **权限 AuthModule** | 登录、三角色 RBAC（学生/班主任/校长）、操作级权限校验 | 安全 |

### 2.3 视图层（按角色分面，只消费业务模块查询接口，不碰存储）

| 视图 | 角色 | 内容 |
|---|---|---|
| 学生视图 | 员工 | 课程表（今日作业/考试/空闲）、待办清单、能力雷达图、产出特长、历史明细 |
| 班主任视图 | 测试/项目经理 | 风险看板（`scanRisks` 结果 + 一键处置）、排考管理、单元进度 |
| 校长视图 | 版本负责人 | 版本节奏甘特图、多版本考试重合高亮、里程碑总结、局点上线时间轴 |
| 全局看板 | 管理者 | 员工负载热力图、需求进度表（P0 置顶/红灯延期）、版本列表 |
| 历史搜索 | 所有人 | 事件时间线检索，点开即"某件事的完整时间线" |

---

## 3. 模块依赖规则（架构约束）

1. **依赖单向**：视图 → 应用层 → 引擎层 → 数据层。禁止反向依赖，引擎层不 import 任何上层模块。
2. **所有写操作必经 EventLog**：改 Todo 和写 Event 在**同一事务**里完成（本地单机可用同步写简化），保证投影与历史不脱节。
3. **视图不直接访问存储**：只调业务模块查询接口，保证数据口径统一（负载、进度都走引擎算）。
4. **AI 模块只消费导出契约**：AIModule 读 `ExportBundle`，不碰内部存储结构——这保证存储层怎么改都不影响 AI 链路。
5. **写操作后触发风险重扫**：任何状态变更（任务完成/考试定档/单元结束）后，风险引擎重跑受影响范围，新风险进看板并通知。

---

## 4. 三个关键交互流程（时序）

**① 排考（转测定时间）**
```
班主任选单元 + 考生 → ReleaseModule 调 SchedulingEngine.suggestExamSlots
  → 返回避让后的候选时间段 → 班主任确认
  → 写 Unit.exam + Event(exam_scheduled)（同事务）
  → RiskEngine 重扫 → 若有冲突风险，进风险看板
```

**② 任务状态变更**
```
学生改 Todo 状态 → TodoModule 校验类型合法流转
  → 写 Todo(status) + Event(status_changed)（同事务）
  → NotifyModule 通知 watchers/责任人
  → RiskEngine 重扫（可能产生 delay 风险，如考试临近完成率不足）
```

**③ 智能调度（LLM）**
```
校长点"智能调度" → ExportModule.buildExport 生成 ExportBundle（含负载画像+历史+风险）
  → AIModule 组装 prompt 调 LLM → 返回"每人未来一周该干啥"建议列表
  → 建议转成 Todo 草稿（标 AI 来源）→ 班主任/校长确认 → TodoModule 落库
  → RiskEngine 重扫验证无过载
```

---

## 5. 数据层与存储设计

### 5.1 仓储（Repository）

- `TodoRepo` / `RequirementRepo` / `EmployeeRepo` / `VersionRepo` / `UnitRepo` / `ExamRepo` / `SiteRepo` / `MainlineRepo` / `EventRepo`
- 统一封装：乐观锁（`version`）、软删除（`archived`）、审计字段写入。

### 5.2 表设计（关系型示意，字段对应 data-model.ts）

| 表 | 关键字段 |
|---|---|
| `employees` | id, name, role, team_id, capacity_json |
| `requirements` | id, req_no, name, status, priority, version_ids_json, owner_id |
| `todos` | id, number, title, type, status, priority, assignee_id, creator_id, start_at, end_at, due_at, scope_json, links_json, meta_json, parent_id, version, archived, created_at, updated_at |
| `versions` | id, name, mainline_id, stage, freeze_date, release_date, milestones_json, owner_id |
| `units` | id, version_id, name, idx, plan_start, plan_end, status, activities_json, owner_id |
| `exams` | id, unit_id, subject, exam_at, result, defect_count, retake_at, examinees_json |
| `site_releases` | id, version_id, site, env, plan_online_at, actual_online_at, status |
| `mainlines` | id, name, unit_template_json, retake_buffer_days, stage_guide_json |
| `events` | id, at, by_id, entity_type, entity_id, action, from, to, meta_json |
| `comments` | id, todo_id, user_id, content, created_at |

### 5.3 关键索引

- `events (entity_type, entity_id, at)` — 时间线速查
- `events (action, at)` — 里程碑/画像统计
- `todos (status, assignee_id)` — 员工待办/负载
- `todos (version_id)`（scope 拍平后）— 版本任务聚合
- `exams (exam_at)` — 排考冲突检测
- `todos (due_at)` — 延期扫描

---

## 6. 与数据模型/四个目的的映射

| 目的 | 主要模块 | 依赖数据 |
|---|---|---|
| 1. 导出 + LLM 调度 + 汇总 + 历史搜索 | ExportModule → AIModule → SearchModule | EventLog、ExportBundle、CapabilityProfile |
| 2. 全局看板（员工/需求进度、负载分布） | 全局看板视图 + AnalyticsEngine | Requirement、StudentLoad、LoadHeatmapCell |
| 3. 里程碑总结 + 时间线速查 | 校长视图 + AnalyticsEngine + SearchModule | MilestoneSummary、Event |
| 4. 员工待办 + 能力画像 | 学生视图 + AnalyticsEngine | Todo、CapabilityProfile |

---

## 7. 开发顺序建议

1. **引擎层先行**（纯函数、可单测、无依赖）：SchedulingEngine → RiskEngine → AnalyticsEngine
2. **数据层**：仓储 + EventLog（双写事务）
3. **应用层**：TodoModule → ReleaseModule → ExportModule → AIModule
4. **视图层**：学生视图 → 班主任视图 → 全局看板 → 校长视图
