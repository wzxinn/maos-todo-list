<template>
  <div>
    <div class="panel" style="margin-bottom:12px">
      <div class="row spread" style="margin-bottom:6px">
        <h3 style="margin-bottom:0">多版本并行时间线</h3>
        <span class="muted small">在研 HC / HCS / HCSO 的冻结~发布窗口与迭代节奏（hover 看窗口与转测）</span>
      </div>
      <version-timeline></version-timeline>
    </div>

    <!-- 版本管理（增删改查） -->
    <div class="panel">
      <div class="row spread" style="margin-bottom:8px">
        <div class="row" style="align-items:center">
          <h3 style="margin-bottom:0">版本管理</h3>
          <span class="muted small">{{ versions.length }} 个</span>
        </div>
        <button class="go" @click="openCreate">新增版本</button>
      </div>

      <table>
        <thead><tr>
          <th style="width:110px">迭代</th><th>版本</th><th>版本线</th><th>性质</th><th>冻结 ~ 发布</th><th>负责人</th><th>挂靠</th><th>状态</th><th style="width:250px">操作</th>
        </tr></thead>
        <tbody>
          <template v-for="v in versions" :key="v.id">
          <tr>
            <td>
              <button class="act" style="border-color:#a0cfff;color:#409eff" @click="toggleIters(v)" :title="iterOpen===v.id ? '收起' : '管理该版本的迭代'">{{ iterOpen===v.id ? '▾' : '▸' }} 迭代 {{ v.units.length }}</button>
            </td>
            <td><b>{{ v.name }}</b></td>
            <td><span class="chip mono small" :style="'color:'+seriesColor(v.series)+';border-color:'+seriesColor(v.series)">{{ v.series }}</span></td>
            <td><span class="muted small">{{ v.kind === 'live' ? '现网(上线)' : '研发' }}</span></td>
            <td class="mono small">{{ v.freeze }} ~ {{ v.release }}</td>
            <td>{{ ownerNameOf(v) || '—' }}</td>
            <td class="small">{{ '任务 ' + todoCount(v) + ' · 需求 ' + reqCount(v) }}</td>
            <td><span class="chip mono small" :style="v.completed ? 'color:#67c23a;border-color:#67c23a;background:#f0f9eb' : ('color:'+v.stageColor+';border-color:'+v.stageColor)">{{ v.completed ? '已完成 ✓' : v.stageLabel }}</span></td>
            <td>
              <div class="row" style="gap:4px">
                <button class="act op" @click="openEdit(v)">编辑</button>
                <button class="act" style="border-color:#c0c4cc;color:#909399" @click="toggleComplete(v)">{{ v.completed ? '恢复' : '完成' }}</button>
                <button class="act" style="border-color:#fbc4c4;color:#f56c6c" @click="removeVersion(v)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="iterOpen===v.id">
            <td colspan="9" style="padding:6px 12px 10px">
              <div class="stack" style="gap:4px;background:#fafbfd;border-radius:8px;padding:8px 10px">
                <div v-if="unitsOf(v.id).length" class="row small" style="gap:6px;flex-wrap:wrap">
                  <span v-for="u in unitsOf(v.id).sort(function(a,b){return (a.index||0)-(b.index||0)})" :key="u.id" class="chip mono small" style="border-color:#a0cfff;color:#409eff">
                    {{ u.name }} {{ u.planStart.slice(5) }} ~ {{ u.planEnd.slice(5) }}
                    <b style="cursor:pointer;color:#f56c6c" @click="delIterInline(v, u)" title="删除该迭代"> ✕</b>
                  </span>
                </div>
                <div v-else class="hint">还没有迭代，填下面信息添加。</div>
                <div class="row small" style="align-items:center;gap:6px;margin-top:4px">
                  <el-input v-model="iterForm.name" placeholder="迭代名，如 B001 · 特性收尾" style="flex:1.4;min-width:150px"></el-input>
                  <el-date-picker v-model="iterForm.planStart" type="date" value-format="YYYY-MM-DD" placeholder="开始" style="width:120px"></el-date-picker>
                  <el-date-picker v-model="iterForm.planEnd" type="date" value-format="YYYY-MM-DD" placeholder="结束" style="width:120px"></el-date-picker>
                  <button class="go" style="padding:3px 10px" @click="addIterInline(v)" :disabled="!iterForm.name.trim()">添加</button>
                </div>
              </div>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
      <div class="hint" style="margin-top:6px">删除版本会连带删除其迭代与上线站点、任务/需求解除挂靠（无任何拦截）；冻结/发布改了，四个里程碑（冻结→一转测→发布→全量）会自动按新窗口重排。</div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dlgOpen" :title="form.id ? '编辑版本：' + form.name : '新增版本'" width="480px" append-to-body>
      <div class="stack" style="gap:8px">
        <label class="f">版本名称<el-input v-model="form.name" placeholder="例如：V200R021C40 / 7.7.0"></el-input></label>
        <div class="row" style="gap:8px">
          <label class="f" style="flex:1">版本线
            <el-select v-model="form.series" style="width:100%">
              <el-option v-for="s in seriesChoices" :key="s.k" :label="s.label" :value="s.k"></el-option>
            </el-select>
          </label>
          <label class="f" style="width:140px">性质
            <el-select v-model="form.kind" style="width:100%">
              <el-option label="研发（dev）" value="dev"></el-option>
              <el-option label="现网（live）" value="live"></el-option>
            </el-select>
          </label>
        </div>
        <div class="row" style="gap:8px">
          <label class="f" style="flex:1">需求冻结
            <el-date-picker v-model="form.freeze" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%"></el-date-picker>
          </label>
          <label class="f" style="flex:1">版本发布
            <el-date-picker v-model="form.release" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%"></el-date-picker>
          </label>
        </div>
        <label class="f">负责人
          <el-select v-model="form.ownerId" style="width:100%" clearable placeholder="不指定">
            <el-option v-for="e in state.employees" :key="e.id" :label="e.name + ' · ' + e.role" :value="e.id"></el-option>
          </el-select>
        </label>

        <!-- 迭代管理（仅编辑已有版本时出现） -->
        <div v-if="form.id" class="sep"></div>
        <div v-if="form.id">
          <div class="row spread" style="margin-bottom:4px">
            <span class="small" style="font-weight:700;color:#14355f">版本迭代（{{ unitsOf(form.id).length }}）</span>
            <span class="hint">添加/删除迭代会即时保存</span>
          </div>
          <div class="stack" style="gap:4px" v-if="unitsOf(form.id).length">
            <div v-for="u in unitsOf(form.id).sort(function(a,b){return (a.index||0)-(b.index||0)})" :key="u.id" class="row small" style="align-items:center;border-bottom:1px dashed #ebeef5;padding:2px 0">
              <span class="chip mono small" style="border-color:#a0cfff;color:#409eff">{{ u.name }}</span>
              <span class="muted mono small">{{ u.planStart }} ~ {{ u.planEnd }}</span>
              <span class="muted small" v-if="u.exam && u.exam.examAt">转测 {{ u.exam.examAt.slice(5) }}</span>
              <span class="muted small" v-else-if="u.examView && u.examView.examAt">转测 {{ u.examView.examAt.slice(5) }}</span>
              <span style="flex:1"></span>
              <button class="act" style="border-color:#f56c6c;color:#f56c6c" @click="delIter(u)">删</button>
            </div>
          </div>
          <div class="row small" style="align-items:center;gap:6px;margin-top:6px">
            <el-input v-model="iterForm.name" placeholder="迭代名，如 B004 · 特性收尾" style="flex:1.2;min-width:140px"></el-input>
            <el-date-picker v-model="iterForm.planStart" type="date" value-format="YYYY-MM-DD" placeholder="开始" style="width:120px"></el-date-picker>
            <el-date-picker v-model="iterForm.planEnd" type="date" value-format="YYYY-MM-DD" placeholder="结束" style="width:120px"></el-date-picker>
            <button class="go" style="padding:3px 10px" @click="addIter" :disabled="!iterForm.name.trim()">添加迭代</button>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="act" @click="dlgOpen=false">取消</button>
        <button class="go" @click="save" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessageBox } from 'element-plus';
import VersionTimeline from './VersionTimeline.vue';
export default {
  name: 'AdminVersion',
  inject: ['root'],
  components: { VersionTimeline },
  data() {
    return {
      dlgOpen: false, saving: false,
      form: { id: '', name: '', series: 'HC', kind: 'dev', freeze: '', release: '', ownerId: '' },
      iterForm: { name: '', planStart: '', planEnd: '' },
      iterOpen: null
    };
  },
  computed: {
    state() { return this.root.state; },
    seriesOpts() { return this.root.seriesOpts; },
    seriesChoices() { return this.root.seriesOpts.filter(function(s){ return s.k === 'HC' || s.k === 'HCS' || s.k === 'HCSO'; }); },
    versions() {
      var list = this.state ? this.state.versions : [];
      return list.slice().sort(function(a, b){ return (a.freeze < b.freeze ? -1 : 1); });
    }
  },
  methods: {
    seriesColor(k) { return this.root.seriesColor(k); },
    /* 某版本下挂的迭代（嵌在 state.versions[].units 中） */
    unitsOf(versionId) {
      if (!this.state) return [];
      var v = this.state.versions.find(function(x){ return x.id === versionId; });
      return v && v.units ? v.units : [];
    },
    addIter() {
      var self = this;
      var f = this.iterForm;
      if (!this.form.id) { this.root.toastMsg('请先保存版本再添加迭代'); return; }
      if (!f.name.trim() || !f.planStart || !f.planEnd) { this.root.toastMsg('迭代名与开始/结束都要填'); return; }
      this.postIter(this.form.id);
    },
    postIter(versionId) {
      var self = this;
      var f = this.iterForm;
      this.root.api('/api/unit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionId: versionId, name: f.name, planStart: f.planStart, planEnd: f.planEnd, by: this.root.me ? this.root.me.id : 'sys' }) })
        .then(function(r){
          if (r && r.ok) {
            self.root.toastMsg('迭代已添加 ✅');
            self.iterForm = { name: '', planStart: '', planEnd: '' };
            self.root.reload();
          } else {
            self.root.toastMsg('添加失败：' + (r && r.error ? r.error : ''));
          }
        });
    },
    toggleIters(v) {
      this.iterOpen = (this.iterOpen === v.id) ? null : v.id;
      this.iterForm = { name: '', planStart: '', planEnd: '' };
    },
    addIterInline(v) {
      var self = this;
      var f = this.iterForm;
      if (!f.name.trim() || !f.planStart || !f.planEnd) { this.root.toastMsg('迭代名与开始/结束都要填'); return; }
      this.postIter(v.id);
    },
    delIterInline(v, u) {
      var self = this;
      ElMessageBox.confirm('删除迭代「' + u.name + '」？其下任务/需求解除挂靠保留。', '删除迭代', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
        .then(function(){
          self.root.api('/api/unit/' + u.id + '/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ by: self.root.me ? self.root.me.id : 'sys' }) })
            .then(function(r){
              if (r && r.ok) { self.root.toastMsg('已删除迭代：' + u.name); self.root.reload(); }
              else self.root.toastMsg('删除失败：' + (r && r.error ? r.error : ''));
            });
        })
        .catch(function(){ /* 取消 */ });
    },
    delIter(u) { this.delIterInline(this.form.id ? this.form : {}, u); },
    ownerNameOf(v) {
      if (!v || !v.ownerId || !this.state) return '';
      var e = this.state.employees.find(function(x){ return x.id === v.ownerId; });
      return e ? e.name : '';
    },
    todoCount(v) {
      if (!this.state) return 0;
      return this.state.todos.filter(function(t){ return t.versionId === v.id && t.status !== 'canceled'; }).length;
    },
    reqCount(v) {
      if (!this.state) return 0;
      return this.state.requirements.filter(function(r){ return r.versionId === v.id; }).length;
    },
    openCreate() {
      this.form = { id: '', name: '', series: 'HC', kind: 'dev', freeze: '', release: '', ownerId: '' };
      this.dlgOpen = true;
    },
    openEdit(v) {
      this.form = {
        id: v.id, name: v.name, series: v.series || 'HC', kind: v.kind || 'dev',
        freeze: v.freeze, release: v.release, ownerId: v.ownerId || ''
      };
      this.dlgOpen = true;
    },
    save() {
      var self = this;
      var f = this.form;
      if (!(f.name || '').trim()) { this.root.toastMsg('版本名称必填～'); return; }
      if (!f.freeze || !f.release) { this.root.toastMsg('冻结和发布都要选日期～'); return; }
      if (f.release < f.freeze) { this.root.toastMsg('发布不能早于冻结～'); return; }
      this.saving = true;
      var url = f.id ? '/api/version/' + f.id + '/update' : '/api/version';
      var payload = { name: f.name, series: f.series, kind: f.kind, freeze: f.freeze, release: f.release, ownerId: f.ownerId, by: this.root.me ? this.root.me.id : 'sys' };
      this.root.api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function(r){
          self.saving = false;
          if (r && r.ok) {
            self.root.toastMsg(f.id ? '版本已保存 ✅' : '版本已创建 ✅');
            self.dlgOpen = false;
            self.root.reload();
          } else {
            self.root.toastMsg((r && r.error) ? r.error : '保存失败');
          }
        });
    },
    toggleComplete(v) {
      var self = this;
      var next = !v.completed;
      ElMessageBox.confirm(
        next ? '确认把版本「' + v.name + '」标记为完成吗？\n完成后它会在上方多版本时间线里隐藏。' : '把版本「' + v.name + '」恢复为进行中？',
        next ? '标记版本完成' : '恢复版本',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: next ? 'warning' : 'info' }
      ).then(function(){
        self.root.api('/api/version/' + v.id + '/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: next, by: self.root.me ? self.root.me.id : 'sys' }) })
          .then(function(r){
            if (r && r.ok) { self.root.toastMsg(next ? '已标记完成：' + v.name + '（时间线已隐藏）' : '已恢复：' + v.name); self.root.reload(); }
            else self.root.toastMsg('操作失败：' + (r && r.error ? r.error : ''));
          });
      }).catch(function(){});
    },
    removeVersion(v) {      var self = this;
      ElMessageBox.confirm('确定删除版本「' + v.name + '」吗？\n会连带删除它的全部迭代与上线站点；下面挂的任务/需求解除挂靠保留。', '删除版本', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
        .then(function(){
          self.root.api('/api/version/' + v.id + '/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ by: self.root.me ? self.root.me.id : 'sys' }) })
            .then(function(r){
              if (r && r.ok) { self.root.toastMsg('已删除版本：' + v.name); self.root.reload(); }
              else self.root.toastMsg('删除失败：' + (r && r.error ? r.error : ''));
            });
        })
        .catch(function(){ /* 取消 */ });
    }
  }
};
</script>
