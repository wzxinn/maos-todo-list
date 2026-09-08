/* 自动生成：App.vue 控制器逻辑按域拆分（computed/methods 归组） */
export default {
  computed: {
    filteredTodos() {
            var s = this.state, self = this;
            if (!s) return [];
            return s.todos.filter(function(t){
              if (self.filterAssignee && t.assigneeId !== self.filterAssignee) return false;
              if (self.filterStatus && t.status !== self.filterStatus) return false;
              if (self.filterType && t.type !== self.filterType) return false;
              return true;
            }).sort(function(a,b){ return (a.dueDiff==null?99:a.dueDiff)-(b.dueDiff==null?99:b.dueDiff); });
          },
    allUnits() {
            var out = [];
            if (!this.state) return out;
            this.state.versions.forEach(function(v){ v.units.forEach(function(u){ out.push({ id: u.id, name: u.name, versionName: v.name, versionId: v.id }); }); });
            return out;
          },
  },
  methods: {
    createTodo() {
            var f = this.newForm, self = this;
            if (!f.title || !f.assigneeId) { this.toastMsg('标题和负责人总得填一个吧～'); return; }
            var payload = { title: f.title, type: f.type, priority: f.priority, assigneeId: f.assigneeId, requirementId: f.requirementId || null, unitId: f.unitId || null, dueAt: f.dueAt || null, estDays: (f.estDaysNum != null && f.estDaysNum !== '') ? Number(f.estDaysNum) : null };
            var un = this.allUnits.find(function(u){ return u.id === payload.unitId; });
            if (un) payload.versionId = un.versionId;
            this.api('/api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              .then(function(r){ if (r.ok) self.toastMsg('任务已创建'); self.newForm = { title: '', type: 'other', priority: 'P1', assigneeId: f.assigneeId, requirementId: '', unitId: '', dueAt: '', estDaysNum: null }; self.autoType = true; self.reload(); });
          },
    importBugs() {
            var self = this, txt = this.bugJson.trim();
            if (!txt) return;
            var obj;
            try { obj = JSON.parse(txt); } catch (e) { this.bugReport = { error: 'JSON 解析失败：' + e.message }; return; }
            this.api('/api/bugs/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: obj }) })
              .then(function(r){ self.bugReport = r; if (r && !r.error) self.toastMsg('BUG 导入完成：新建 ' + (r.created||0) + ' / 更新 ' + (r.updated||0)); self.reload(); });
          },
    scheduleExam(u, date) {
            var self = this;
            this.api('/api/unit/' + u.id + '/exam-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ examAt: date }) })
              .then(function(r){ if (r.ok) self.toastMsg('转测已排期 ' + date); self.reload(); });
          },
    scheduleRetake(u, date) {
            var self = this;
            this.api('/api/unit/' + u.id + '/exam-result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result: 'fail', retakeAt: date, defectCount: 0 }) })
              .then(function(r){ if (r.ok) self.toastMsg('复测已排期 ' + date); self.reload(); });
          },
    examResult(u, result) {
            var d = this.defMap[u.id] || { defect: 0, retake: '' };
            var payload = { result: result, defectCount: d.defect || 0 };
            if (result === 'fail' && d.retake) payload.retakeAt = d.retake;
            var self = this;
            this.api('/api/unit/' + u.id + '/exam-result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              .then(function(r){ if (r.ok) self.toastMsg(result === 'pass' ? '转测通过 🎉' : '已记录未通过'); self.reload(); });
          },
  }
};