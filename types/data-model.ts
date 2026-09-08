/**
 * ============================================================================
 * 团队版 Todo + 版本管理平台（学校模式） —— 数据模型定稿
 * ============================================================================
 *
 * 架构总览（三层）：
 *
 *   实体层（源数据）  Employee | Requirement | ReleaseVersion(Unit/Exam/Site) | Todo | Event
 *        ↓ 推导
 *   推导层（计算）    StudentLoad | CapabilityProfile | RequirementProgress | RiskItem
 *        ↓ 汇总
 *   出口层（消费）    ExportBundle（快照+历史+风险，LLM 友好） | 时间线 | 里程碑总结
 *
 * 设计原则：
 *   1. 当前状态 = 事件日志的投影，一切"历史、画像、总结"都从 Event 推导，不手工维护；
 *   2. 通用字段收敛，类型专属字段进 meta，新任务类型零成本接入；
 *   3. 内部关联（版本/单元/需求）走 scope，外部追溯（单号/链接/包）走 links；
 *   4. 所有时间存 UTC ISO 8601，展示端转时区；
 *   5. 所有实体带 version(乐观锁) + archived(软删除) + createdAt/updatedAt。
 *
 * ============================================================================
 */

// ============================================================================
// 0. 基础类型
// ============================================================================

/** 主键：内部使用，不展示（展示用各实体的 number/name/reqNo 等可读编号） */
export type ID = string;

/** 时间：统一 UTC ISO 8601 字符串（如 "2025-06-01T08:00:00.000Z"），展示端转本地时区 */
export type ISOString = string;

/** 用户简版引用：完整用户信息在 Employee 实体，这里只存快照引用 */
export interface UserBrief {
  id: string;
  name: string;
  avatar?: string;
}

/** 优先级：全局统一四级 */
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

/** 任务类型注册表（前端下拉/表单/筛选驱动），新增类型在此登记 + 在 Todo.meta 约定表补键名 */
export const TODO_TYPES = [
  'prodChange',   // 现网变更
  'archive',      // 测试环境包归档
  'share',        // 资料/测试串讲
  'docDesign',    // 特性文档设计
  'requirement',  // 需求开发
  'bug',          // BUG 单修复
  'featureFlag',  // 特性开关维护
  'backport',     // 回合分支
  'codeReview',   // 代码巡检优化
  'meeting',      // 会议
  'other',        // 其他
] as const;
export type TodoType = (typeof TODO_TYPES)[number];

// ============================================================================
// 1. Todo（作业/待办）—— 通用单接口，通吃所有任务类型
// ============================================================================

export type TodoStatus =
  | 'todo'        // 待处理
  | 'doing'       // 处理中
  | 'review'      // 待评审/审批（仅部分类型用到）
  | 'done'        // 已完成
  | 'canceled'    // 已取消
  | 'blocked';    // 阻塞（必填 blockedReason）

/** 外部引用：统一追溯通道（需求单/BUG单/变更单/PR/文档/包/内部实体） */
export interface TodoLink {
  type:
    | 'requirement' | 'bug' | 'change' | 'pr' | 'commit'   // 外部系统
    | 'doc' | 'package' | 'url'                             // 制品/文档
    | 'version' | 'unit' | 'requirement';                   // 内部实体
  title: string;
  url?: string;
  refId?: string;   // 外部系统单号 / 内部实体 ID
}

/** 检查项：轻量子任务，重度拆解用 parentId 挂子 Todo */
export interface ChecklistItem {
  id: ID;
  text: string;
  done: boolean;
  doneBy?: ID;        // Employee.id
  doneAt?: ISOString;
}

/** 例行规则：会议、串讲、每周归档等重复事项 */
export interface RecurrenceRule {
  freq: 'daily' | 'weekly' | 'monthly';
  interval?: number;   // 每 N 天/周/月
  until?: ISOString;
}

/**
 * 通用 Todo 接口。
 * - scope：内部关联（查"某版本/某单元/某需求下所有任务"用，看板核心查询键）
 * - links：外部追溯（单号、链接、制品）
 * - meta： 类型专属字段（见下方键名约定表），默认宽松对象，需要强类型时用泛型
 *          type ProdChangeTodo = Todo<ProdChangeMeta>
 */
export interface Todo<M extends Record<string, unknown> = Record<string, unknown>> {
  // ---- 标识 ----
  id: ID;
  number: number;                 // 团队内可读编号，如 1024（展示 #1024）
  title: string;
  description?: string;

  // ---- 分类 ----
  type: TodoType;
  tags: string[];

  // ---- 状态 ----
  status: TodoStatus;
  priority: Priority;
  blockedReason?: string;

  // ---- 时间 ----
  startAt?: ISOString;            // 开始（计划/实际合并）
  endAt?: ISOString;              // 结束
  dueAt?: ISOString;              // 承诺截止（硬性）
  reminderAt?: ISOString;
  recurrence?: RecurrenceRule;

  // ---- 人员与协作 ----
  creator: UserBrief;
  assignee: UserBrief;
  watchers: UserBrief[];
  commentCount: number;           // 评论独立表，只留聚合数

  // ---- 内部关联 ----
  scope: {
    versionId?: ID;               // 所属版本
    unitId?: ID;                  // 所属单元
    requirementId?: ID;           // 所属需求
  };

  // ---- 外部追溯 ----
  links: TodoLink[];
  parentId?: ID;                  // 子任务归属
  checklist?: ChecklistItem[];

  // ---- 类型专属扩展 ----
  meta: M;

  // ---- 审计 ----
  createdAt: ISOString;
  updatedAt: ISOString;
  version: number;                // 乐观锁
  archived: boolean;              // 软删除
}

/**
 * Todo.meta 键名约定表（按 type）—— 新类型先在此登记，再在 TODO_TYPES 注册表加配置。
 * 能用通用字段表达的（时间、人员、links）不重复进 meta。
 *
 * prodChange:  { risk: 'low'|'medium'|'high', changeWindow: { startAt, endAt }, rollbackPlan: string,
 *                changeOrderNo?: string, approverId?: ID, approvalStatus?: 'pending'|'approved'|'rejected' }
 * archive:     { version: string, env: string, packageUrl?: string, branch?: string, archivedAt: ISOString }
 * share:       { happenAt: ISOString, meetingLink?: string, attendeeIds: ID[], materialUrl?: string, summaryUrl?: string }
 * docDesign:   { featureName: string, docUrl?: string, reviewerIds: ID[], reviewStatus: 'draft'|'reviewing'|'approved' }
 * requirement: { reqNo: string, reqDocUrl?: string, modules: string[], iteration?: string, acceptance?: string, dependencies: string[] }
 * bug:         { bugNo: string, severity: 'fatal'|'major'|'minor'|'trivial', module?: string,
 *                reproduce?: string, rootCause?: string, fixBranch?: string, fixCommit?: string }
 * featureFlag: { flagName: string, state: 'on'|'off'|'gray', targetEnv: string[], targetVersion?: string }
 * backport:    { sourceBranch: string, targetBranches: string[], commitRange?: string,
 *                conflicts: string[], verifyStatus: 'pending'|'passed'|'failed' }
 * codeReview:  { rule?: string, files: string[], before?: string, after?: string }
 * meeting:     { subject: string, startAt: ISOString, durationMinutes: number,
 *                attendeeIds: ID[], agenda?: string[], minutesUrl?: string }
 * other:       自由
 */

// ============================================================================
// 2. Employee（员工/学生）—— 负载约束载体 + 能力画像推导源
// ============================================================================

export interface Employee {
  id: ID;
  name: string;
  role: string;                   // '前端' | '测试' | '文档' ...
  teamId?: ID;
  /** 容量约束：调度/风险引擎的硬约束，违反即报过载风险 */
  capacity: {
    maxActiveUnits?: number;      // 最多同时进行单元数（默认 2）
    maxExamsPerWeek?: number;     // 每周最多考试场次（默认 2）
    maxActiveTodos?: number;      // 最多并行作业数（默认 5）
  };
  createdAt: ISOString;
  updatedAt: ISOString;
  version: number;
  archived: boolean;
}

/** 能力画像（推导，不存储）：产出特长 = 历史事件统计 */
export interface CapabilityProfile {
  userId: ID;
  /** 能力分布：按任务类型统计产出与质量 */
  byType: {
    type: TodoType;
    count: number;                // 完成数量
    onTimeRate: number;           // 准时率 0-1
    avgCycleHours: number;        // 平均完成周期（小时）
    avgDefectRate?: number;       // 平均缺陷率（转测挂回率）
  }[];
  /** 特长标签：由 byType 统计推导，如 "变更攻坚" "文档快手" "救火队员" */
  specialties: string[];
  quality: {
    onTimeRate: number;           // 总准时率
    reworkRate: number;           // 返工率
    workloadBalance: number;      // 负载均衡度 0-1（越低越健康）
  };
}

// ============================================================================
// 3. Requirement（需求）—— 从链接升级为实体，"每个需求的进度"要有查询主体
// ============================================================================

export type RequirementStatus = 'planned' | 'developing' | 'testing' | 'done' | 'suspended';

export interface Requirement {
  id: ID;
  reqNo: string;                  // 需求单号（外部系统可追溯）
  name: string;
  status: RequirementStatus;
  priority: Priority;
  versionIds: ID[];               // 涉及哪些版本
  owner: UserBrief;
  links: TodoLink[];              // 设计文档、用例、方案评审
  createdAt: ISOString;
  updatedAt: ISOString;
  version: number;
  archived: boolean;
}

/** 需求进度（推导，不存储）：统计 scope.requirementId === req.id 的 todos */
export interface RequirementProgress {
  done: number;
  total: number;
  percent: number;                // 0-100
  onTime: boolean;
  delayDays: number;              // >0 表示延期天数
}

// ============================================================================
// 4. 版本管理（学校模式：单元 + 考试）
// ============================================================================

/** 版本阶段：由里程碑日期推导（stageOverride 时手工），stageGuide 给"该干啥" */
export type VersionStage =
  | 'planning'      // 需求/规划期（开学前）
  | 'development'   // 开发期（上课+作业）
  | 'testing'       // 测试期（考试季）
  | 'release'       // 发布/现网期（结业交付）
  | 'maintenance';  // 维护/收尾

export interface VersionMilestone {
  key: string;                    // 'freeze' | 'test_entry' | 'release' | 'go_live' ...
  label: string;                  // 展示名："代码冻结" / "转测试" / "版本发布"
  at: ISOString;
}

/** 单元内活动：一节课的完整流程（上课→作业→复习→考试），全部有起止时间 */
export type UnitActivityKind = 'lesson' | 'homework' | 'review' | 'exam';

export interface UnitActivity {
  kind: UnitActivityKind;
  label: string;                  // "需求串讲" / "开发自测" / "回归复习" / "转测试"
  startAt: ISOString;
  endAt: ISOString;
}

/** 考试（转测门禁）：一次可评估、可补考的检查点 */
export interface Exam {
  id: ID;
  unitId: ID;
  subject: string;                // 考试范围：本次转测覆盖哪些需求/模块
  examAt: ISOString;              // 考试时间 = 转测时间
  durationMinutes?: number;
  examinees: UserBrief[];         // 考生：参与本次转测的员工
  result?: 'pass' | 'fail' | 'retake';
  defectCount?: number;           // 成绩：转测发现的缺陷数
  retakeAt?: ISOString;           // 补考时间（挂了之后安排）
  notes?: string;
}

export type UnitStatus = 'upcoming' | 'on_going' | 'exam' | 'done' | 'overdue';

/** 单元：版本内的教学单元（单元一/二/三），替代裸迭代，自带节奏和考试 */
export interface Unit {
  id: ID;
  versionId: ID;
  name: string;                   // "单元一" / "单元二" / "单元三"
  index: number;                  // 单元顺序（1,2,3...）
  planStart?: ISOString;
  planEnd?: ISOString;
  activities: UnitActivity[];     // 排课（由 Mainline.unitTemplate 生成，可微调）
  exam?: Exam;                    // 本单元的考试（转测）
  status: UnitStatus;
  owner?: UserBrief;              // 单元负责人（班主任）
  createdAt: ISOString;
  updatedAt: ISOString;
  version: number;
  archived: boolean;
}

/** 局点上线：同一版本在不同局点分批交付 */
export type SiteStatus = 'pending' | 'in_progress' | 'online' | 'blocked' | 'canceled';

export interface SiteRelease {
  id: ID;
  versionId: ID;
  site: string;                   // 局点名称/编号
  env: string;                    // '现网' | '预生产'
  planOnlineAt?: ISOString;       // 计划上线时间
  actualOnlineAt?: ISOString;     // 实际上线时间
  status: SiteStatus;
  contact?: UserBrief;            // 局点负责人
  notes?: string;
}

/** 版本主实体 */
export interface ReleaseVersion {
  id: ID;
  name: string;                   // "V200R021C10"
  mainlineId: ID;                 // 所属主线（节奏模板来源）
  desc?: string;

  // 版本级关键点
  freezeDate?: ISOString;         // 需求/代码冻结
  releaseDate?: ISOString;        // 版本可交付时间
  milestones: VersionMilestone[]; // 通用里程碑（兜底所有关键时间点）

  // 组成
  units: Unit[];                  // 由单元组成
  siteReleases: SiteRelease[];    // 局点上线安排

  // 阶段：默认 deriveStage(日期推导)；stageOverride=true 时以手工值为准
  stage: VersionStage;
  stageOverride?: boolean;

  owner: UserBrief;
  links: TodoLink[];
  tags: string[];
  createdAt: ISOString;
  updatedAt: ISOString;
  version: number;
  archived: boolean;
}

/** 主线（学期制度）：版本节奏的单一事实来源，新版本一键生成排课 */
export interface Mainline {
  id: ID;
  name: string;                   // '特性主线' | '补丁主线'
  cadenceDays?: number;           // 发布间隔（天），多版本对齐的节奏基准
  /** 每个单元的默认排课模板（相对单元起点偏移） */
  unitTemplate: {
    lessonDays: number;           // 上课几天
    homeworkDays: number;         // 作业几天
    reviewDays: number;           // 复习几天
    examDay: number;              // 第几天考试
  };
  retakeBufferDays: number;       // 补考缓冲期（挂科后几天内安排补考）
  /** 各阶段该干啥（默认动作清单），新版本自动带出 */
  stageGuide: Record<VersionStage, string[]>;
  createdAt: ISOString;
  updatedAt: ISOString;
  version: number;
  archived: boolean;
}

// ============================================================================
// 5. Event（事件日志）—— 平台的地基，历史/画像/时间线/LLM 分析的数据源
// ============================================================================

export type EventEntityType =
  | 'todo' | 'unit' | 'exam' | 'version' | 'requirement' | 'site' | 'employee';

export type EventAction =
  | 'created' | 'updated' | 'deleted' | 'archived'
  | 'status_changed' | 'assigned' | 'priority_changed'
  | 'exam_scheduled' | 'exam_result' | 'retake_scheduled'
  | 'online' | 'milestone_reached' | 'comment';

/** 事件：append-only，只增不改。一切实体状态变化都写一条 */
export interface Event {
  id: ID;
  at: ISOString;                  // 发生时间
  by: UserBrief;                  // 操作人
  entityType: EventEntityType;
  entityId: ID;
  action: EventAction;
  from?: string;                  // 变更前值（状态/负责人/日期）
  to?: string;                    // 变更后值
  meta?: Record<string, unknown>; // 附加：缺陷数、延期天数、考试结果等
}

/** 历史搜索参数（目的1"搜索历史事件信息"的查询面） */
export interface HistorySearchQuery {
  keyword?: string;               // 全文：title/action/label
  entityType?: EventEntityType;
  entityId?: ID;
  action?: EventAction;
  byUserId?: ID;
  from?: ISOString;
  to?: ISOString;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// 6. 推导层 —— 所有指标都是函数计算，不落库（时间一变全是脏数据）
// ============================================================================

/** 员工负载画像（目的2/4）：由 todos + units + exams 实时推导 */
export interface StudentLoad {
  userId: ID;
  activeUnits: number;            // 同时进行的单元数
  activeTodos: number;            // 手头作业数
  examsNextDays: number;          // 未来 N 天考试场次
  busyDays: { date: ISOString; load: number }[];  // 每日负载曲线
  capacity: Employee['capacity']; // 容量约束快照
}

/** 风险项：scanRisks 扫描产物 */
export type RiskKind =
  | 'exam_conflict'    // 排考冲突：同一学生同一天 ≥2 场考试
  | 'overload'         // 过载：并行单元/作业超容量
  | 'debt'             // 欠账：单元结束但作业未完成 → 挂科风险
  | 'delay'            // 延期：考试临近但作业完成率不足
  | 'milestone_shift'; // 里程碑漂移：关键时间点推迟

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskItem {
  id: ID;
  kind: RiskKind;
  level: RiskLevel;
  subject: { entityType: EventEntityType; entityId: ID; label: string };  // 风险主体
  message: string;                // "张三 周三同时有单元二和单元三两场考试"
  suggest: string;                // 建议动作："单元三考试顺延2天" / "转移张三2项作业给李四"
  detectedAt: ISOString;
}

/** 统一时间段：多版本重合计算的输入形状 */
export interface TimelineSpan {
  versionId: ID;
  versionName: string;
  kind: 'iteration_test' | 'site_online' | 'version_window';
  label: string;
  startAt: ISOString;
  endAt?: ISOString;
}

/** 多版本重合结果（推导，不存储） */
export interface SpanOverlap {
  a: TimelineSpan;
  b: TimelineSpan;
  overlap: { startAt: ISOString; endAt?: ISOString };
}

/** 里程碑总结（目的3）：从版本 milestones + 事件流分组推导 */
export interface MilestoneSummary {
  key: string;
  label: string;
  at: ISOString;
  status: 'done' | 'pending' | 'delayed';
  relatedEventIds: ID[];          // 关联事件（时间线速查入口）
}

/** 负载热力图单元（目的2）：人 × 日期 × 负载 */
export interface LoadHeatmapCell {
  userId: ID;
  date: ISOString;
  load: number;                   // 当日负载值（考试+截止任务加权）
  items: { label: string; kind: 'exam' | 'deadline' | 'unit' }[];
}

// ============================================================================
// 7. 导出契约（目的1）—— LLM / 外部系统消费的稳定 schema
// ============================================================================
// 要求：英文键、扁平、无循环引用、快照+历史+风险都带。
//
// 【已确认的架构决策】导出层刻意扁平化：
//   存储层保持富对象（如 Todo.assignee: UserBrief、Todo.scope.versionId），
//   导出层一律拍平（assigneeId / versionId 直接平铺字段）。
//   原因：LLM 和外部系统消费扁平数据更可靠，不要解析嵌套对象；
//   渲染层永远读存储层，导出层只服务于分析与导出。勿改回嵌套。
//
// 给大模型的 prompt 模板："以下是当前版本快照，请根据每个人的负载、截止时间、考试安排，
// 输出未来一周每人应优先做什么，并给出转移/顺延建议（RiskItem.suggest 是候选方案）。"

export interface EmployeeExport {
  id: ID;
  name: string;
  role: string;
  capacity: Employee['capacity'];
  load: StudentLoad;              // 当前负载
  profile: CapabilityProfile;     // 能力画像（产出特长）
}

export interface TodoExport {
  id: ID;
  number: number;
  title: string;
  type: TodoType;
  status: TodoStatus;
  priority: Priority;
  assigneeId: ID;
  dueAt?: ISOString;
  startAt?: ISOString;
  endAt?: ISOString;
  versionId?: ID;
  unitId?: ID;
  requirementId?: ID;
  links: TodoLink[];
  meta: Record<string, unknown>;
}

export interface UnitExport {
  id: ID;
  name: string;
  index: number;
  status: UnitStatus;
  planStart?: ISOString;
  planEnd?: ISOString;
  activities: UnitActivity[];
  exam?: {
    examAt: ISOString;
    subject: string;
    result?: Exam['result'];
    retakeAt?: ISOString;
    defectCount?: number;
  };
}

export interface RequirementExport {
  id: ID;
  reqNo: string;
  name: string;
  status: RequirementStatus;
  priority: Priority;
  progress: RequirementProgress;
  ownerId: ID;
}

/** 一次导出的完整包 */
export interface ExportBundle {
  generatedAt: ISOString;
  meta: {
    mainline: string;
    stage: VersionStage;
    today: ISOString;
    weekStart: ISOString;
    unitCount: number;
  };
  employees: EmployeeExport[];
  requirements: RequirementExport[];
  units: UnitExport[];
  todos: TodoExport[];
  events: Event[];                // 历史事件流（时间线/里程碑/画像分析）
  risks: RiskItem[];              // 当前风险 + 引擎建议
}

// ============================================================================
// 8. 推导函数签名（实现后续单独开发，先锁定契约）
// ============================================================================

// 阶段：版本当前处于哪个阶段（学校模式 = 当前日期落在哪个单元的活动里）
// export function deriveStage(version: ReleaseVersion, now: ISOString): VersionStage
//
// 排考：给新单元排考试时间，自动避开所有考生的已有考试与高负载日
// export function suggestExamSlots(
//   unit: Unit, examinees: UserBrief[], from: ISOString, to: ISOString,
//   loads: StudentLoad[]
// ): ISOString[]
//
// 风险扫描：排考冲突 + 过载 + 欠账 + 延期 + 里程碑漂移
// export function scanRisks(versions: ReleaseVersion[], loads: StudentLoad[]): RiskItem[]
//
// 负载画像 / 热力图
// export function buildStudentLoad(userId: ID, todos: Todo[], units: Unit[], exams: Exam[]): StudentLoad
// export function loadHeatmap(employees: Employee[], todos: Todo[], exams: Exam[]): LoadHeatmapCell[]
//
// 进度 / 画像 / 时间线 / 里程碑
// export function requirementProgress(req: Requirement, todos: Todo[]): RequirementProgress
// export function buildProfile(userId: ID, events: Event[]): CapabilityProfile
// export function getTimeline(entityType: EventEntityType, entityId: ID): Event[]
// export function summarizeMilestones(version: ReleaseVersion, events: Event[]): MilestoneSummary[]
//
// 多版本重合
// export function collectSpans(version: ReleaseVersion): TimelineSpan[]
// export function findOverlaps(versions: ReleaseVersion[]): SpanOverlap[]
//
// 导出
// export function buildExport(versions: ReleaseVersion[], employees: Employee[]): ExportBundle
