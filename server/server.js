/**
 * ============================================================================
 * maos'todo · 研发调度中枢 —— 单文件 MVP
 * 后端 Node（内置 http、零依赖）+ 前端 Vue3（CDN）内嵌 + JSON 存储
 * ============================================================================
 * 运行：node server.js          → http://localhost:24680（冷门端口，避免与 3000/3080 冲突）
 * 数据：./data/db.json，首次启动自动播种演示数据；node server.js --reset 可重置
 *
 * 功能：
 *  - 首次进入输入名字即开启个人待办（存 localStorage，下次自动欢迎）
 *  - hash 路由：#/me 我的工作台（只看自己）/ #/admin 管理台
 *  - 管理台：全局看板 / 任务管理(BUG导入·指派·清单) / 版本节奏(转测/局点) /
 *            风险看板 / 历史检索 / 数据导出与 AI Prompt
 *  - 浅色护眼主题，白底黑字；长文本自动断词不撑破卡片
 * ============================================================================
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

/* ----------------------------- 端口（冷门 24680） ----------------------------- */
const DEFAULT_PORT = 24680;
function normalizePort(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : DEFAULT_PORT;
}
let PORT = process.env.PORT ? normalizePort(process.env.PORT) : DEFAULT_PORT;
/* 防自杀守卫：若端口恰好是 DSH Web GUI 用的端口，自动换回默认，避免挤掉会话 */
try {
  const dshWebPort = Number(new URL(process.env.DSH_WEB_URL || '').port);
  if (dshWebPort && PORT === dshWebPort) { PORT = DEFAULT_PORT; }
} catch (e) { /* DSH_WEB_URL 未设置则忽略 */ }

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DAY = 86400000;

/* ----------------------------- 常量与字典 ----------------------------- */

const TODO_TYPES = [
  { key: 'prodChange',  label: '现网变更', color: '#e11d48' },
  { key: 'archive',     label: '包归档',   color: '#0284c7' },
  { key: 'share',       label: '串讲',     color: '#7c3aed' },
  { key: 'docDesign',   label: '特性文档', color: '#4f46e5' },
  { key: 'requirement', label: '需求开发', color: '#0e7490' },
  { key: 'bug',         label: 'BUG修复',  color: '#db2777' },
  { key: 'featureFlag', label: '特性开关', color: '#059669' },
  { key: 'backport',    label: '回合分支', color: '#e6a23c' },
  { key: 'codeReview',  label: '代码巡检', color: '#0d9488' },
  { key: 'meeting',     label: '会议',     color: '#65a30d' },
  { key: 'other',       label: '其他',     color: '#909399' }
];
const TYPE_MAP = Object.fromEntries(TODO_TYPES.map(t => [t.key, t]));

const STAGE_META = [
  { key: 'planning',    label: '规划期', color: '#909399' },
  { key: 'development', label: '开发期', color: '#0284c7' },
  { key: 'testing',     label: '测试期', color: '#7c3aed' },
  { key: 'release',     label: '发布期', color: '#e6a23c' },
  { key: 'maintenance', label: '维护期', color: '#67c23a' }
];
const STAGE_MAP = Object.fromEntries(STAGE_META.map(s => [s.key, s]));

const STATUS_META = {
  todo:     { label: '待处理', color: '#606266' },
  doing:    { label: '处理中', color: '#409eff' },
  review:   { label: '评审中', color: '#e6a23c' },
  done:     { label: '已完成', color: '#67c23a' },
  canceled: { label: '已取消', color: '#909399' }
};

const PRIORITY_META = {
  P0: { label: '超急', color: '#f56c6c' },
  P1: { label: '一般', color: '#e6a23c' },
  P2: { label: '不急', color: '#e6a23c' },
  P3: { label: '有空再说', color: '#909399' }
};

/* 待办当前进度阶段（卡片 body 用 el-button-group 点选；存 todo.progress）
   BUG 类走缺陷流转：待处理/已分析/修复中/修复完成/已转测；其余需求/任务走研发阶段 */
const PROGRESS_STAGES = ['方案设计', '方案评审', '等交互稿', '代码开发', '双端联调', '转测修单', '发布上线'];
const BUG_PROGRESS_STAGES = ['待处理', '已分析', '修复中', '修复完成', '已转测'];
function progressStagesOf(type) { return type === 'bug' ? BUG_PROGRESS_STAGES : PROGRESS_STAGES; }

/* 公共悬赏：难度等级 → 悬赏点（悬赏点 = 绩效考核参考积分） */
const BOUNTY_DIFFS = [
  { key: 'easy',   label: '简单',   stars: 1, points: 5,   color: '#67c23a' },
  { key: 'normal', label: '普通',   stars: 2, points: 10,  color: '#0284c7' },
  { key: 'medium', label: '中等',   stars: 3, points: 20,  color: '#e6a23c' },
  { key: 'hard',   label: '困难',   stars: 4, points: 40,  color: '#e6a23c' },
  { key: 'expert', label: '攻坚',   stars: 5, points: 80,  color: '#f56c6c' }
];
const BOUNTY_DIFF_MAP = Object.fromEntries(BOUNTY_DIFFS.map(d => [d.key, d]));
const BOUNTY_STATUS = {
  open:    { label: '悬赏中', color: '#67c23a' },
  claimed: { label: '已接取', color: '#0284c7' },
  done:    { label: '已完结', color: '#909399' }
};

/* 估算人天（用于剩余人力 / 月度完成人力等管理台图表） */
const EST_DAYS = { P0: 6, P1: 4, P2: 2.5, P3: 1 };
function estDaysOf(t) { return EST_DAYS[t.priority] != null ? EST_DAYS[t.priority] : 2; }

/* 日期统一 'YYYY-MM-DD'，基于 UTC 日界，避免时区漂移 */
const _NOW = new Date();
const _EPOCH = Math.floor(Date.UTC(_NOW.getFullYear(), _NOW.getMonth(), _NOW.getDate()) / DAY);
function e(n) { return new Date((_EPOCH + n) * DAY).toISOString().slice(0, 10); } // 今天偏移 n 天
function today() { return e(0); }
function nowISO() { return new Date().toISOString(); }
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY); }
/* 日期加天数（YYYY-MM-DD） */
function addDaysStr(d, n) {
  const ms = Date.parse(d + 'T00:00:00Z') + (Number(n) || 0) * DAY;
  return new Date(ms).toISOString().slice(0, 10);
}
/* 版本创建/冻结发布变更时自动补全默认里程碑（冻结→一转测→发布→全量） */
function buildDefaultMilestones(freeze, release) {
  const span = daysBetween(freeze, release);
  const firstTest = addDaysStr(freeze, Math.max(1, Math.floor(span / 3)));
  const goLive = addDaysStr(release, 7);
  return [
    { key: 'freeze', label: '需求冻结', at: freeze },
    { key: 'first_test', label: '迭代一转测', at: firstTest },
    { key: 'release', label: '版本发布', at: release },
    { key: 'go_live', label: '现网全量', at: goLive }
  ];
}

let __seq = 1;
function nid(p) { return (p || 'id') + (__seq++).toString(36); }
/* 服务重启后继续沿用库里已有的最大自增序号，避免新 id 与历史数据撞号 */
function syncSeqFromDb(db) {
  let mx = 1;
  const cols = [db.todos, db.requirements, db.versions, db.units, db.sites, db.employees, db.events, db.userRisks, db.bounties];
  cols.forEach(function(arr){
    (arr || []).forEach(function(o){
      if (!o || !o.id) return;
      const m = String(o.id).match(/^[a-z]+([0-9a-z]+)$/);
      if (!m) return;
      const n = parseInt(m[1], 36);
      if (!isNaN(n) && n >= mx) mx = n + 1;
    });
  });
  __seq = mx;
}

/* ----------------------------- JSON 存储 ----------------------------- */

function defaultDb() {
  return { seq: 1, mainline: null, employees: [], requirements: [], versions: [], units: [], sites: [], todos: [], events: [], acks: [], userRisks: [], bounties: [] };
}

function loadDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) { const db = defaultDb(); seed(db); fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); syncSeqFromDb(db); return db; }
  try { const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); migrateDemo(db); syncSeqFromDb(db); return db; }
  catch (err) { console.error('[maos] 数据文件解析失败，重新播种演示数据'); const db = defaultDb(); seed(db); fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); syncSeqFromDb(db); return db; }
}

/* 兼容旧演示库的一次性迁移：补员工请假记录、给历史已完成任务打散完成时间（用于人力图/请假风险演示）、补悬赏榜 */
function migrateDemo(db) {
  db.employees = db.employees || [];
  db.todos = db.todos || [];
  const LEAVES_BY_ID = {
    e2: [{ from: e(8), to: e(10), type: '病假' }],
    e3: [{ from: e(4), to: e(5), type: '年假' }],
    e5: [{ from: e(14), to: e(15), type: '事假' }]
  };
  db.employees.forEach(em => {
    if (!Array.isArray(em.leaves) && LEAVES_BY_ID[em.id]) em.leaves = LEAVES_BY_ID[em.id];
    if (!Array.isArray(em.leaves)) em.leaves = [];
  });
  const doneTs = [28, 55, 80, 120, 150, 190, 30, 62, 95];
  let k = 0;
  db.todos.forEach(t => {
    if (t.status === 'done' && t.updatedAt === t.createdAt && !t.meta._spreadDone) {
      t.updatedAt = new Date(Date.now() - (doneTs[k % doneTs.length] + k * 7) * DAY).toISOString();
      t.meta = Object.assign({}, t.meta || {}, { _spreadDone: true });
      k++;
    }
  });
  /* 悬赏榜兼容：旧库补 bounties 与员工绩效字段 */
  if (!Array.isArray(db.bounties)) db.bounties = [];
  if (!db.bounties.length && !db.__seededBounty) {
    db.bounties.push(
      { id: 'by1', title: '巡检报表导出偶发卡死的根因定位', desc: '复现后给出根因与修复方案，注明影响面。', type: 'bug', diff: 'expert', points: 80, status: 'open', assigneeId: null, claimedAt: null, doneAt: null, createdBy: 'e1', createdAt: nowISO(), updatedAt: nowISO() },
      { id: 'by2', title: '老版本特性开关兼容回归自查', desc: '把近三个月新增的开关在老版本上过一遍，输出兼容清单。', type: 'codeReview', diff: 'medium', points: 20, status: 'open', assigneeId: null, claimedAt: null, doneAt: null, createdBy: 'e1', createdAt: nowISO(), updatedAt: nowISO() }
    );
  }
  db.__seededBounty = true;
  if (!Array.isArray(db.employees) ) db.employees = [];
  const demoPts = [18, 32, 24, 10, 40, 28];
  const demoDone = [2, 3, 2, 1, 4, 2];
  db.employees.forEach((em, i) => {
    if (typeof em.bountyPoints !== 'number') em.bountyPoints = em.bountyPoints == null && demoPts[i % 6] != null ? demoPts[i % 6] : (em.bountyPoints || 0);
    if (typeof em.bountyDone !== 'number') em.bountyDone = em.bountyDone == null && demoDone[i % 6] != null ? demoDone[i % 6] : (em.bountyDone || 0);
  });
  db.__mig2 = true;
  saveDb(db);
}
function saveDb(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

/* ----------------------------- 事件日志 ----------------------------- */

function entityLabel(db, type, id) {
  if (type === 'todo') { const t = db.todos.find(x => x.id === id); return t ? '任务「' + t.title + '」' : id; }
  if (type === 'unit') { const u = db.units.find(x => x.id === id); return u ? u.name : id; }
  if (type === 'version') { const v = db.versions.find(x => x.id === id); return v ? v.name : id; }
  if (type === 'employee') { const m = db.employees.find(x => x.id === id); return m ? m.name : id; }
  if (type === 'requirement') { const r = db.requirements.find(x => x.id === id); return r ? r.name : id; }
  if (type === 'exam') return '转测';
  if (type === 'bounty') { const b = (db.bounties || []).find(x => x.id === id); return b ? '悬赏「' + b.title + '」' : id; }
  return id;
}
function logEvent(db, ev) {
  db.events.push(Object.assign({ id: nid('ev'), at: nowISO() }, ev));
  if (db.events.length > 2000) db.events.splice(0, db.events.length - 2000);
}
/* ============================================================================
 * 演示种子数据（相对"今天"生成，保证每次演示都是鲜活的节奏）
 * ========================================================================== */
function seed(db) {
  db.seq = 1; __seq = 1;

  /* 主线：迭代节奏模板 + 每个阶段该干嘛 */
  db.mainline = {
    id: 'm1', name: '特性主线', cadenceDays: 42,
    unitTemplate: { lessonDays: 5, homeworkDays: 3, reviewDays: 2, examDay: 10 },
    retakeBufferDays: 3,
    stageGuide: {
      planning: ['需求澄清与范围确认', '特性文档设计', '资料/测试串讲安排'],
      development: ['迭代开发与代码巡检', '自测与联调', '转测评审与用例准备'],
      testing: ['转测执行（准入评审）', '缺陷修复与回归', '复测与验收'],
      release: ['版本归档与发布说明', '局点上线窗口安排', '现网变更执行与监控'],
      maintenance: ['线上问题闭环', '特性开关回收检查', '版本复盘与总结']
    }
  };

  /* 成员（leaves：请假区间，供风险引擎扫描"请假撞排考/撞截止"） */
  const EMP = [
    { id: 'e1', name: '张伟', role: '前端开发', capacity: { maxActiveUnits: 2, maxExamsPerWeek: 1, maxActiveTodos: 5 }, leaves: [] },
    { id: 'e2', name: '李娜', role: '前端开发', capacity: { maxActiveUnits: 2, maxExamsPerWeek: 2, maxActiveTodos: 5 }, leaves: [{ from: e(8), to: e(10), type: '病假' }] },
    { id: 'e3', name: '王强', role: '测试开发', capacity: { maxActiveUnits: 2, maxExamsPerWeek: 2, maxActiveTodos: 6 }, leaves: [{ from: e(4), to: e(5), type: '年假' }] },
    { id: 'e4', name: '赵敏', role: '测试开发', capacity: { maxActiveUnits: 2, maxExamsPerWeek: 1, maxActiveTodos: 4 }, leaves: [] },
    { id: 'e5', name: '陈晨', role: '特性文档', capacity: { maxActiveUnits: 2, maxExamsPerWeek: 1, maxActiveTodos: 3 }, leaves: [{ from: e(14), to: e(15), type: '事假' }] },
    { id: 'e6', name: '刘洋', role: '平台开发', capacity: { maxActiveUnits: 2, maxExamsPerWeek: 2, maxActiveTodos: 6 }, leaves: [] }
  ];
  EMP.forEach(x => db.employees.push(Object.assign({ createdAt: nowISO() }, x)));

  /* 需求：unitId 表示归属哪个迭代（B001/B002…）供 hover 展示 */
  db.requirements.push(
    { id: 'r1', name: '登录体验优化', reqNo: 'REQ-2101', priority: 'P0', status: 'developing', versionId: 'v1', unitId: 'u1', ownerId: 'e1' },
    { id: 'r2', name: '巡检报表增强', reqNo: 'REQ-2102', priority: 'P1', status: 'testing', versionId: 'v1', unitId: 'u2', ownerId: 'e2' },
    { id: 'r3', name: '特性开关控制台', reqNo: 'REQ-2103', priority: 'P2', status: 'planning', versionId: 'v2', unitId: 'u4', ownerId: 'e6' },
    { id: 'r4', name: 'HCSO 平台适配增强', reqNo: 'REQ-2104', priority: 'P1', status: 'developing', versionId: 'v3', unitId: 'u5', ownerId: 'e5' },
    { id: 'r5', name: '现网巡检报表优化', reqNo: 'REQ-2105', priority: 'P2', status: 'done', versionId: 'v4', unitId: null, ownerId: 'e2' }
  );

  /* 版本：kind = 研发 dev / 上线 live；series = HC / HCS / HCSO（研发细分系列）
     v1/v2/v3 并行研发（演示多 HC/HCS/HCSO 并行与时间线重合），v4 是已上线的版本 */
  db.versions.push(
    { id: 'v1', name: 'V200R021C10', kind: 'dev', series: 'HC', mainlineId: 'm1', freeze: e(-22), release: e(18),
      milestones: [
        { key: 'freeze', label: '需求冻结', at: e(-22) },
        { key: 'first_test', label: '迭代一转测', at: e(-11) },
        { key: 'release', label: '版本发布', at: e(18) },
        { key: 'go_live', label: '局点全量上线', at: e(30) }
      ], ownerId: 'e1' },
    { id: 'v2', name: 'V200R021C20', kind: 'dev', series: 'HCS', mainlineId: 'm1', freeze: e(-4), release: e(20),
      milestones: [
        { key: 'freeze', label: '需求冻结', at: e(-4) },
        { key: 'first_test', label: '迭代一转测', at: e(5) },
        { key: 'release', label: '版本发布', at: e(20) },
        { key: 'go_live', label: '局点全量上线', at: e(34) }
      ], ownerId: 'e6' },
    { id: 'v3', name: 'V200R021C30', kind: 'dev', series: 'HCSO', mainlineId: 'm1', freeze: e(-10), release: e(24),
      milestones: [
        { key: 'freeze', label: '需求冻结', at: e(-10) },
        { key: 'first_test', label: '迭代一转测', at: e(4) },
        { key: 'release', label: '版本发布', at: e(24) },
        { key: 'go_live', label: '局点全量上线', at: e(38) }
      ], ownerId: 'e5' },
    { id: 'v4', name: 'V200R021C10·现网', kind: 'live', series: 'HC', mainlineId: 'm1', freeze: e(-60), release: e(-30),
      milestones: [
        { key: 'freeze', label: '需求冻结', at: e(-60) },
        { key: 'first_test', label: '迭代一转测', at: e(-45) },
        { key: 'release', label: '版本发布', at: e(-30) },
        { key: 'go_live', label: '局点全量上线', at: e(-25) }
      ], ownerId: 'e1' }
  );

  /* 迭代（单元）：phases 用于时间线渲染；exam=null 表示还没排转测 */
  function unit(id, versionId, name, index, planStart, planEnd, phases, exam) {
    const u = { id, versionId, name, index, planStart, planEnd, phases, exam: exam || null, createdAt: nowISO() };
    db.units.push(u); return u;
  }
  const ph = (kind, label, start, end) => ({ kind, label, start, end: end || start });

  unit('u1', 'v1', 'B001 · 基础框架', 1, e(-26), e(-11), [
    ph('lesson', '开发', e(-26), e(-20)), ph('homework', '自测', e(-19), e(-17)),
    ph('review', '回归', e(-16), e(-13)), ph('exam', '转测', e(-11))
  ], { examAt: e(-11), subject: 'HC·B001 转测', examinees: ['e1', 'e2', 'e3'], result: 'pass', defectCount: 3, retakeAt: null, scheduledAt: e(-12) });

  unit('u2', 'v1', 'B002 · 特性开发', 2, e(-6), e(5), [
    ph('lesson', '开发', e(-6), e(-1)), ph('homework', '自测', e(0), e(2)),
    ph('review', '回归', e(3), e(4)), ph('exam', '转测', e(5))
  ], { examAt: e(5), subject: 'HC·B002 转测', examinees: ['e1', 'e2', 'e3'], result: null, defectCount: null, retakeAt: null, scheduledAt: e(-2) });

  unit('u3', 'v1', 'B003 · 收尾特性', 3, e(8), e(19), [
    ph('lesson', '开发', e(8), e(12)), ph('homework', '自测', e(13), e(15)),
    ph('review', '回归', e(16), e(17)), ph('exam', '转测', e(19))
  ], null); // 待排考 → 演示"建议排考"

  /* V2(HCS)：与 V1·B002 同一天转测 → 制造排考冲突演示风险引擎 */
  unit('u4', 'v2', 'B001 · 控制台', 1, e(-2), e(5), [
    ph('lesson', '开发', e(-2), e(3)), ph('review', '转测准备', e(4), e(4)), ph('exam', '转测', e(5))
  ], { examAt: e(5), subject: 'HCS·B001 转测', examinees: ['e1', 'e3', 'e5'], result: null, defectCount: null, retakeAt: null, scheduledAt: e(-1) });

  /* V3(HCSO)：并行第三个研发版本 */
  unit('u5', 'v3', 'B001 · 适配底座', 1, e(0), e(10), [
    ph('lesson', '开发', e(0), e(6)), ph('homework', '自测', e(7), e(8)),
    ph('review', '回归', e(9), e(9)), ph('exam', '转测', e(10))
  ], { examAt: e(10), subject: 'HCSO·B001 转测', examinees: ['e2', 'e4', 'e5'], result: null, defectCount: null, retakeAt: null, scheduledAt: e(3) });

  unit('u6', 'v3', 'B002 · 集成联调', 2, e(12), e(22), [
    ph('lesson', '开发', e(12), e(18)), ph('review', '转测准备', e(19), e(21)), ph('exam', '转测', e(22))
  ], null);

  /* 局点上线 */
  db.sites.push(
    { id: 's1', versionId: 'v1', site: '华东 · 上海局点', env: '现网', planOnlineAt: e(18), actualOnlineAt: null },
    { id: 's2', versionId: 'v1', site: '华南 · 深圳局点', env: '现网', planOnlineAt: e(30), actualOnlineAt: null },
    { id: 's3', versionId: 'v2', site: '华北 · 北京局点', env: '现网', planOnlineAt: e(34), actualOnlineAt: null }
  );

  /* 待办：跨成员/需求/版本/迭代，状态与截止故意留风险点给引擎扫 */
  const T = [
    { id: 't01', title: '登录页 React 组件重构', type: 'requirement', priority: 'P0', status: 'done', assigneeId: 'e1', dueAt: e(-14), requirementId: 'r1', versionId: 'v1', unitId: 'u1', tags: ['登录', '重构'] },
    { id: 't02', title: '会话保持与单点登录联调', type: 'requirement', priority: 'P0', status: 'done', assigneeId: 'e2', dueAt: e(-12), requirementId: 'r1', versionId: 'v1', unitId: 'u1', tags: ['登录'] },
    { id: 't03', title: '修复 BUG#8821 登录态丢失', type: 'bug', priority: 'P0', status: 'done', assigneeId: 'e3', dueAt: e(-11), requirementId: 'r1', versionId: 'v1', unitId: 'u1', tags: ['缺陷'], meta: { bugNo: 'BUG-8821', severity: '严重' } },
    { id: 't04', title: '迭代一转测缺陷回归闭环', type: 'bug', priority: 'P1', status: 'review', assigneeId: 'e4', dueAt: e(-9), requirementId: 'r2', versionId: 'v1', unitId: 'u1', tags: ['缺陷', '回归'], meta: { bugNo: 'BUG-8840', severity: '一般' } },
    { id: 't05', title: '巡检报表导出 Excel 实现', type: 'requirement', priority: 'P1', status: 'doing', assigneeId: 'e2', dueAt: e(2), requirementId: 'r2', versionId: 'v1', unitId: 'u2', tags: ['报表'] },
    { id: 't06', title: '巡检任务调度服务开发', type: 'requirement', priority: 'P1', status: 'doing', assigneeId: 'e6', dueAt: e(2), requirementId: 'r2', versionId: 'v1', unitId: 'u2', tags: ['调度'] },
    { id: 't07', title: '新登录流程 E2E 用例编写', type: 'share', priority: 'P1', status: 'doing', assigneeId: 'e3', dueAt: e(3), requirementId: 'r1', versionId: 'v1', unitId: 'u2', tags: ['测试串讲'] },
    { id: 't08', title: '特性文档 V2 评审修订', type: 'docDesign', priority: 'P2', status: 'doing', assigneeId: 'e5', dueAt: e(4), requirementId: 'r1', versionId: 'v1', unitId: 'u2', tags: ['文档'] },
    { id: 't09', title: '巡检报表定时任务回合到 R21C10', type: 'backport', priority: 'P1', status: 'review', assigneeId: 'e6', dueAt: e(-1), versionId: 'v1', unitId: 'u2', tags: ['回合分支'], meta: { sourceBranch: 'master', targetBranches: ['R21C10'] } },
    { id: 't10', title: '代码巡检问题整改（内联样式/魔法数字）', type: 'codeReview', priority: 'P3', status: 'doing', assigneeId: 'e1', dueAt: e(1), versionId: 'v1', unitId: 'u2', tags: ['巡检'] },
    { id: 't11', title: '现网变更：告警阈值调整', type: 'prodChange', priority: 'P0', status: 'review', assigneeId: 'e6', dueAt: e(1), versionId: 'v1', unitId: 'u2', tags: ['现网变更'], meta: { changeNo: 'CHG-118', risk: '低', rollbackPlan: '回切旧配置' } },
    { id: 't12', title: '特性开关：报表模块灰度放量', type: 'featureFlag', priority: 'P1', status: 'doing', assigneeId: 'e6', dueAt: e(0), versionId: 'v1', unitId: 'u2', tags: ['特性开关'], meta: { flagName: 'report_gray', state: '10%' } },
    { id: 't13', title: '测试环境 V1.2.3 包归档', type: 'archive', priority: 'P2', status: 'todo', assigneeId: 'e4', dueAt: e(1), versionId: 'v1', unitId: 'u2', tags: ['归档'], meta: { version: '1.2.3', env: 'test1' } },
    { id: 't14', title: '迭代二转测问题收敛日报', type: 'meeting', priority: 'P2', status: 'todo', assigneeId: 'e3', dueAt: e(5), versionId: 'v1', unitId: 'u2', tags: ['会议'] },
    { id: 't15', title: '迭代三：登录数据看板需求开发', type: 'requirement', priority: 'P1', status: 'todo', assigneeId: 'e1', dueAt: e(15), requirementId: 'r1', versionId: 'v1', unitId: 'u3', tags: ['数据看板'] },
    { id: 't16', title: '迭代三：报表性能压测方案', type: 'share', priority: 'P2', status: 'todo', assigneeId: 'e3', dueAt: e(16), requirementId: 'r2', versionId: 'v1', unitId: 'u3', tags: ['测试串讲'] },
    { id: 't17', title: '特性开关控制台框架搭建', type: 'requirement', priority: 'P2', status: 'doing', assigneeId: 'e1', dueAt: e(3), requirementId: 'r3', versionId: 'v2', unitId: 'u4', tags: ['控制台'] },
    { id: 't18', title: '开关控制台 API 与权限模型', type: 'requirement', priority: 'P2', status: 'doing', assigneeId: 'e6', dueAt: e(3), requirementId: 'r3', versionId: 'v2', unitId: 'u4', tags: ['控制台'] },
    { id: 't19', title: '控制台前端页面开发', type: 'requirement', priority: 'P2', status: 'todo', assigneeId: 'e2', dueAt: e(5), requirementId: 'r3', versionId: 'v2', unitId: 'u4', tags: ['控制台'] },
    { id: 't20', title: '控制台设计评审串讲材料', type: 'share', priority: 'P3', status: 'todo', assigneeId: 'e5', dueAt: e(4), requirementId: 'r3', versionId: 'v2', unitId: 'u4', tags: ['资料串讲'] },
    { id: 't21', title: '修复 BUG#8890 开关列表刷新闪烁', type: 'bug', priority: 'P1', status: 'todo', assigneeId: 'e1', dueAt: e(5), versionId: 'v2', unitId: 'u4', tags: ['缺陷'], meta: { bugNo: 'BUG-8890', severity: '一般' } },
    { id: 't22', title: 'V2 版本资料串讲会议', type: 'meeting', priority: 'P3', status: 'done', assigneeId: 'e5', dueAt: e(-3), versionId: 'v2', unitId: 'u4', tags: ['会议'] },
    { id: 't23', title: '现网巡检报表优化回执闭环', type: 'requirement', priority: 'P2', status: 'done', assigneeId: 'e2', dueAt: e(-40), requirementId: 'r5', versionId: 'v4', unitId: null, tags: ['现网'] }
  ];
  const createdAt = nowISO();
  T.forEach(t => {
    db.todos.push(Object.assign({ createdAt, updatedAt: createdAt, description: '', meta: t.meta || {}, parentId: null, today: false, dndUntil: null }, t));
  });
  /* 演示：把已完成任务的完成时间散布到过去数月（月度完成人力图有历史可看） */
  const doneTs = [28, 55, 80, 120, 150, 190, 30, 62, 95];
  db.todos.filter(t => t.status === 'done').forEach((t, i) => {
    const d = new Date(Date.now() - (doneTs[i % doneTs.length] + i * 7) * DAY).toISOString();
    t.updatedAt = d;
  });
  /* 演示：给 t05 一个进行中的免打扰时段（45 分钟），方便你看到专注倒计时效果 */
  const t05 = db.todos.find(x => x.id === 't05');
  if (t05) t05.dndUntil = new Date(Date.now() + 45 * 60000).toISOString();

  /* 悬赏榜单：公共悬赏池 + 演示绩效（悬赏点 = 绩效考核参考） */
  db.employees.forEach((em, i) => {
    em.bountyPoints = Math.round([18, 32, 24, 10, 40, 28][i % 6] * 10) / 10;
    em.bountyDone = [2, 3, 2, 1, 4, 2][i % 6];
  });
  db.bounties.push(
    { id: 'by1', title: '巡检报表导出偶发卡死的根因定位', desc: '复现后给出根因与修复方案，注明影响面。', type: 'bug', diff: 'expert', points: 80, status: 'open', assigneeId: null, claimedAt: null, doneAt: null, createdBy: 'e1', createdAt: nowISO(), updatedAt: nowISO() },
    { id: 'by2', title: '老版本特性开关兼容回归自查', desc: '把近三个月新增的开关在老版本上过一遍，输出兼容清单。', type: 'codeReview', diff: 'medium', points: 20, status: 'open', assigneeId: null, claimedAt: null, doneAt: null, createdBy: 'e1', createdAt: nowISO(), updatedAt: nowISO() },
    { id: 'by3', title: '新登录流程 E2E 用例补全', desc: '覆盖登出/多标签/会话过期三条路径。', type: 'share', diff: 'hard', points: 40, status: 'claimed', assigneeId: 'e3', claimedAt: nowISO(), doneAt: null, createdBy: 'e1', createdAt: nowISO(), updatedAt: nowISO() },
    { id: 'by4', title: '告警阈值调整文档沉淀', desc: '整理本次现网变更的评估记录到共享文档。', type: 'prodChange', diff: 'easy', points: 5, status: 'done', assigneeId: 'e6', claimedAt: nowISO(), doneAt: nowISO(), createdBy: 'e1', createdAt: nowISO(), updatedAt: nowISO() }
  );
  const by3todo = { id: nid('t'), title: '悬赏：新登录流程 E2E 用例补全', type: 'share', priority: 'P2', status: 'todo', assigneeId: 'e3', creatorId: 'e1', dueAt: e(4), requirementId: null, unitId: null, versionId: null, tags: ['悬赏'], meta: { bountyId: 'by3' }, links: [], parentId: null, today: false, dndUntil: null, createdAt: nowISO(), updatedAt: nowISO() };
  db.todos.push(by3todo);

  /* 播种一批历史事件，让"历史检索/时间线"有内容 */
  db.todos.forEach((t, i) => {
    logEvent(db, { entityType: 'todo', entityId: t.id, action: 'created', by: t.assigneeId, from: null, to: null, detail: '创建任务：' + t.title, at: new Date(Date.now() - (40 - i) * 3600000).toISOString() });
  });
  db.events.sort((a, b) => (a.at < b.at ? -1 : 1));
  logEvent(db, { entityType: 'version', entityId: 'v1', action: 'milestone', by: 'sys', detail: '里程碑：需求冻结（V200R021C10）', at: new Date(Date.now() - 22 * DAY).toISOString() });
  logEvent(db, { entityType: 'unit', entityId: 'u1', action: 'exam_result', by: 'e3', detail: '迭代一转测通过（缺陷 3 个已闭环）', at: new Date(Date.now() - 11 * DAY).toISOString() });
  logEvent(db, { entityType: 'exam', entityId: 'u2', action: 'exam_scheduled', by: 'e4', detail: '迭代二转测已排期：' + e(5), at: new Date(Date.now() - 2 * DAY).toISOString() });
  logEvent(db, { entityType: 'exam', entityId: 'u4', action: 'exam_scheduled', by: 'e3', detail: 'V2 迭代一转测已排期：' + e(5), at: new Date(Date.now() - DAY).toISOString() });
}
/* ============================================================================
 * 引擎：负载 / 画像 / 进度 / 阶段 / 排考冲突 / 风险（纯函数）
 * ========================================================================== */

const EXAM_WEIGHT = 3, DUE_WEIGHT = 2;
function activeTodos(db) { return db.todos.filter(t => t.status !== 'done' && t.status !== 'canceled'); }

/** 员工负载：活动任务 / 并行迭代 / 近 7 天转测 / 7 日忙闲曲线 */
function buildLoad(db, emp) {
  const act = activeTodos(db).filter(t => t.assigneeId === emp.id);
  const todayS = today();
  const activeUnits = db.units.filter(u =>
    u.planStart <= todayS && u.planEnd >= todayS && !(u.exam && u.exam.result === 'pass')
  ).length;
  const next7 = [];
  for (let i = 0; i < 7; i++) {
    const d = e(i);
    const items = [];
    let load = 0;
    act.filter(t => t.dueAt === d).forEach(t => { load += DUE_WEIGHT; items.push({ kind: 'due', label: t.title + '（截止）', color: '#e6a23c' }); });
    db.units.forEach(u => {
      if (!u.exam || u.exam.examAt !== d) return;
      if (u.exam.examinees.includes(emp.id)) { load += EXAM_WEIGHT; items.push({ kind: 'exam', label: u.name + ' 转测', color: '#be185d' }); }
    });
    next7.push({ date: d, load: Math.min(load, 9), items });
  }
  const exams7 = db.units.filter(u => u.exam && u.exam.examinees.includes(emp.id) && u.exam.examAt >= todayS && u.exam.examAt <= e(7)).length;
  return { activeTodos: act.length, activeUnits, examsNext7Days: exams7, busy: next7, capacity: emp.capacity };
}

/** 能力画像：按类型的产出分布 + 特长标签 */
function buildProfile(db, empId) {
  const mine = db.todos.filter(t => t.assigneeId === empId);
  const done = mine.filter(t => t.status === 'done');
  const byType = TODO_TYPES.map(tp => {
    const list = done.filter(t => t.type === tp.key);
    if (!list.length) return null;
    const onTime = list.filter(t => !t.dueAt || t.updatedAt.slice(0, 10) <= t.dueAt).length;
    return { type: tp.key, label: tp.label, color: tp.color, count: list.length, onTimeRate: Math.round(onTime / list.length * 100) };
  }).filter(Boolean).sort((a, b) => b.count - a.count);
  const SPECIAL = {
    bug: '缺陷攻坚', prodChange: '现网变更', requirement: '需求交付', docDesign: '文档设计',
    share: '串讲担当', codeReview: '代码巡检', backport: '分支回合', featureFlag: '特性开关',
    archive: '归档管家', meeting: '会议组织', other: '多面手'
  };
  const specialties = byType.slice(0, 3).map(b => SPECIAL[b.type] || b.label);
  const active = activeTodos(db).filter(t => t.assigneeId === empId).length;
  const em = db.employees.find(x => x.id === empId);
  const allDone = done.length;
  const onTimeAll = done.filter(t => !t.dueAt || t.updatedAt.slice(0, 10) <= t.dueAt).length;
  return {
    byType, specialties, doneCount: allDone,
    onTimeRate: allDone ? Math.round(onTimeAll / allDone * 100) : 100,
    activeCount: active,
    loadRatio: em && em.capacity.maxActiveTodos ? Math.round(active / em.capacity.maxActiveTodos * 100) : 0
  };
}

/** 需求进度 */
function buildReqProgress(db, r) {
  const list = db.todos.filter(t => t.requirementId === r.id);
  const done = list.filter(t => t.status === 'done').length;
  return { total: list.length, done, percent: list.length ? Math.round(done / list.length * 100) : 0, open: list.length - done };
}

/** 版本阶段：里程碑驱动（冻结→开发 / 一转测→测试 / 发布→发布 / 上线→维护） */
function buildStage(db, v) {
  const t = today();
  const get = key => { const m = v.milestones.find(x => x.key === key); return m ? m.at : null; };
  if (!get('freeze')) return 'planning';
  if (t < get('freeze')) return 'planning';
  if (t < get('first_test')) return 'development';
  if (t < get('release')) return 'testing';
  if (t < get('go_live')) return 'release';
  return 'maintenance';
}

/** 转测冲突：同一人同一天 ≥2 场转测 */
function examConflicts(db) {
  const conflicts = [];
  const byDate = {};
  db.units.forEach(u => { if (u.exam) { (byDate[u.exam.examAt] = byDate[u.exam.examAt] || []).push(u); } });
  Object.keys(byDate).forEach(d => {
    const list = byDate[d];
    if (list.length < 2) return;
    const empHit = {};
    list.forEach(u => u.exam.examinees.forEach(em => { empHit[em] = empHit[em] || []; empHit[em].push(u); }));
    Object.keys(empHit).forEach(em => {
      if (empHit[em].length < 2) return;
      const emp = db.employees.find(x => x.id === em);
      conflicts.push({
        empId: em, empName: emp ? emp.name : em, date: d,
        units: empHit[em].map(u => { const v = db.versions.find(vv => vv.id === u.versionId); return (v ? v.name + ' · ' : '') + u.name; })
      });
    });
  });
  return conflicts;
}

function unitAssignees(db, unit) {
  const ids = db.todos.filter(t => t.unitId === unit.id && t.status !== 'canceled').map(t => t.assigneeId);
  return Array.from(new Set(ids.length ? ids : ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']));
}

/** 某迭代建议转测日期：未来工作日、避开参与者已有转测，最多 3 个 */
function suggestExamSlots(db, unit) {
  const examinees = unit.exam ? unit.exam.examinees : unitAssignees(db, unit);
  const used = {};
  db.units.forEach(u => { if (u.exam) u.exam.examinees.forEach(em => { if (examinees.includes(em)) used[u.exam.examAt] = true; }); });
  const out = [];
  const start = Math.max(0, daysBetween(today(), unit.planEnd) + 1);
  for (let i = start, guard = 0; out.length < 3 && guard < 40; i++, guard++) {
    const d = e(i);
    const wd = new Date(Date.parse(d + 'T00:00:00Z')).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (used[d]) continue;
    out.push(d);
  }
  return out;
}

/* ----------------------------- 风险引擎 ----------------------------- */

function scanRisks(db) {
  const risks = [];
  const push = (level, kind, title, message, suggestion, entityType, entityId) => {
    risks.push({ id: 'rk_' + kind + '_' + entityId + '_' + message.length, level, kind, title, message, suggestion, entityType, entityId });
  };
  const t = today();
  const act = activeTodos(db);

  /* 1) 过载 */
  db.employees.forEach(em => {
    const ld = buildLoad(db, em);
    const cap = em.capacity;
    if (ld.activeTodos > (cap.maxActiveTodos || 5)) {
      push('high', 'overload', '任务过载', em.name + ' 手头有 ' + ld.activeTodos + ' 个活动任务，超过容量 ' + cap.maxActiveTodos, '拆分/转移/延后非关键任务，优先保超急/一般', 'employee', em.id);
    }
    if (ld.activeUnits > (cap.maxActiveUnits || 2)) {
      push('medium', 'overload', '迭代并行过多', em.name + ' 同时处于 ' + ld.activeUnits + ' 个迭代', '关注多版本并行期间的任务密度', 'employee', em.id);
    }
    if (ld.examsNext7Days > (cap.maxExamsPerWeek || 2)) {
      push('high', 'overload', '周转测超限', em.name + ' 未来 7 天有 ' + ld.examsNext7Days + ' 场转测，超过周容量', '合并/顺延转测，或重新排考', 'employee', em.id);
    }
  });

  /* 3) 欠账：迭代已结束仍有未完成任务 */
  db.units.forEach(u => {
    if (u.planEnd >= t) return;
    const undone = act.filter(x => x.unitId === u.id);
    if (!undone.length) return;
    const v = db.versions.find(vv => vv.id === u.versionId);
    push('high', 'debt', '迭代欠账', (v ? v.name + ' · ' : '') + u.name + ' 已结束（' + u.planEnd + '），仍有 ' + undone.length + ' 项未完成', '列欠账清单，安排复测或转入下个迭代消化', 'unit', u.id);
  });

  /* 4) 延期 */
  act.forEach(todo => {
    if (!todo.dueAt) return;
    const dd = daysBetween(todo.dueAt, t);
    if (dd < 0) {
      push(dd <= -3 ? 'high' : 'medium', 'delay', '任务延期', '「' + todo.title + '」已超期 ' + (-dd) + ' 天', '更新预计完成时间，评估调整范围或转交', 'todo', todo.id);
    } else if (dd <= 1 && (todo.priority === 'P0' || todo.priority === 'P1')) {
      const pl = (PRIORITY_META[todo.priority] || {}).label || todo.priority;
      push('medium', 'delay', '临近截止', '「' + todo.title + '」' + (dd === 0 ? '今天' : '明天') + '截止（' + pl + '）', '优先处理，必要时请求支援', 'todo', todo.id);
    }
  });

  /* 5) 里程碑漂移 */
  db.versions.forEach(v => {
    const stage = buildStage(db, v);
    const ms = v.milestones.find(m => m.key === 'first_test');
    const u1 = db.units.filter(u => u.versionId === v.id && u.index === 1);
    if (ms && ms.at <= t && stage === 'development' && u1.every(u => !u.exam || !u.exam.result)) {
      push('medium', 'milestone_shift', '转测里程碑漂移', v.name + ' 已过一转测节点（' + ms.at + '）但迭代一转测还没完成', '推进转测准备，必要时调整里程碑', 'version', v.id);
    }
    const relMs = v.milestones.find(m => m.key === 'release');
    if (relMs) {
      const dd = daysBetween(relMs.at, t);
      if (dd >= 0 && dd <= 5 && stage !== 'release' && stage !== 'maintenance') {
        push('high', 'milestone_shift', '发布窗口临近', v.name + ' 距计划发布只剩 ' + dd + ' 天，当前处于' + (STAGE_MAP[stage] ? STAGE_MAP[stage].label : stage), '收敛需求范围，加快转测与回归节奏', 'version', v.id);
      }
    }
  });

  /* 5) 人员请假：请假区间撞转测 / 撞 P0P1 截止 / 覆盖在岗任务 */
  db.employees.forEach(em => {
    (em.leaves || []).forEach(lv => {
      if (!lv || !lv.from) return;
      const from = lv.from, to = lv.to || lv.from;
      const span = daysBetween(from, to) + 1;
      if (span <= 0 || from > e(14)) return;               // 只看近两周内的假期
      const list = [];
      const nearTodo = act.filter(x => x.assigneeId === em.id && x.dueAt && x.dueAt >= from && x.dueAt <= to && (x.priority === 'P0' || x.priority === 'P1'));
      nearTodo.forEach(x => list.push('「' + x.title + '」' + x.dueAt + ' 截止'));
      const hitExam = [];
      db.units.forEach(u => {
        if (!u.exam || !u.exam.examAt || u.exam.examAt < from || u.exam.examAt > to) return;
        if (u.exam.examinees.includes(em.id)) { const vv = db.versions.find(w => w.id === u.versionId); hitExam.push((vv ? vv.name + '·' : '') + u.name + ' ' + u.exam.examAt + ' 转测'); }
      });
      hitExam.forEach(s => list.push(s));
      if (!list.length && span <= 3) return;
      const lvType = lv.type || '请假';
      const head = em.name + ' 请' + lvType + '（' + from + (to === from ? '' : ' ~ ' + to) + '，共 ' + span + ' 天）';
      push(hitExam.length ? 'critical' : (nearTodo.length ? 'high' : 'medium'), 'leave', '人员请假',
        head + (list.length ? '，与在岗安排冲突：' + list.join('；') : '，期间暂无硬性排期，留意覆盖'),
        hitExam.length ? '协调转测人员轮换或顺延转测' : (nearTodo.length ? '请假期间安排他人跟进截止任务' : '提前与成员确认在岗覆盖，必要时找人替补'), 'employee', em.id);
    });
  });

  /* 6) 个人上报风险（处理中任务里点「报风险」产生，进管理台风险看板） */
  (db.userRisks || []).forEach(ur => {
    risks.push(Object.assign({ id: ur.id, level: ur.level || 'high', kind: ur.kind || 'user_report', title: ur.title, message: ur.message, suggestion: ur.suggestion, entityType: 'todo', entityId: ur.entityId }, ur));
  });

  return risks.filter(r => !db.acks.includes(r.id)).sort((a, b) => { const L = { critical: 0, high: 1, medium: 2, low: 3 }; return L[a.level] - L[b.level]; });
}
/* ============================================================================
 * 状态组装（/api/state —— 前端单一数据源，全部派生在服务端算好）
 * ========================================================================== */

const ACTION_META = {
  created:         { label: '创建', color: '#67c23a' },
  status_changed:  { label: '状态变更', color: '#0284c7' },
  bounty_created:  { label: '悬赏发布', color: '#7c3aed' },
  bounty_claim:    { label: '接取悬赏', color: '#e6a23c' },
  bounty_done:     { label: '悬赏完成', color: '#67c23a' },
  bounty_return:   { label: '退回悬赏', color: '#e6a23c' },
  exam_scheduled:  { label: '转测排期', color: '#7c3aed' },
  exam_result:     { label: '转测结果', color: '#be185d' },
  milestone:       { label: '里程碑', color: '#e6a23c' },
  online:          { label: '上线', color: '#67c23a' },
  comment:         { label: '评论', color: '#909399' },
  deleted:         { label: '删除', color: '#f56c6c' },
  other:           { label: '事件', color: '#909399' }
};

function empName(db, id) { const m = db.employees.find(x => x.id === id); return m ? m.name : id; }

function relLabel(dateStr, todayS) {
  if (!dateStr) return '';
  const dd = daysBetween(dateStr, todayS);
  if (dd === 0) return '今天';
  if (dd === 1) return '明天';
  if (dd === -1) return '昨天';
  if (dd > 1) return dd + ' 天后';
  return '已过 ' + (-dd) + ' 天';
}

function enrichTodo(db, t) {
  const tm = TYPE_MAP[t.type] || TYPE_MAP.other;
  const sm = STATUS_META[t.status] || { label: t.status, color: '#909399' };
  const pm = PRIORITY_META[t.priority] || { label: t.priority, color: '#909399' };
  const unit = db.units.find(u => u.id === t.unitId);
  const ver = db.versions.find(v => v.id === t.versionId);
  const req = db.requirements.find(r => r.id === t.requirementId);
  const bugNoRaw = (t.meta && t.meta.bugNo) ? String(t.meta.bugNo) : null;
  const bugLink = (t.links || []).find(l => l.type === 'bug');
  /* BUG 单详情跳转：优先用导入时的链接，否则按 bug 平台地址规则拼接 */
  const bugUrl = bugLink && bugLink.url
    ? bugLink.url
    : (bugNoRaw ? 'https://clouddevops.huawei.com/#/bug/' + encodeURIComponent(bugNoRaw) : null);
  const reqNo = (req && req.reqNo) ? String(req.reqNo) : null;
  const unitNameRaw = unit && unit.name ? String(unit.name) : '';
  const unitShort = unitNameRaw.indexOf('·') >= 0 ? unitNameRaw.split('·')[0].trim() : unitNameRaw;
  return Object.assign({}, t, {
    typeLabel: tm.label, typeColor: tm.color,
    statusLabel: sm.label, statusColor: sm.color,
    priorityLabel: pm.label, priorityColor: pm.color,
    assigneeName: empName(db, t.assigneeId),
    creatorName: empName(db, t.creatorId),
    unitName: unit ? ((ver ? ver.name + ' · ' : '') + unit.name) : (ver ? ver.name : ''),
    reqName: req ? req.name : '',
    reqNo,
    reqUrl: reqNo ? 'https://clouddevops.huawei.com/workitem/' + encodeURIComponent(reqNo) : null,
    verName: ver ? ver.name : '',
    unitShort,
    unitPlanStart: unit ? unit.planStart : null,
    unitPlanEnd: unit ? unit.planEnd : null,
    unitExamAt: (unit && unit.exam && unit.exam.examAt) ? unit.exam.examAt : null,
    unitExamSubject: (unit && unit.exam && unit.exam.subject) ? unit.exam.subject : null,
    dueLabel: relLabel(t.dueAt, today()),
    dueDiff: t.dueAt ? daysBetween(t.dueAt, today()) : null,
    bugNo: bugNoRaw,
    bugUrl,
    sourceVersion: (t.meta && t.meta.sourceVersion) ? t.meta.sourceVersion : null,
    /* 悬赏来源：接取的公共悬赏单（个人卡上展示"🏆 悬赏 · 难度等级"） */
    bounty: (t.meta && t.meta.bountyId) ? (function(){
      const b = (db.bounties || []).find(x => x.id === t.meta.bountyId);
      if (!b) return null;
      const dm = BOUNTY_DIFF_MAP[b.diff] || BOUNTY_DIFFS[0];
      return { id: b.id, title: b.title, points: b.points, status: b.status, diff: b.diff, diffLabel: dm.label, stars: dm.stars, diffColor: dm.color };
    })() : null,
    /* 版本系列（HC/HCS/HCSO/上线/其他）——个人玫瑰图与列表联动过滤用；可被手工编辑的 verSeries 覆盖 */
    series: (function(){
      const manual = t.meta && t.meta.verSeries;
      if (manual && ['HC', 'HCS', 'HCSO', '上线', '其他'].includes(manual)) return manual;
      return ver ? (ver.series || (ver.kind === 'live' ? '上线' : '其他')) : '其他';
    })(),
    /* 估算人天：按优先级给权值（P0 重、P3 轻），人力分布/剩余人天图用 */
    estDays: estDaysOf(t),
    today: !!t.today,
    dndUntil: t.dndUntil || null,
    dndLeftMs: (t.dndUntil && new Date(t.dndUntil).getTime() > Date.now()) ? (new Date(t.dndUntil).getTime() - Date.now()) : 0
  });
}

function unitStatus(db, u) {
  const t = today();
  if (u.exam && u.exam.result === 'pass') return { code: 'passed', label: '已转测通过', color: '#67c23a' };
  if (u.planEnd < t) return { code: 'overdue', label: '已结束 · 待闭环', color: '#f56c6c' };
  if (u.planStart <= t && t <= u.planEnd) return { code: 'ongoing', label: '进行中', color: '#0284c7' };
  return { code: 'upcoming', label: '未开始', color: '#909399' };
}

function versionView(db, v) {
  const stage = buildStage(db, v);
  const sm = STAGE_MAP[stage];
  const units = db.units.filter(u => u.versionId === v.id).sort((a, b) => a.index - b.index)
    .map(u => {
      const st = unitStatus(db, u);
      const examView = u.exam ? Object.assign({}, u.exam, {
        examinees: u.exam.examinees.map(id => empName(db, id)),
        examAtLabel: u.exam.examAt + (relLabel(u.exam.examAt, today()) ? '（' + relLabel(u.exam.examAt, today()) + '）' : '')
      }) : null;
      /* 该迭代要交付的需求（hover 展示用） */
      const reqs = db.requirements.filter(r => r.unitId === u.id).map(r => ({
        id: r.id, name: r.name, reqNo: r.reqNo, priority: r.priority, status: r.status,
        ownerName: empName(db, r.ownerId), percent: buildReqProgress(db, r).percent
      }));
      return Object.assign({}, u, { status: st, examView, suggest: u.exam ? [] : suggestExamSlots(db, u), assignees: unitAssignees(db, u).map(id => empName(db, id)), reqs });
    });
  const sites = db.sites.filter(s => s.versionId === v.id).map(s => Object.assign({}, s, {
    state: s.actualOnlineAt ? { label: '已上线', color: '#67c23a' } : (s.planOnlineAt <= today() ? { label: '到期待上线', color: '#f56c6c' } : { label: '待上线', color: '#909399' }),
    planLabel: relLabel(s.planOnlineAt, today())
  }));
  const milestones = v.milestones.map(m => { const passed = m.at <= today(); return Object.assign({}, m, { passed, rel: relLabel(m.at, today()), done: passed }); });
  return Object.assign({}, v, { stage, stageLabel: sm.label, stageColor: sm.color, units, sites, milestones });
}

function eventView(db, ev) {
  const am = ACTION_META[ev.action] || ACTION_META.other;
  const by = ev.by === 'sys' ? '系统' : empName(db, ev.by);
  return Object.assign({}, ev, { actionLabel: am.label, actionColor: am.color, byName: by, entityLabel: entityLabel(db, ev.entityType, ev.entityId) });
}

/* 悬赏单视图（管理台榜单用）：难度/点数/状态/接取人 已就绪 */
function bountyView(db, b) {
  const d = BOUNTY_DIFF_MAP[b.diff] || BOUNTY_DIFFS[0];
  const st = BOUNTY_STATUS[b.status] || BOUNTY_STATUS.open;
  return Object.assign({}, b, {
    diffLabel: d.label, stars: d.stars, diffColor: d.color,
    statusLabel: st.label, statusColor: st.color,
    assigneeName: b.assigneeId ? empName(db, b.assigneeId) : '',
    createdByName: empName(db, b.createdBy)
  });
}

function buildState(db) {
  const employees = db.employees.map(emp => Object.assign({}, emp, { load: buildLoad(db, emp), profile: buildProfile(db, emp.id) }));
  const requirements = db.requirements.map(r => {
    const o = db.employees.find(x => x.id === r.ownerId);
    return Object.assign({}, r, { ownerName: o ? o.name : '', progress: buildReqProgress(db, r) });
  });
  const versions = db.versions.map(v => versionView(db, v));
  const todos = db.todos.map(t => enrichTodo(db, t));
  const events = db.events.slice(-150).reverse().map(ev => eventView(db, ev));
  const risks = scanRisks(db);
  const conflicts = examConflicts(db);
  const bounties = (db.bounties || []).map(b => bountyView(db, b));
  const todayS = today();
  const counts = { byStatus: { todo: 0, doing: 0, review: 0, done: 0, canceled: 0 }, byType: {} };
  todos.forEach(t => { counts.byStatus[t.status] = (counts.byStatus[t.status] || 0) + 1; counts.byType[t.type] = (counts.byType[t.type] || 0) + 1; });
  const examsUpcoming = [];
  db.units.forEach(u => {
    if (u.exam && u.exam.examAt >= todayS) {
      const v = db.versions.find(vv => vv.id === u.versionId);
      examsUpcoming.push({ unitId: u.id, date: u.exam.examAt, subject: u.exam.subject, versionName: v ? v.name : '', unitName: u.name, rel: relLabel(u.exam.examAt, todayS) });
    }
  });
  examsUpcoming.sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    today: todayS,
    mainline: db.mainline,
    employees, requirements, versions, todos, events, risks, conflicts, counts, examsUpcoming, bounties,
    dicts: { types: TODO_TYPES, stages: STAGE_META, statuses: STATUS_META, priorities: PRIORITY_META, actionMeta: ACTION_META, bountyDiffs: BOUNTY_DIFFS }
  };
}

/* ============================================================================
 * 导出契约（LLM 友好：扁平、快照+历史+风险）
 * ========================================================================== */
function buildExport(db) {
  const employees = db.employees.map(emp => {
    const load = buildLoad(db, emp);
    const profile = buildProfile(db, emp.id);
    return {
      id: emp.id, name: emp.name, role: emp.role, capacity: emp.capacity,
      load: {
        activeTodos: load.activeTodos, activeUnits: load.activeUnits, examsNext7Days: load.examsNext7Days,
        busy: load.busy.map(b => ({ date: b.date, load: b.load, items: b.items.map(i => ({ label: i.label, kind: i.kind })) }))
      },
      profile: { specialties: profile.specialties, byType: profile.byType, onTimeRate: profile.onTimeRate, doneCount: profile.doneCount },
      bounty: { points: Math.round((emp.bountyPoints || 0) * 10) / 10, done: emp.bountyDone || 0 }
    };
  });
  const requirements = db.requirements.map(r => { const p = buildReqProgress(db, r); return { id: r.id, name: r.name, reqNo: r.reqNo, priority: r.priority, status: r.status, ownerId: r.ownerId, progress: p }; });
  const versions = db.versions.map(v => { const stage = buildStage(db, v); return { id: v.id, name: v.name, freeze: v.freeze, release: v.release, stage, stageLabel: (STAGE_MAP[stage] || {}).label, milestones: v.milestones }; });
  const units = db.units.map(u => {
    const v = db.versions.find(vv => vv.id === u.versionId);
    return {
      id: u.id, versionId: u.versionId, versionName: v ? v.name : '', name: u.name, index: u.index,
      planStart: u.planStart, planEnd: u.planEnd, phases: u.phases,
      exam: u.exam ? { examAt: u.exam.examAt, subject: u.exam.subject, examinees: u.exam.examinees, result: u.exam.result, defectCount: u.exam.defectCount, retakeAt: u.exam.retakeAt } : null
    };
  });
  const todos = db.todos.map(t => ({
    id: t.id, title: t.title, type: t.type, priority: t.priority, status: t.status,
    assigneeId: t.assigneeId, dueAt: t.dueAt, requirementId: t.requirementId, unitId: t.unitId,
    versionId: t.versionId, tags: t.tags, meta: t.meta || {}, today: !!t.today, dndUntil: t.dndUntil || null
  }));
  const risks = scanRisks(db).map(r => ({ id: r.id, kind: r.kind, level: r.level, title: r.title, message: r.message, suggestion: r.suggestion }));
  const bounties = (db.bounties || []).map(b => bountyView(db, b));
  const recent = db.events.slice(-100).map(ev => ({ at: ev.at, by: ev.by, action: ev.action, entityType: ev.entityType, entityId: ev.entityId, detail: ev.detail }));
  return {
    generatedAt: nowISO(), today: today(),
    meta: { mainline: db.mainline.name, unitTemplate: db.mainline.unitTemplate, retakeBufferDays: db.mainline.retakeBufferDays },
    employees, requirements, versions, units, todos, sites: db.sites, risks, conflicts: examConflicts(db), bounties, events: recent
  };
}

/* ============================================================================
 * AI 调度 Prompt（导出后可直接投喂大模型）
 * ========================================================================== */
function buildPrompt(db) {
  const s = buildState(db);
  const L = [];
  L.push('你是研发版本调度助手，请基于以下数据做调度与风险管控分析。');
  L.push('背景：一个版本包含多个迭代，每个迭代末尾有一次转测（测试准入评审）。目标是避免成员过载、保持节奏、提前暴露风险。');
  L.push('');
  L.push('【当前时间】' + s.today + '  主线：' + s.mainline.name);
  L.push('');
  s.versions.forEach(v => {
    L.push('【版本】' + v.name + ' 阶段：' + v.stageLabel + '（' + v.stage + '） 冻结:' + v.freeze + ' 发布:' + v.release);
    v.milestones.forEach(m => L.push('  里程碑: ' + m.label + ' @ ' + m.at + (m.passed ? ' [已到]' : ' [未到]')));
    v.units.forEach(u => {
      const ex = u.examView ? ('转测@' + u.examView.examAt + ' 结果:' + (u.examView.result || '未考') + (u.examView.result === 'fail' ? ' 复测:' + (u.examView.retakeAt || '未定') : '')) : '（还没排考，建议日期: ' + (u.suggest.join(', ') || '无') + '）';
      L.push('  迭代 ' + u.name + ' [' + u.status.label + '] ' + u.planStart + '~' + u.planEnd + ' ' + ex);
    });
    v.sites.forEach(se => L.push('  局点: ' + se.site + ' ' + se.env + ' 计划上线 ' + se.planOnlineAt + ' ' + se.state.label));
  });
  L.push('');
  L.push('【需求进度】');
  s.requirements.forEach(r => L.push('  ' + r.name + ' (' + r.reqNo + ') ' + r.priority + ' ' + r.status + ' 完成 ' + r.progress.done + '/' + r.progress.total + ' ' + r.progress.percent + '%'));
  L.push('');
  L.push('【成员负载与能力】');
  s.employees.forEach(e => {
    const cap = e.capacity;
    L.push('  ' + e.name + '(' + e.role + ') 活动任务 ' + e.load.activeTodos + '/' + (cap.maxActiveTodos || '∞') + ' 并行迭代 ' + e.load.activeUnits + '/' + (cap.maxActiveUnits || '∞') + ' 近7天转测 ' + e.load.examsNext7Days + '/' + (cap.maxExamsPerWeek || '∞'));
    L.push('    忙闲: ' + e.load.busy.map(b => b.date.slice(5) + ':' + (b.load ? b.load + '级' : '-')).join(' '));
    if (e.profile.specialties.length) L.push('    特长: ' + e.profile.specialties.join('、') + '  准时率 ' + e.profile.onTimeRate + '%');
  });
  L.push('');
  L.push('【未完成任务】');
  s.todos.filter(t => t.status !== 'done' && t.status !== 'canceled').sort((a, b) => (a.dueDiff || 99) - (b.dueDiff || 99)).forEach(t => {
    L.push('  - ' + t.title + ' | ' + t.typeLabel + ' | ' + t.priorityLabel + ' | 负责人:' + t.assigneeName + ' | 截止:' + (t.dueAt || '无') + (t.dueLabel ? '（' + t.dueLabel + '）' : '') + ' | ' + t.statusLabel);
  });
  L.push('');
  L.push('【转测冲突】' + (s.conflicts.length ? JSON.stringify(s.conflicts) : '无'));
  L.push('【风险清单】');
  s.risks.forEach(r => L.push('  [' + r.level.toUpperCase() + '] ' + r.message + ' → 建议:' + r.suggestion));
  L.push('');
  L.push('请输出：');
  L.push('1. 每个成员未来一周的调度建议（按天，注明转测/截止/并行迭代）；');
  L.push('2. 过载成员与缓解动作（转移任务给谁/顺延哪些转测）；');
  L.push('3. 版本节奏风险与应对；');
  L.push('4. 汇总为 JSON：employees[].{id,name,actions[]} 与 risks[].{action}。');
  return L.join('\n');
}

/* ============================================================================
 * BUG 单导入：按责任人名字匹配成员，自动入待办；已有同号 BUG 则更新
 * ========================================================================== */
function importBugs(db, payload) {
  const rows = (payload && payload.data && payload.data.result) || (payload && payload.result) || [];
  if (!Array.isArray(rows) || !rows.length) return { error: '没解析到 data.result 数组，请检查 JSON 结构' };
  const report = { total: rows.length, created: 0, updated: 0, skipped: 0, unmatchedNames: [], details: [] };
  rows.forEach(b => {
    if (!b || !b.number) { report.skipped++; return; }
    const number = String(b.number);
    const title = b.title || ('BUG单 ' + number);
    const versionTitle = b.fromVersion && b.fromVersion.title ? b.fromVersion.title : '';
    const creatorName = b.created_by && b.created_by.name ? b.created_by.name : '';
    const returnReason = b.return_record ? (b.return_record.return_reason || '') : '';
    const sysLink = b.return_record ? (b.return_record.source_system_link || '') : '';
    const bugUrl = 'https://clouddevops.huawei.com/#/bug/' + number;
    const ownerNames = (Array.isArray(b.current_owners) && b.current_owners.length)
      ? b.current_owners.map(o => o && o.name).filter(Boolean)
      : (Array.isArray(b.owners) ? b.owners.map(o => o && o.name).filter(Boolean) : []);
    if (!ownerNames.length) { report.skipped++; report.details.push({ number, action: 'skipped', note: '无责任人' }); return; }
    ownerNames.forEach(name => {
      const emp = db.employees.find(x => x.name === name);
      if (!emp) { report.unmatchedNames.push(name); report.skipped++; return; }
      const descParts = [];
      if (versionTitle) descParts.push('来源版本：' + versionTitle);
      if (creatorName) descParts.push('提单人：' + creatorName);
      if (returnReason) descParts.push('返回原因：' + returnReason);
      if (sysLink) descParts.push('关联：' + sysLink);
      const meta = { bugNo: number, sourceVersion: versionTitle || null, returnReason: returnReason || null, sourceSystemLink: sysLink || null };
      const linkObj = { type: 'bug', title: 'BUG ' + number, url: bugUrl, refId: number };
      const existing = db.todos.find(t => t.assigneeId === emp.id && t.meta && t.meta.bugNo === number);
      if (existing) {
        existing.title = title;
        existing.description = descParts.join('\n');
        existing.meta = Object.assign({}, existing.meta, meta);
        existing.links = [linkObj];
        existing.updatedAt = nowISO();
        if (existing.status === 'done' || existing.status === 'canceled') existing.status = 'todo';
        logEvent(db, { entityType: 'todo', entityId: existing.id, action: 'status_changed', by: emp.id, from: 'import', to: existing.status, detail: 'BUG ' + number + ' 导入更新：' + title });
        report.updated++;
        report.details.push({ number, assignee: name, action: 'updated' });
      } else {
        const todo = {
          id: nid('t'), title, description: descParts.join('\n'), type: 'bug',
          priority: 'P1', status: 'todo', assigneeId: emp.id, creatorId: emp.id,
          dueAt: null, requirementId: null, unitId: null, versionId: null,
          tags: ['BUG导入'], meta, links: [linkObj], parentId: null,
          createdAt: nowISO(), updatedAt: nowISO()
        };
        db.todos.push(todo);
        logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'created', by: emp.id, detail: '导入 BUG ' + number + '：' + title });
        report.created++;
        report.details.push({ number, assignee: name, action: 'created' });
      }
    });
  });
  if (report.created || report.updated) saveDb(db);
  report.unmatchedNames = Array.from(new Set(report.unmatchedNames));
  return report;
}
/* ============================================================================
 * HTTP 服务与路由
 * ========================================================================== */

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (err) { reject(err); } });
    req.on('error', reject);
  });
}

function json(res, code, obj) { const body = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(body); }

const NEXT_STATUS = {
  todo: ['doing', 'canceled'],       /* 未开始：只能先「开始处理」，没有开始哪来的完成 */
  doing: ['done'],                   /* 处理中：直接完成（已去掉阻塞求助） */
  review: ['doing', 'done'],
  done: ['todo'],
  canceled: ['todo']
};

async function handleApi(req, res, db, u) {
  const parts = u.pathname.split('/').filter(Boolean);
  const method = req.method;

  if (method === 'GET' && parts[1] === 'state') return json(res, 200, buildState(db));
  if (method === 'GET' && parts[1] === 'export') return json(res, 200, buildExport(db));
  if (method === 'GET' && parts[1] === 'prompt') { const text = buildPrompt(db); res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(text); return; }

  /* GET /api/search?q=&type= */
  if (method === 'GET' && parts[1] === 'search') {
    const q = (u.searchParams.get('q') || '').trim();
    const type = u.searchParams.get('type') || '';
    let list = db.events.slice();
    if (type) list = list.filter(ev => ev.entityType === type);
    if (q) list = list.filter(ev => (ev.detail || '').indexOf(q) >= 0 || entityLabel(db, ev.entityType, ev.entityId).indexOf(q) >= 0);
    return json(res, 200, list.slice(-100).reverse().map(ev => eventView(db, ev)));
  }

  /* GET /api/timeline?type=&id= */
  if (method === 'GET' && parts[1] === 'timeline') {
    const list = db.events.filter(ev => ev.entityType === u.searchParams.get('type') && ev.entityId === u.searchParams.get('id'));
    return json(res, 200, list.map(ev => eventView(db, ev)));
  }

  if (method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  const body = await readBody(req);

  /* POST /api/bugs/import */
  if (parts[1] === 'bugs' && parts[2] === 'import') {
    const report = importBugs(db, body.payload || body);
    return report.error ? json(res, 400, report) : json(res, 200, report);
  }

  /* POST /api/bounty —— 发布公共悬赏 */
  if (parts[1] === 'bounty' && !parts[2]) {
    const title = (body.title || '').trim();
    if (!title) return json(res, 400, { error: '悬赏标题必填' });
    const diff = BOUNTY_DIFF_MAP[body.diff] ? body.diff : 'normal';
    const diffMeta = BOUNTY_DIFF_MAP[diff];
    const b = {
      id: nid('by'), title, desc: (body.desc || '').trim(),
      type: body.type || 'other', diff,
      points: diffMeta.points,
      status: 'open', assigneeId: null, claimedAt: null, doneAt: null,
      createdBy: body.by || (body.assigneeId || 'sys'),
      createdAt: nowISO(), updatedAt: nowISO()
    };
    db.bounties = db.bounties || [];
    db.bounties.push(b);
    logEvent(db, { entityType: 'bounty', entityId: b.id, action: 'bounty_created', by: b.createdBy, detail: '发布悬赏（' + diffMeta.label + '·' + diffMeta.points + ' 分）：' + title });
    saveDb(db);
    return json(res, 200, { ok: true, id: b.id });
  }

  /* POST /api/bounty/:id/claim —— 接取悬赏：给成员挂一条未完成任务 */
  if (parts[1] === 'bounty' && parts[2] && parts[3] === 'claim') {
    const b = (db.bounties || []).find(x => x.id === parts[2]);
    if (!b) return json(res, 404, { error: 'bounty not found' });
    if (b.status !== 'open') return json(res, 400, { error: '该悬赏已被接取或已完结' });
    const emp = db.employees.find(x => x.id === body.assigneeId);
    if (!emp) return json(res, 400, { error: '请选择要接取悬赏的成员' });
    b.status = 'claimed'; b.assigneeId = emp.id; b.claimedAt = nowISO(); b.updatedAt = nowISO();
    const diffMeta = BOUNTY_DIFF_MAP[b.diff] || BOUNTY_DIFFS[0];
    const t = {
      id: nid('t'), title: '悬赏：' + b.title, description: b.desc || '', type: b.type,
      priority: diffMeta.stars >= 4 ? 'P1' : (diffMeta.stars >= 3 ? 'P2' : 'P3'),
      status: 'todo', assigneeId: emp.id, creatorId: b.createdBy,
      dueAt: null, requirementId: null, unitId: null, versionId: null,
      tags: ['悬赏'], meta: { bountyId: b.id },
      links: [], parentId: null, today: false, dndUntil: null,
      createdAt: nowISO(), updatedAt: nowISO()
    };
    db.todos.push(t);
    logEvent(db, { entityType: 'bounty', entityId: b.id, action: 'bounty_claim', by: emp.id, detail: emp.name + ' 接取悬赏（' + diffMeta.label + '·' + b.points + ' 分）：' + b.title });
    logEvent(db, { entityType: 'todo', entityId: t.id, action: 'created', by: emp.id, detail: '接取悬赏自动入未完成事项：' + t.title });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/bounty/:id/return —— 退回悬赏（悬赏重开，任务作废） */
  if (parts[1] === 'bounty' && parts[2] && parts[3] === 'return') {
    const b = (db.bounties || []).find(x => x.id === parts[2]);
    if (!b) return json(res, 404, { error: 'bounty not found' });
    if (b.status !== 'claimed') return json(res, 400, { error: '只有已接取的悬赏能退回' });
    const empId = b.assigneeId;
    const t = db.todos.find(x => x.meta && x.meta.bountyId === b.id && x.status !== 'done' && x.status !== 'canceled');
    if (t) { t.status = 'canceled'; t.updatedAt = nowISO(); }
    b.status = 'open'; b.assigneeId = null; b.claimedAt = null; b.updatedAt = nowISO();
    logEvent(db, { entityType: 'bounty', entityId: b.id, action: 'bounty_return', by: 'sys', detail: (empId ? empName(db, empId) + ' 退回悬赏：' : '悬赏退回：') + b.title });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/bounty/:id/delete —— 删除（仅悬赏中） */
  if (parts[1] === 'bounty' && parts[2] && parts[3] === 'delete') {
    const idx = (db.bounties || []).findIndex(x => x.id === parts[2]);
    if (idx < 0) return json(res, 404, { error: 'bounty not found' });
    const b = db.bounties[idx];
    if (b.status !== 'open') return json(res, 400, { error: '只有悬赏中的单子能删除，已接取请先退回' });
    db.bounties.splice(idx, 1);
    logEvent(db, { entityType: 'bounty', entityId: b.id, action: 'deleted', by: 'sys', detail: '删除悬赏：' + b.title });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/todo —— 新建任务 */
  if (parts[1] === 'todo' && !parts[2]) {
    const t = body;
    if (!t.title || !t.assigneeId || !t.type) return json(res, 400, { error: '缺少必填字段(title/assigneeId/type)' });
    const todo = {
      id: nid('t'), title: t.title, description: t.description || '', type: t.type,
      priority: t.priority || 'P2', status: 'todo',
      assigneeId: t.assigneeId, creatorId: t.creatorId || t.assigneeId,
      dueAt: t.dueAt || null, requirementId: t.requirementId || null,
      unitId: t.unitId || null, versionId: t.versionId || null,
      tags: t.tags || [], meta: Object.assign({}, t.meta || {}), links: t.links || [], parentId: null,
      progress: (t.progress && progressStagesOf(t.type).includes(t.progress)) ? t.progress : '',
      today: !!t.today, dndUntil: null,
      createdAt: nowISO(), updatedAt: nowISO()
    };
    db.todos.push(todo);
    logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'created', by: todo.creatorId, detail: '创建任务：' + todo.title });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/todo/:id/status */
  if (parts[1] === 'todo' && parts[2] && parts[3] === 'status') {
    const todo = db.todos.find(x => x.id === parts[2]);
    if (!todo) return json(res, 404, { error: 'todo not found' });
    if (!(NEXT_STATUS[todo.status] || []).includes(body.status)) return json(res, 400, { error: '非法流转: ' + todo.status + ' -> ' + body.status });
    const from = todo.status;
    todo.status = body.status;
    /* 重开/取消的单子回到未开始后不再占今日盘子 */
    if (body.status === 'todo') todo.today = false;
    /* 完成时刻 doneAt：转为 done 时打点；离开 done（重开/取消）时清掉 */
    if (body.status === 'done') todo.doneAt = todo.doneAt || nowISO();
    else if (from === 'done') delete todo.doneAt;
    todo.updatedAt = nowISO();
    /* 悬赏任务完成 → 结算发放悬赏点（绩效参考） */
    if (body.status === 'done' && todo.meta && todo.meta.bountyId) {
      const b = (db.bounties || []).find(x => x.id === todo.meta.bountyId);
      if (b && b.status === 'claimed' && b.assigneeId === todo.assigneeId) {
        b.status = 'done'; b.doneAt = nowISO(); b.updatedAt = nowISO();
        const em = db.employees.find(e => e.id === b.assigneeId);
        if (em) {
          em.bountyPoints = Math.round(((em.bountyPoints || 0) + b.points) * 10) / 10;
          em.bountyDone = (em.bountyDone || 0) + 1;
        }
        logEvent(db, { entityType: 'bounty', entityId: b.id, action: 'bounty_done', by: b.assigneeId, detail: '悬赏完成发放 ' + b.points + ' 分：' + b.title });
      }
    }
    logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'status_changed', by: todo.assigneeId, from, to: body.status, detail: '任务状态：' + (STATUS_META[from] || {}).label + ' → ' + (STATUS_META[body.status] || {}).label });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/todo/:id/delete —— 删除任务（留痕） */
  if (parts[1] === 'todo' && parts[2] && parts[3] === 'delete') {
    const idx = db.todos.findIndex(x => x.id === parts[2]);
    if (idx < 0) return json(res, 404, { error: 'todo not found' });
    const todo = db.todos[idx];
    db.todos.splice(idx, 1);
    logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'deleted', by: body.by || todo.assigneeId, detail: '删除任务：' + todo.title });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/todo/:id/today —— 放进/移出"今日待办" */
  if (parts[1] === 'todo' && parts[2] && parts[3] === 'today') {
    const todo = db.todos.find(x => x.id === parts[2]);
    if (!todo) return json(res, 404, { error: 'todo not found' });
    todo.today = !!body.today;
    todo.updatedAt = nowISO();
    logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'status_changed', by: todo.assigneeId, detail: (body.today ? '加入今日待办：' : '移出今日待办：') + todo.title });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/todo/:id/progress —— 更新卡片上的进度阶段（el-button-group 点选） */
  if (parts[1] === 'todo' && parts[2] && parts[3] === 'progress') {
    const todo = db.todos.find(x => x.id === parts[2]);
    if (!todo) return json(res, 404, { error: 'todo not found' });
    const p = String(body.progress || '');
    if (p && !progressStagesOf(todo.type).includes(p)) return json(res, 400, { error: '无效的进度阶段：' + p });
    todo.progress = p;
    todo.updatedAt = nowISO();
    logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'status_changed', by: todo.assigneeId, detail: '更新进度：' + (p || '未开始') + '（' + todo.title + '）' });
    saveDb(db);
    return json(res, 200, { ok: true, progress: p });
  }

  /* POST /api/todo/:id/dnd —— 免打扰：minutes>0 开启(设截止)，否则关闭 */
  if (parts[1] === 'todo' && parts[2] && parts[3] === 'dnd') {
    const todo = db.todos.find(x => x.id === parts[2]);
    if (!todo) return json(res, 404, { error: 'todo not found' });
    const minutes = Number(body.minutes);
    todo.dndUntil = (Number.isFinite(minutes) && minutes > 0) ? new Date(Date.now() + minutes * 60000).toISOString() : null;
    todo.updatedAt = nowISO();
    logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'status_changed', by: todo.assigneeId, detail: (todo.dndUntil ? '开启专注（' + minutes + ' 分钟）：' : '结束专注：') + todo.title });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/todo/:id/update —— 编辑待办（标题/类型/优先级/截止/版本线/备注/对接人） */
  if (parts[1] === 'todo' && parts[2] && parts[3] === 'update') {
    const todo = db.todos.find(x => x.id === parts[2]);
    if (!todo) return json(res, 404, { error: 'todo not found' });
    if (body.title != null && String(body.title).trim()) todo.title = String(body.title).trim();
    if (body.type) todo.type = body.type;
    if (body.priority) todo.priority = body.priority;
    if (body.dueAt !== undefined) todo.dueAt = body.dueAt || null;
    if (body.description !== undefined) todo.description = body.description || '';
    const meta = Object.assign({}, todo.meta || {});
    /* 版本线：HC/HCS/HCSO/上线/其他/''(自动跟随版本) */
    if (body.series !== undefined) {
      if (body.series) meta.verSeries = body.series;
      else delete meta.verSeries;
    }
    if (body.peerDev !== undefined) meta.peerDev = body.peerDev || '';
    if (body.peerTest !== undefined) meta.peerTest = body.peerTest || '';
    todo.meta = meta;
    todo.updatedAt = nowISO();
    logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'status_changed', by: todo.assigneeId, detail: '编辑待办：' + todo.title });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/todo/:id/shelf —— 暂时搁置：从今日待办移出，回到「未完成事项」 */
  if (parts[1] === 'todo' && parts[2] && parts[3] === 'shelf') {
    const todo = db.todos.find(x => x.id === parts[2]);
    if (!todo) return json(res, 404, { error: 'todo not found' });
    if (todo.status !== 'todo') return json(res, 400, { error: '只有未开始的单子能暂时搁置（当前 ' + todo.status + '）' });
    todo.today = false;
    todo.updatedAt = nowISO();
    logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'status_changed', by: todo.assigneeId, detail: '暂时搁置（移出今日待办）：' + todo.title });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/todo/:id/start —— 开始处理：未开始/评审中的单子转「处理中」，并自动加入今日待办 */
  if (parts[1] === 'todo' && parts[2] && parts[3] === 'start') {
    const todo = db.todos.find(x => x.id === parts[2]);
    if (!todo) return json(res, 404, { error: 'todo not found' });
    if (!['todo', 'review'].includes(todo.status)) return json(res, 400, { error: '只有未开始/评审中的单子才能开始处理（当前 ' + todo.status + '）' });
    const from = todo.status;
    todo.status = 'doing';
    if (from === 'todo') todo.today = true;   /* 未开始的单子点开始 → 进今日盘子 */
    todo.updatedAt = nowISO();
    logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'status_changed', by: todo.assigneeId, from, to: 'doing', detail: '开始处理（已加入今日待办）：' + todo.title });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/todo/:id/peer —— 维护对接开发/对接测试 */
  if (parts[1] === 'todo' && parts[2] && parts[3] === 'peer') {
    const todo = db.todos.find(x => x.id === parts[2]);
    if (!todo) return json(res, 404, { error: 'todo not found' });
    todo.meta = Object.assign({}, todo.meta, { peerDev: (body.dev || '').trim(), peerTest: (body.test || '').trim() });
    todo.updatedAt = nowISO();
    logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'status_changed', by: todo.assigneeId, detail: '更新对接人：' + todo.title + '（开发 ' + (todo.meta.peerDev || '未填') + ' / 测试 ' + (todo.meta.peerTest || '未填') + '）' });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/todo/:id/risk —— 处理中上报风险：写入风险库（管理台风险看板可见），任务挂风险标 */
  if (parts[1] === 'todo' && parts[2] && parts[3] === 'risk') {
    const todo = db.todos.find(x => x.id === parts[2]);
    if (!todo) return json(res, 404, { error: 'todo not found' });
    if (todo.status !== 'doing') return json(res, 400, { error: '还没开始处理，暂不能上报风险' });
    const note = (body.note || '').trim();
    const r = {
      id: nid('ur'), level: body.level || 'high', kind: 'user_report',
      title: '待办上报风险', message: '「' + todo.title + '」上报风险' + (note ? '：' + note : ''),
      suggestion: '跟进处理中任务的风险，必要时调整排期或转交支撑',
      entityType: 'todo', entityId: todo.id, by: todo.assigneeId, at: nowISO()
    };
    db.userRisks = db.userRisks || [];
    db.userRisks.push(r);
    todo.meta = Object.assign({}, todo.meta, { risk: true, riskNote: note, riskAt: nowISO() });
    todo.updatedAt = nowISO();
    logEvent(db, { entityType: 'todo', entityId: todo.id, action: 'status_changed', by: todo.assigneeId, detail: '上报风险：' + todo.title + (note ? '（' + note + '）' : '') });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/unit/:id/exam-schedule —— 给迭代排转测 */
  if (parts[1] === 'unit' && parts[2] && parts[3] === 'exam-schedule') {
    const unit = db.units.find(x => x.id === parts[2]);
    if (!unit) return json(res, 404, { error: 'unit not found' });
    const v = db.versions.find(vv => vv.id === unit.versionId);
    const examinees = Array.isArray(body.examinees) && body.examinees.length ? body.examinees : unitAssignees(db, unit);
    unit.exam = {
      examAt: body.examAt, subject: body.subject || ((v ? v.name + ' · ' : '') + unit.name + ' 转测'),
      examinees, result: null, defectCount: null, retakeAt: null, scheduledAt: nowISO()
    };
    logEvent(db, { entityType: 'exam', entityId: unit.id, action: 'exam_scheduled', by: 'sys', detail: unit.name + ' 转测排期：' + body.examAt });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/unit/:id/exam-result —— 记录转测结果 + 可选复测 */
  if (parts[1] === 'unit' && parts[2] && parts[3] === 'exam-result') {
    const unit = db.units.find(x => x.id === parts[2]);
    if (!unit || !unit.exam) return json(res, 404, { error: 'unit or exam not found' });
    if (!['pass', 'fail'].includes(body.result)) return json(res, 400, { error: 'result must be pass/fail' });
    unit.exam.result = body.result;
    unit.exam.defectCount = body.defectCount == null ? unit.exam.defectCount : Number(body.defectCount) || 0;
    if (body.retakeAt) unit.exam.retakeAt = body.retakeAt;
    unit.exam.updatedAt = nowISO();
    logEvent(db, { entityType: 'exam', entityId: unit.id, action: 'exam_result', by: 'sys', detail: unit.name + ' 转测结果：' + (body.result === 'pass' ? '通过' : '未通过') + '，缺陷 ' + unit.exam.defectCount + ' 个' + (unit.exam.retakeAt ? '，复测排期 ' + unit.exam.retakeAt : '') });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/risk/:id/ack —— 风险确认（不再提醒）；若源是待办上报，顺手清掉卡片的风险标 */
  if (parts[1] === 'risk' && parts[2] && parts[3] === 'ack') {
    if (!db.acks.includes(parts[2])) db.acks.push(parts[2]);
    const ur = (db.userRisks || []).find(x => x.id === parts[2]);
    if (ur && ur.entityType === 'todo') {
      const td = db.todos.find(x => x.id === ur.entityId);
      if (td && td.meta) { td.meta.risk = false; td.meta.riskNote = ''; td.updatedAt = nowISO(); }
    }
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/version —— 新增版本（管理台 · 版本节奏） */
  if (parts[1] === 'version' && !parts[2]) {
    const name = String(body.name || '').trim();
    if (!name) return json(res, 400, { error: '版本名称必填' });
    if (db.versions.some(v => v.name === name)) return json(res, 400, { error: '已存在同名版本「' + name + '」' });
    const series = ['HC', 'HCS', 'HCSO'].includes(body.series) ? body.series : 'HC';
    const kind = (body.kind === 'live') ? 'live' : 'dev';
    const freeze = String(body.freeze || '').trim();
    const release = String(body.release || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(freeze) || !/^\d{4}-\d{2}-\d{2}$/.test(release)) return json(res, 400, { error: '冻结/发布日期格式应为 YYYY-MM-DD' });
    if (daysBetween(freeze, release) < 0) return json(res, 400, { error: '发布日期不能早于冻结日期' });
    const ownerId = body.ownerId || null;
    if (ownerId && !db.employees.some(e => e.id === ownerId)) return json(res, 400, { error: '负责人不在成员列表中' });
    const ver = {
      id: nid('v'), name, kind, series,
      mainlineId: (db.mainline && db.mainline.id) || 'm1',
      freeze, release,
      milestones: buildDefaultMilestones(freeze, release),
      ownerId,
      createdAt: nowISO(), updatedAt: nowISO()
    };
    db.versions.push(ver);
    logEvent(db, { entityType: 'version', entityId: ver.id, action: 'version_created', by: body.by || 'sys', detail: '新增版本：' + name + '（' + series + ' · ' + (kind === 'live' ? '现网' : '研发') + '）' });
    saveDb(db);
    return json(res, 200, { ok: true, id: ver.id });
  }

  /* POST /api/version/:id/update —— 编辑版本（改名/版本线/性质/冻结发布/负责人；冻结发布变化会自动重排默认里程碑） */
  if (parts[1] === 'version' && parts[2] && parts[3] === 'update') {
    const ver = db.versions.find(x => x.id === parts[2]);
    if (!ver) return json(res, 404, { error: 'version not found' });
    const touched = [];
    if (typeof body.name === 'string') {
      const name = String(body.name).trim();
      if (!name) return json(res, 400, { error: '版本名称不能为空' });
      if (name !== ver.name && db.versions.some(v => v.name === name)) return json(res, 400, { error: '已存在同名版本「' + name + '」' });
      ver.name = name; touched.push('名称');
    }
    if (body.series && ['HC', 'HCS', 'HCSO'].includes(body.series)) { ver.series = body.series; touched.push('版本线'); }
    if (body.kind === 'dev' || body.kind === 'live') { ver.kind = body.kind; touched.push('性质'); }
    if (typeof body.completed === 'boolean') { ver.completed = body.completed; touched.push(body.completed ? '标记完成' : '恢复进行'); }
    if (body.ownerId !== undefined) {
      if (body.ownerId && !db.employees.some(e => e.id === body.ownerId)) return json(res, 400, { error: '负责人不在成员列表中' });
      ver.ownerId = body.ownerId || null; touched.push('负责人');
    }
    let freeze = ver.freeze, release = ver.release;
    if (typeof body.freeze === 'string' && String(body.freeze).trim()) {
      const f = String(body.freeze).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return json(res, 400, { error: '冻结日期格式应为 YYYY-MM-DD' });
      freeze = f; touched.push('冻结');
    }
    if (typeof body.release === 'string' && String(body.release).trim()) {
      const r = String(body.release).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r)) return json(res, 400, { error: '发布日期格式应为 YYYY-MM-DD' });
      release = r; touched.push('发布');
    }
    if (daysBetween(freeze, release) < 0) return json(res, 400, { error: '发布日期不能早于冻结日期' });
    ver.freeze = freeze; ver.release = release;
    /* 冻结/发布窗口变了 → 里程碑自动按新窗口重排 */
    if (touched.indexOf('冻结') >= 0 || touched.indexOf('发布') >= 0) {
      ver.milestones = buildDefaultMilestones(freeze, release);
    }
    ver.updatedAt = nowISO();
    logEvent(db, { entityType: 'version', entityId: ver.id, action: 'version_updated', by: body.by || 'sys', detail: '更新版本：' + ver.name + '（' + touched.join('/') + '）' });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/version/:id/remove —— 删除版本（最高优先级：连带删除其迭代/上线站点，任务与需求解除挂靠保留） */
  if (parts[1] === 'version' && parts[2] && parts[3] === 'remove') {
    const ver = db.versions.find(x => x.id === parts[2]);
    if (!ver) return json(res, 404, { error: 'version not found' });
    const unitIds = db.units.filter(u => u.versionId === parts[2]).map(u => u.id);
    db.units = db.units.filter(u => u.versionId !== parts[2]);
    db.todos.forEach(t => {
      if (t.versionId === parts[2]) { t.versionId = null; t.unitId = null; }
      else if (t.unitId && unitIds.includes(t.unitId)) { t.unitId = null; }
    });
    db.requirements.forEach(r => {
      if (r.versionId === parts[2]) { r.versionId = null; r.unitId = null; }
      else if (r.unitId && unitIds.includes(r.unitId)) { r.unitId = null; }
    });
    db.sites = db.sites.filter(s => s.versionId !== parts[2]);
    db.versions = db.versions.filter(x => x.id !== parts[2]);
    logEvent(db, { entityType: 'version', entityId: parts[2], action: 'version_removed', by: body.by || 'sys', detail: '删除版本：' + ver.name + '（连同 ' + unitIds.length + ' 个迭代）' });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/employee —— 新增成员（管理台 · 人员管理） */
  if (parts[1] === 'employee' && !parts[2]) {
    const name = (body.name || '').trim();
    const role = (body.role || '').trim() || '成员';
    if (!name) return json(res, 400, { error: '成员名字必填' });
    if (db.employees.some(x => x.name === name)) return json(res, 400, { error: '已存在同名成员「' + name + '」' });
    const emp = {
      id: nid('e'), name, role,
      capacity: { maxActiveUnits: 2, maxExamsPerWeek: 1, maxActiveTodos: 5 },
      leaves: [], bountyPoints: 0, bountyDone: 0,
      createdAt: nowISO()
    };
    db.employees.push(emp);
    logEvent(db, { entityType: 'employee', entityId: emp.id, action: 'employee_created', by: body.by || 'sys', detail: '新增成员：' + name + '（' + role + '）' });
    saveDb(db);
    return json(res, 200, { ok: true, id: emp.id });
  }

  /* POST /api/employee/:id/update —— 改名 / 改角色（同步刷新别人卡片上的对接人名） */
  if (parts[1] === 'employee' && parts[2] && parts[3] === 'update') {
    const emp = db.employees.find(x => x.id === parts[2]);
    if (!emp) return json(res, 404, { error: 'employee not found' });
    const oldName = emp.name;
    let changed = [];
    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) return json(res, 400, { error: '名字不能为空' });
      if (name !== oldName && db.employees.some(x => x.name === name)) return json(res, 400, { error: '已存在同名成员「' + name + '」' });
      emp.name = name;
      changed.push('姓名：' + oldName + ' → ' + name);
      /* 顺带把 todo 卡片里记录的老名字（对接开发/对接测试）改成新名字 */
      db.todos.forEach(t => {
        const m = t.meta || {};
        if (m.peerDev === oldName) m.peerDev = name;
        if (m.peerTest === oldName) m.peerTest = name;
      });
    }
    if (typeof body.role === 'string') {
      const role = body.role.trim();
      if (role) { emp.role = role; changed.push('角色：' + role); }
    }
    if (!changed.length) return json(res, 400, { error: '没有可更新的内容' });
    emp.updatedAt = nowISO();
    logEvent(db, { entityType: 'employee', entityId: emp.id, action: 'employee_updated', by: body.by || 'sys', detail: '更新成员：' + changed.join('；') });
    saveDb(db);
    return json(res, 200, { ok: true, name: emp.name, role: emp.role });
  }

  /* POST /api/employee/:id/avatar —— 换头像（存压缩后的 dataURL；传空串清除回字母头像） */
  if (parts[1] === 'employee' && parts[2] && parts[3] === 'avatar') {
    const emp = db.employees.find(x => x.id === parts[2]);
    if (!emp) return json(res, 404, { error: 'employee not found' });
    const raw = (body && body.dataUrl != null) ? String(body.dataUrl) : '';
    const v = raw.trim();
    if (v) {
      if (!/^data:image\/(png|jpe?g|gif|webp);base64,/.test(v)) return json(res, 400, { error: '头像格式不支持（需要 png/jpg/webp 的 dataURL）' });
      if (v.length > 600000) return json(res, 400, { error: '头像太大，压缩到 128px 内再传' });
      emp.avatar = v;
    } else {
      emp.avatar = null;
    }
    emp.updatedAt = nowISO();
    logEvent(db, { entityType: 'employee', entityId: emp.id, action: 'employee_updated', by: body.by || 'sys', detail: '更新成员头像：' + emp.name });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  /* POST /api/employee/:id/remove —— 删除成员（最高优先级，不做拦截；仅禁止删除当前登录的自己）
     在办任务改为未指派、接取中悬赏退回、转测名单/需求版本负责人自动清除 */
  if (parts[1] === 'employee' && parts[2] && parts[3] === 'remove') {
    const emp = db.employees.find(x => x.id === parts[2]);
    if (!emp) return json(res, 404, { error: 'employee not found' });
    /* 禁止删除当前登录的自己：操作者由 body.by 表达（后端无会话，靠前端传入） */
    if (body.by === parts[2]) return json(res, 400, { error: '不能删除当前登录的自己，请先切换身份再操作' });
    const name = emp.name;
    /* 名下所有任务解除指派（保留任务本身与历史），完成态单也一样不再归属 */
    db.todos.forEach(t => {
      if (t.assigneeId === parts[2]) t.assigneeId = null;
    });
    /* 接取中的悬赏退回重新开放；他发的悬赏保留创建记录 */
    (db.bounties || []).forEach(b => {
      if (b.status === 'claimed' && b.assigneeId === parts[2]) {
        b.status = 'open'; b.assigneeId = null; b.claimedAt = null;
      }
    });
    /* 转测名单移除 */
    db.units.forEach(u => {
      if (u.exam && u.exam.examinees && u.exam.examinees.includes(parts[2])) {
        u.exam.examinees = u.exam.examinees.filter(e => e !== parts[2]);
      }
    });
    db.requirements.forEach(r => { if (r.ownerId === parts[2]) r.ownerId = null; });
    db.versions.forEach(v => { if (v.ownerId === parts[2]) v.ownerId = null; });
    db.employees = db.employees.filter(x => x.id !== parts[2]);
    logEvent(db, { entityType: 'employee', entityId: parts[2], action: 'employee_removed', by: body.by || 'sys', detail: '删除成员：' + name });
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'not found' });
}
/* ============================================================================
 * 前端页面（Vue3 · 浅色护眼主题，白底黑字，内嵌于此文件）
 * ========================================================================== */


/* ============================================================================
 * 启动
 * ========================================================================== */
if (process.argv.includes('--reset')) { try { fs.rmSync(DB_FILE, { force: true }); console.log('[maos] 已重置演示数据'); } catch (e) { /* ignore */ } }

const db = loadDb();

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost:' + PORT);
    const DIST = path.join(__dirname, '..', 'web', 'dist');
    if (u.pathname === '/' || u.pathname === '/index.html') {
      const idx = path.join(DIST, 'index.html');
      if (fs.existsSync(idx)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(idx)); }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('前端尚未构建：在 web 目录执行 npm install && npm run build；或开发时先启动后端再在 web 执行 npm run dev (端口 5173)。');
    }
    if (u.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (u.pathname.startsWith('/assets/')) {
      const f = path.join(DIST, u.pathname.replace(/^\//, ''));
      if (fs.existsSync(f)) {
        const ext = path.extname(f).toLowerCase();
        const mime = {
          '.js': 'application/javascript; charset=utf-8',
          '.mjs': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.map': 'application/json',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.ico': 'image/x-icon',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ttf': 'font/ttf'
        };
        res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
        return res.end(fs.readFileSync(f));
      }
    }
    if (u.pathname.startsWith('/api/')) {
      await handleApi(req, res, db, u);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (err) {
    console.error('[maos] 请求处理异常：', err);
    try { json(res, 500, { error: String((err && err.message) || err) }); } catch (e2) { /* ignore */ }
  }
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error('\n[maos] 端口 ' + PORT + ' 已被占用，换个端口启动试试，例如：set PORT=24680 && node server.js');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  const lanIps = [];
  Object.keys(nets).forEach(k => {
    (nets[k] || []).forEach(n => {
      if (n.family === 'IPv4' && !n.internal) lanIps.push(n.address);
    });
  });
  console.log('');
  console.log('  ╔════════════════════════════════════════╗');
  console.log('  ║     maos\'todo · 研发调度中枢           ║');
  console.log('  ╚════════════════════════════════════════╝');
  console.log('');
  console.log('  已为你启动好，在浏览器打开：');
  console.log('  → http://localhost:' + PORT);
  (lanIps || []).forEach(ip => console.log('  → 局域网访问（发给同事）：http://' + ip + ':' + PORT));
  console.log('    注：局域网访问需放行防火墙(入站 TCP ' + PORT + ')；若打不开请在管理员 PowerShell 执行：');
  console.log('    New-NetFirewallRule -DisplayName "maos-todo" -Direction Inbound -Protocol TCP -LocalPort ' + PORT + ' -Action Allow');
  console.log('  → 数据文件：' + DB_FILE + '（--reset 可重置演示数据）');
  console.log('');
});





