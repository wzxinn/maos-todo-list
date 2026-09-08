/* 自动生成：App.vue 控制器逻辑按域拆分（computed/methods 归组） */
export default {
  computed: {
    me() { var s = this.state; if (!s || !this.meName) return null; return s.employees.find(function(e){ return e.name === this.meName; }.bind(this)) || null; },
    cur() { var s = this.state; if (!s) return null; return s.versions.find(function(v){ return v.id === this.curVer; }.bind(this)); },
    myTodos() {
                var s = this.state, self = this;
                if (!s || !self.me) return [];
                return s.todos.filter(function(t){ return t.assigneeId === self.me.id && t.status !== 'canceled'; });
              },
    todayTodos() {
                var self = this;
                return this.myTodos.filter(function(t){
                  return t.status !== 'done' && (t.today || t.status === 'doing') && self.inSeries(t);
                }).sort(function(a,b){ return (a.dueDiff==null?999:a.dueDiff)-(b.dueDiff==null?999:b.dueDiff); });
              },
    openTodos() {
                var self = this;
                var prioRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
                function smartScore(t) {
                  var d = t.dueDiff == null ? 999 : t.dueDiff;
                  var urgency = d < 0 ? 0 : d === 0 ? 1 : d === 1 ? 2 : d <= 3 ? 3 : d <= 7 ? 4 : 5;
                  var p = (prioRank[t.priority] == null ? 3 : prioRank[t.priority]);
                  return p * 6 + urgency;
                }
                var list = this.myTodos.filter(function(t){
                  return t.status !== 'done' && t.status !== 'doing' && !t.today && self.inSeries(t);
                });
                var arr = list.slice();
                if (self.sortMode === 'due') arr.sort(function(a,b){ return (a.dueDiff==null?999:a.dueDiff)-(b.dueDiff==null?999:b.dueDiff); });
                else if (self.sortMode === 'prio') arr.sort(function(a,b){
                  var pa = prioRank[a.priority] == null ? 3 : prioRank[a.priority], pb = prioRank[b.priority] == null ? 3 : prioRank[b.priority];
                  return pa !== pb ? pa - pb : (a.dueDiff==null?999:a.dueDiff)-(b.dueDiff==null?999:b.dueDiff);
                });
                else arr.sort(function(a,b){ var r = smartScore(a)-smartScore(b); return r !== 0 ? r : (a.dueDiff==null?999:a.dueDiff)-(b.dueDiff==null?999:b.dueDiff); });
                return arr;
              },
    doneTodos() {
                var self = this;
                return this.myTodos.filter(function(t){ return t.status === 'done' && self.inSeries(t); }).sort(function(a,b){ return (a.updatedAt < b.updatedAt ? 1 : -1); });
              },
    todayOverdueCount() { var self=this; return this.myTodos.filter(function(t){ return t.status !== 'done' && t.dueDiff != null && t.dueDiff < 0 && self.inSeries(t); }).length; },
    todayDueCount() { var self=this; return this.myTodos.filter(function(t){ return t.status !== 'done' && t.dueDiff === 0 && self.inSeries(t); }).length; },
    maxTypeCount() { var m = this.me; if (!m || !m.profile.byType.length) return 1; return Math.max.apply(null, m.profile.byType.map(function(b){ return b.count; })); },
  },
  methods: {
    onMeCollapse(names) {
                /* 版本节奏改为独立时间线组件(VersionTimeline.vue)，自动监听展开/数据重绘，无需在此渲染 */
                var self = this;
                var arr = names || [];
                if (arr.indexOf('ver') >= 0) {
                  self.$nextTick(function(){
                    /* 通知页面上的时间线组件：内容已展开，可再量一次宽度 */
                    var ev = new CustomEvent('ver-timeline-refresh');
                    document.dispatchEvent(ev);
                  });
                }
              },
    exportMeTodos() {
                var self = this;
                if (!self.me || !self.state) return;
                var NL = String.fromCharCode(10);
                var L = [];
                L.push('待办导出 · ' + self.me.name + ' · ' + self.me.role);
                L.push('导出时间：' + self.state.today);
                L.push('今日截止 ' + self.todayDueCount + ' 项 / 已超期 ' + self.todayOverdueCount + ' 项');
                L.push('');
                var fmt = function(t){
                  var s = '- [' + (t.statusLabel || t.status) + '] ' + t.title;
                  var meta = [];
                  if (t.typeLabel) meta.push(t.typeLabel);
                  if (t.priorityLabel) meta.push(t.priorityLabel);
                  if (t.series && t.series !== '其他') meta.push(self.seriesLabel(t.series));
                  if (t.bounty) meta.push('悬赏·' + t.bounty.diffLabel);
                  if (meta.length) s += '（' + meta.join(' · ') + '）';
                  if (t.unitName) s += '　' + t.unitName;
                  if (t.dueAt) s += '　截止 ' + t.dueAt + (t.dueDiff != null ? '（还剩 ' + t.dueDiff + ' 天）' : '');
                  if (t.meta && t.meta.peerDev) s += '　Owner：' + t.meta.peerDev;
                  if (t.meta && t.meta.peerTest) s += '　测试责任人：' + t.meta.peerTest;
                  if (t.meta && t.meta.risk) s += '　⚠️已报风险';
                  return s;
                };
                var group = function(title, list){
                  L.push('【' + title + '】' + list.length + ' 项');
                  if (!list.length) L.push('（空）');
                  list.forEach(function(t){ L.push(fmt(t)); });
                  L.push('');
                };
                group('今日待办', self.todayTodos);
                group('未完成事项', self.openTodos);
                var text = L.join(NL);
                /* 导出 = 复制到剪贴板（无需下载 txt） */
                self.copyText(text);
                self.toastMsg('已复制当前待办任务到剪贴板 📋（今日 ' + self.todayTodos.length + ' + 未完成 ' + self.openTodos.length + '）');
              },
    quickAdd() {
                var self = this;
                var title = (this.quickTitle || '').trim();
                if (!title) { this.toastMsg('先写点任务内容吧～'); return; }
                if (!this.me) { this.toastMsg('咦，好像还没选好你是谁～'); return; }
                var payload = {
                  title: title, type: this.quickType || 'bug', priority: 'P1',
                  assigneeId: this.me.id, dueAt: this.quickDue || null,
                  today: this.quickToday,          /* 回车默认排今天 → 进今日待办 */
                  meta: {
                    peerDev: (this.quickDev || '').trim(), peerTest: (this.quickTest || '').trim(),
                    verSeries: this.quickSeries || ''
                  }
                };
                this.api('/api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                  .then(function(r){
                    if (r.ok) self.toastMsg(self.quickToday ? '已放进今日待办 ✅' : '已存进未完成事项 ✅');
                    self.quickTitle = ''; self.quickDue = ''; self.quickDev = ''; self.quickTest = ''; self.quickSeries = '';
                    self._seriesManual = false;   /* 下一条标题继续自动联动版本线 */
                    self.reload();
                  });
              },
    involvedUnit(u) {
                var self = this;
                if (!self.me) return false;
                return self.myTodos.some(function(t){ return t.unitId === u.id; });
              },
    vUnitExamDates(v) {
                var out = [];
                v.units.forEach(function(u){ if (u.examView) out.push(u.name + '@' + u.examView.examAt); });
                return out;
              },
  }
};