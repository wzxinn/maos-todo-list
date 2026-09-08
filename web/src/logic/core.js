/* 自动生成：App.vue 控制器逻辑按域拆分（computed/methods 归组） */
export default {
  computed: {
    adminTabs() { return [ {key:'overview',label:'全局看板'}, {key:'tasks',label:'任务管理'}, {key:'board',label:'迭代看板'}, {key:'bounty',label:'悬赏榜单'}, {key:'risk',label:'风险看板'}, {key:'people',label:'人员管理'}, {key:'version',label:'版本节奏'}, {key:'export',label:'数据导出'} ]; },
    seriesOpts() { return [
                { k: 'HC', label: '研发 HC', color: '#0e7490' },
                { k: 'HCS', label: '研发 HCS', color: '#7c3aed' },
                { k: 'HCSO', label: '研发 HCSO', color: '#db2777' },
                { k: '上线', label: '上线版本', color: '#059669' },
                { k: '其他', label: '未挂版本', color: '#909399' }
              ]; },
  },
  methods: {
    diffDays(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); },
    parseRoute() {
                var h = window.location.hash || '';
                var m = h.match(new RegExp('^#/(admin|me)/([a-z]+)'));
                if (m) {
                  this.view = m[1];
                  if (m[1] === 'admin' && this.adminTabs.some(function(t){ return t.key === m[2]; })) this.tab = m[2];
                  return;
                }
                if (h.indexOf('#/admin') === 0) this.view = 'admin';
                else if (h.indexOf('#/me') === 0) this.view = 'me';
                else if (this.meName) this.view = 'me';
                else this.view = 'login';
              },
    doLogin() {
                var name = (this.loginName || '').trim();
                if (!name) { this.loginErr = '先把名字写下来吧，才好带你去你的待办～'; return; }
                var emp = this.state.employees.find(function(e){ return e.name === name; });
                if (!emp) { this.loginErr = '没有找到叫「' + name + '」的小伙伴，会不会是名字打错了？或者让管理员先把你加进来～'; return; }
                this.meName = name; this.loginErr = '';
                try { window.localStorage.setItem('maos_todo_me', name); } catch (e) { /* ignore */ }
                this.newForm.assigneeId = emp.id;
                this.tab = 'overview';
                this.goMe();
                this.toastMsg('欢迎回来，' + name + ' 👋');
              },
    logout() {
                this.meName = ''; this.loginName = '';
                try { window.localStorage.removeItem('maos_todo_me'); } catch (e) { /* ignore */ }
                window.location.hash = '#/';
                this.view = 'login';
                this.toastMsg('好的，换个人来坐这把椅子～');
              },
    goMe() { window.location.hash = '#/me'; this.parseRoute(); },
    goAdmin() { window.location.hash = '#/admin'; this.parseRoute(); },
    goTab(k) { window.location.hash = '#/admin/' + k; this.parseRoute(); this.paintCharts(); },
    api(url, opts) { return fetch(url, opts || {}).then(function(r){ return r.json(); }); },
    reload() {
                var self = this;
                return this.api('/api/state').then(function(s){
                  self.state = s;
                  if (self.view === 'admin' && self.tab === 'overview') {
                    self.$nextTick(function(){ self.renderAdminCharts(); });
                  }
                });
              },
    toastMsg(msg) { this.toast = msg; var self = this; setTimeout(function(){ self.toast = ''; }, 2400); },
    paintCharts() {
                var self = this;
                function run(){
                  try {
                    if (self.view === 'admin' && self.tab === 'overview') self.renderAdminCharts();
                  } catch (err) { console && console.error('[paintCharts]', err); }
                }
                self.$nextTick(run);
                setTimeout(run, 260);
                setTimeout(run, 800);
              },
    kwHit(low, kw) {
                var i = 0;
                while (true) {
                  i = low.indexOf(kw, i);
                  if (i < 0) return false;
                  var pre = i > 0 ? low.charCodeAt(i - 1) : 0;
                  var post = i + kw.length < low.length ? low.charCodeAt(i + kw.length) : 0;
                  var isLetter = function(c){ return (c >= 97 && c <= 122) || (c >= 65 && c <= 90); };
                  if (!isLetter(pre) && !isLetter(post)) return true;
                  i = i + kw.length;
                }
              },
    guessType(title) {
                var low = String(title || '').toLowerCase();
                if (this.kwHit(low, 'bug')) return 'bug';          // BUG → BUG修复
                if (this.kwHit(low, 'us')) return 'requirement';   // US → 需求开发
                if (this.kwHit(low, 'fe')) return 'docDesign';     // FE → 特性文档
                if (low.indexOf('串讲') >= 0) return 'share';   // 串讲 → 串讲
                if (low.indexOf('归档') >= 0) return 'archive'; // 归档 → 包归档
                if (low.indexOf('验证') >= 0) return 'prodChange'; // 验证 → 现网变更
                return 'other';
              },
    /* 版本线自动识别：标题里出现已知版本名（如 V200R021C20）或系列代号（HCSO/HCS/HC）时返回对应线
       用法与 guessType 一致；返回 '' 表示无法判断 */
    guessSeries(title) {
                var up = String(title || '').toUpperCase();
                /* 1) 已知版本名（含 series 的 in-dev/live 版本）→ 直接映射；名字长的优先 */
                var vs = (this.state && this.state.versions) || [];
                var byLen = vs.slice().sort(function(a,b){ return String(b.name||'').length - String(a.name||'').length; });
                for (var vi = 0; vi < byLen.length; vi++) {
                  var v = byLen[vi];
                  var vn = String(v.name || '').toUpperCase();
                  if (vn && up.indexOf(vn) >= 0) {
                    var ser = v.series || (v.kind === 'live' ? '上线' : '其他');
                    if (ser === 'HC' || ser === 'HCS' || ser === 'HCSO' || ser === '上线') return ser;
                  }
                }
                /* 2) 系列代号：词边界命中，长代号优先（避免 HCSO 被 HCS/HC 抢） */
                var hit = function(kw){
                  var i = 0;
                  while (true) {
                    i = up.indexOf(kw, i);
                    if (i < 0) return false;
                    var pre = i > 0 ? up.charCodeAt(i - 1) : 0;
                    var post = i + kw.length < up.length ? up.charCodeAt(i + kw.length) : 0;
                    var isA = function(c){ return (c >= 65 && c <= 90) || (c >= 97 && c <= 122); };
                    if (!isA(pre) && !isA(post)) return true;
                    i = i + kw.length;
                  }
                };
                if (hit('HCSO')) return 'HCSO';
                if (hit('HCS')) return 'HCS';
                if (hit('HC')) return 'HC';
                return '';
              },
    /* 版本线下拉被手动选中：关闭自动联动；选回「自动」则恢复 */
    onQuickSeriesManual() {
                var self = this;
                self._seriesManual = !!self.quickSeries;
                if (!self.quickSeries && self.quickTitle) {
                  var s = self.guessSeries(self.quickTitle);
                  if (s) self.quickSeries = s;
                }
                self.toastMsg(self.quickSeries ? '已手动指定版本线：' + self.seriesLabel(self.quickSeries) + '（标题不再自动联动）' : '版本线恢复自动（按标题识别）');
              },
    onQuickTypeManual() {
                if (!this.autoType) return;
                this._typePicked = true;
                this.autoType = false;
                this.toastMsg('已手动指定类型，自动联动已关闭（可再打开开关）');
              },
    onManualTypePick() {
                if (!this.autoType) return;
                this._typePicked = true;
                this.autoType = false;
                this.toastMsg('已手动指定类型，自动联动已关闭（可再打开开关）');
              },
    ddlText(t) {
                if (!t.dueAt) return '';
                var d = t.dueDiff;
                if (d == null) return '';
                if (d < 0) return '已超期 ' + (-d) + ' 天';
                if (d === 0) return '今天截止';
                return '还剩 ' + d + ' 天';
              },
    ddlStyle(t) {
                var d = t.dueDiff;
                if (d < 0) return 'color:#f56c6c;border-color:#f56c6c';
                if (d === 0) return 'color:#e6a23c;border-color:#e6a23c';
                if (d <= 2) return 'color:#e6a23c;border-color:#e6a23c';
                return 'color:#909399;border-color:#909399';
              },
    todoCls(t) {
                /* 仅当 meta.risk === true（用户点“报风险”）才视为风险卡；勿把现网变更等级等字符串误判 */
                if (t && t.meta && t.meta.risk === true) return 'b-risk';
                if (this.isDnd(t)) return 'b-dnd';                 /* 专注中 → 绿色 */
                if (t.status === 'done' || t.status === 'canceled') return 'b-done';
                return '';
              },
    nextOf(t) {
                var map = {
                  todo: [ {to:'doing',label:'开始处理'}, {to:'canceled',label:'取消'} ],  /* 未开始：不直接完成 */
                  doing: [ {to:'done',label:'完成'} ],
                  review: [ {to:'done',label:'通过'}, {to:'doing',label:'驳回'} ],
                  done: [ {to:'todo',label:'重开'} ], canceled: [ {to:'todo',label:'重开'} ]
                };
                return map[t.status] || [];
              },
    isDnd(t) { return !!(t && t.dndUntil && new Date(t.dndUntil).getTime() > this.nowMs); },
    dndLeftText(t) {
                if (!t || !t.dndUntil) return '';
                var ms = new Date(t.dndUntil).getTime() - this.nowMs;
                if (ms <= 0) return '0:00';
                var sec = Math.floor(ms / 1000), h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
                var pad = function(n){ return n < 10 ? '0' + n : '' + n; };
                return (h > 0 ? h + ':' : '') + pad(m) + ':' + pad(s);
              },
    seriesLabel(k) { var o = this.seriesOpts.find(function(s){ return s.k === k; }); return o ? o.label : k; },
    seriesCount(k) { return this.myTodos.filter(function(t){ return t.series === k && t.status !== 'done' && t.status !== 'canceled'; }).length; },
    seriesColor(k) { var o = this.seriesOpts.find(function(s){ return s.k === k; }); return o ? o.color : '#909399'; },
    inSeries(t) { return !this.meFilter || (t.series === this.meFilter); },
    riskColor(l) { return l === 'critical' ? '#f56c6c' : l === 'high' ? '#e6a23c' : l === 'medium' ? '#e6a23c' : '#67c23a'; },
    riskKindLabel(k) { var m = { exam_conflict: '排考冲突', overload: '过载', debt: '欠账', delay: '延期', milestone_shift: '里程碑漂移', user_report: '个人上报', leave: '请假' }; return m[k] || k; },
    typeLabelOf(k) { var t = this.state.dicts.types.find(function(x){ return x.key === k; }); return t ? t.label : k; },
    meAxis(v) {
                var a = [v.freeze, v.release];
                v.units.forEach(function(u){ a.push(u.planStart, u.planEnd); if (u.examView) a.push(u.examView.examAt); });
                a.sort();
                return { min: a[0], max: a[a.length - 1] };
              },
    meTodayLeft(v) {
                var axis = this.meAxis(v);
                var total = Math.max(1, this.diffDays(axis.min, axis.max));
                var t = this.state ? this.state.today : '';
                if (!t) return 0;
                var pct = Math.max(0, this.diffDays(axis.min, t)) / total * 100;
                return (pct / 100) * this.tlWidth + 1;
              },
  }
};