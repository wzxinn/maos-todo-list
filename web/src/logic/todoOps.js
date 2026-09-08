/* 自动生成：App.vue 控制器逻辑按域拆分（computed/methods 归组） */
export default {
  methods: {
    setStatus(t, next) {
            var self = this;
            this.api('/api/todo/' + t.id + '/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) })
              .then(function(r){
                if (r.ok) { self.toastMsg(next === 'done' ? '干完一件 🎉 ' + t.title : '已更新：' + t.title); self.reload(); }
                else { self.toastMsg('操作没成功：' + (r.error || '状态不允许') + '（' + t.status + ' → ' + next + '）'); }
              });
          },
    delTodo(t) {
            var self = this;
            ElementPlus.ElMessageBox.confirm('确认删掉「' + t.title + '」吗？删了可就找不回来了哦', '删除确认', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
              .then(function(){
                self.api('/api/todo/' + t.id + '/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ by: self.me ? self.me.id : '' }) })
                  .then(function(r){ if (r.ok) self.toastMsg('已删除：' + t.title); self.reload(); });
              })
              .catch(function(){ /* 用户取消 */ });
          },
    startTodo(t) {
            var self = this;
            this.api('/api/todo/' + t.id + '/start', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
              .then(function(r){
                if (r.ok) self.toastMsg('开始处理：' + t.title + ' ⏱');
                else self.toastMsg('操作没成功：' + (r.error || '状态不允许'));
                self.reload();
              });
          },
    shelfTodo(t) {
            var self = this;
            this.api('/api/todo/' + t.id + '/shelf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
              .then(function(r){
                if (r.ok) self.toastMsg('已暂时搁置：' + t.title + '（回到未完成事项）');
                else self.toastMsg('操作没成功：' + (r.error || '状态不允许'));
                self.reload();
              });
          },
    finishTodo(t) { this.setStatus(t, 'done'); },
    /* 卡片上点选进度阶段（方案设计…发布上线）后保存 */
    setProgress(t, stage) {
            var self = this;
            if (t.progress === stage) stage = '';   /* 再点一次 = 取消当前阶段 */
            this.api('/api/todo/' + t.id + '/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: stage }) })
              .then(function(r){
                if (r.ok) self.toastMsg(stage ? '进度已更新：' + stage : '已清除进度阶段');
                self.reload();
              });
          },
    riskTodo(t) {
            var self = this;
            ElementPlus.ElMessageBox.prompt('描述一下风险：什么原因、影响什么？', '上报风险', { confirmButtonText: '上报', cancelButtonText: '取消', inputPlaceholder: '例如：联调环境迟迟不到位，可能压后转测' })
              .then(function(r){
                var note = (r && r.value) ? String(r.value).trim() : '';
                self.api('/api/todo/' + t.id + '/risk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: note }) })
                  .then(function(x){
                    if (x.ok) self.toastMsg('风险已上报 ⚠️ 管理台 · 风险看板可见');
                    else self.toastMsg('操作没成功：' + (x.error || '状态不允许'));
                    self.reload();
                  });
              })
              .catch(function(){ /* 用户取消 */ });
          },
    editPeer(t, which) {
            var self = this;
            var m = t.meta || {};
            var label = which === 'dev' ? '特性 Owner' : '测试责任人';
            var cur = which === 'dev' ? (m.peerDev || '') : (m.peerTest || '');
            ElementPlus.ElMessageBox.prompt('填' + label + '（同事姓名）', label, { confirmButtonText: '保存', cancelButtonText: '取消', inputValue: cur, inputPlaceholder: '例如：李娜' })
              .then(function(r){
                var val = (r && r.value) ? String(r.value).trim() : '';
                var dev = which === 'dev' ? val : (m.peerDev || '');
                var test = which === 'test' ? val : (m.peerTest || '');
                self.api('/api/todo/' + t.id + '/peer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dev: dev, test: test }) })
                  .then(function(x){ if (x.ok) self.toastMsg(label + '已更新为：' + val); self.reload(); });
              })
              .catch(function(){ /* 用户取消 */ });
          },
    openEditTodo(t) {
            var m = t.meta || {};
            this.editTodo = t;
            this.editForm = {
              title: t.title || '',
              type: t.type || 'other',
              priority: t.priority || 'P2',
              dueAt: t.dueAt || '',
              series: m.verSeries || (t.series && t.series !== '其他' ? t.series : ''),
              description: t.description || '',
              peerDev: m.peerDev || '',
              peerTest: m.peerTest || '',
              estDaysNum: (t.estDays != null && t.estDays !== '') ? Number(t.estDays) : null,
              versionId: t.versionId || '',
              unitId: t.unitId || '',
              autoMount: !(t.versionId || t.unitId) || !!m._autoMounted
            };
            this.editOpen = true;
          },
    onEditMountMode() {
            /* 切到手动：把当前版本/迭代带进下拉；切回自动：清空手选 */
            if (!this.editForm.autoMount) {
              if (!this.editForm.versionId && this.editTodo) this.editForm.versionId = this.editTodo.versionId || '';
              if (!this.editForm.unitId && this.editTodo) this.editForm.unitId = this.editTodo.unitId || '';
            } else {
              this.editForm.versionId = '';
              this.editForm.unitId = '';
            }
          },
    onEditVerChange() {
            if (this.editForm.unitId) {
              /* 迭代属于旧版本时清掉，避免串版本 */
              var u = this.editVersionUnits.find(function(x){ return x.id === this.editForm.unitId; }.bind(this));
              if (!u) this.editForm.unitId = '';
            }
          },
    saveEditTodo() {
            var self = this;
            if (!this.editTodo) return;
            var id = this.editTodo.id;
            var f = this.editForm;
            if (!(f.title || '').trim()) { this.toastMsg('标题不能空～'); return; }
            var payload = {
              title: f.title, type: f.type, priority: f.priority, dueAt: f.dueAt || null,
              series: f.series || '', description: f.description || '', peerDev: f.peerDev || '', peerTest: f.peerTest || '',
              estDays: (f.estDaysNum != null && f.estDaysNum !== '') ? Number(f.estDaysNum) : null,
              autoMount: !!f.autoMount
            };
            if (!f.autoMount) {
              payload.versionId = f.versionId || null;
              payload.unitId = f.unitId || null;
            }
            this.api('/api/todo/' + id + '/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              .then(function(r){
                if (r.ok) { self.toastMsg('已保存编辑 ✅'); self.editOpen = false; self.reload(); }
                else self.toastMsg('保存失败：' + (r.error || ''));
              });
          },
    setDnd(t, minutes) {
            var self = this;
            var mins = minutes || 0;
            this.api('/api/todo/' + t.id + '/dnd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: mins }) })
              .then(function(r){
                self.dndPick = null;
                if (r.ok) self.toastMsg(mins > 0 ? '🧘 已开启专注 ' + mins + ' 分钟，专注干「' + t.title + '」' : '专注已结束');
                self.reload();
              });
          },
  }
};