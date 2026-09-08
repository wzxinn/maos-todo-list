/**
 * 子组件引用根实例(App.vue)的桥梁。
 * 用法：子组件 `inject: ['root']`，然后
 *   computed: Object.assign(rc(KEYS), {...localComputed}),
 *   methods:   Object.assign(rm(METHOD_KEYS), {...localMethods})
 * rc 为每个 KEY 建 get/set，rm 把方法名转发到 root，保证模板与原单文件写法一致。
 */
export function rc(keys) {
  const o = {};
  keys.forEach(k => {
    o[k] = {
      get() { return this.root[k]; },
      set(v) { this.root[k] = v; }
    };
  });
  return o;
}

export function rm(keys) {
  const o = {};
  keys.forEach(k => {
    o[k] = function (...args) { return this.root[k](...args); };
  });
  return o;
}

/* 根 data + computed 里被模板用到的键（按需按组件引用，这里是全量清单） */
export const ROOT_DATA = ['state', 'view', 'meName', 'loginName', 'loginErr', 'tab', 'curVer',
  'filterAssignee', 'filterStatus', 'filterType', 'exportText', 'promptText', 'toast',
  'bountyForm', 'bountyFilter', 'bugJson', 'bugReport', 'quickTitle', 'quickType', 'quickDue',
  'quickToday', 'quickDev', 'quickTest', 'quickSeries', 'autoType', '_typePicked', 'sortMode',
  'tlWidth', 'openNames', 'meFilter', 'editOpen', 'editTodo', 'editForm', 'dndPick', 'nowMs',
  'defMap', 'newForm'];
export const ROOT_COMPUTED = ['adminTabs', 'weekDays', 'stats', 'seriesOpts', 'me', 'cur',
  'myTodos', 'todayTodos', 'openTodos', 'doneTodos', 'todayOverdueCount', 'todayDueCount',
  'filteredTodos', 'allUnits', 'maxTypeCount', 'axis', 'overlaps', 'riskGroups', 'nextIter',
  'manStats', 'bountyFilters', 'bountyFilterLabel', 'bountyFiltered', 'bountyRank'];
export const ROOT_METHODS = ['logout', 'doLogin', 'goMe', 'goAdmin', 'goTab', 'openEditTodo',
  'startTodo', 'finishTodo', 'riskTodo', 'setStatus', 'shelfTodo', 'delTodo', 'setDnd',
  'dndLeftText', 'editPeer', 'saveEditTodo', 'quickAdd', 'onQuickTypeManual', 'onManualTypePick',
  'onQuickSeriesManual', 'createTodo', 'importBugs', 'createBounty', 'claimBounty', 'returnBounty', 'delBounty',
  'bountyPointsOf', 'reload', 'ackRisk', 'riskColor', 'riskKindLabel', 'typeLabelOf',
  'seriesLabel', 'seriesColor', 'seriesCount', 'todoCls', 'ddlStyle', 'ddlText', 'isDnd',
  'nextOf', 'exportMeTodos', 'onMeCollapse', 'loadExport', 'loadPrompt', 'downloadExport',
  'copyText', 'setProgress', 'guessSeries'];
