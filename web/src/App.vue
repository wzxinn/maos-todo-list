<template>
  <header-bar></header-bar>
  <login-view v-if="state && view==='login'"></login-view>

  <template v-if="state && view!=='login'">
    <div class="rnav">
      <button :class="{on:view==='me'}" @click="goMe">我的工作台</button>
      <button :class="{on:view==='admin'}" @click="goAdmin">管理台</button>
    </div>
    <div class="subnav" v-if="view==='admin'">
      <button v-for="tb in adminTabs" :key="tb.key" :class="{on:tab===tb.key}" @click="goTab(tb.key)">{{ tb.label }}</button>
    </div>

    <!-- 我的工作台 -->
    <me-view v-if="view==='me' && me"></me-view>

    <!-- 管理台各页签 -->
    <admin-overview v-if="view==='admin' && tab==='overview'"></admin-overview>
    <admin-tasks v-if="view==='admin' && tab==='tasks'"></admin-tasks>
    <admin-board v-if="view==='admin' && tab==='board'"></admin-board>
    <admin-bounty v-if="view==='admin' && tab==='bounty'"></admin-bounty>
    <admin-version v-if="view==='admin' && tab==='version'"></admin-version>
    <admin-risk v-if="view==='admin' && tab==='risk'"></admin-risk>
    <admin-export v-if="view==='admin' && tab==='export'"></admin-export>
    <admin-people v-if="view==='admin' && tab==='people'"></admin-people>
  </template>

  <!-- 编辑待办对话框（个人待办清单用） -->
  <el-dialog v-model="editOpen" :title="'编辑待办' + (editTodo && editTodo.title ? '：' + editTodo.title.slice(0, 24) : '')" width="520px" append-to-body>
    <div class="stack" style="gap:8px" v-if="editTodo">
      <label class="f">标题<el-input v-model="editForm.title" placeholder="待办标题"></el-input></label>
      <div class="row" style="gap:8px;align-items:flex-start">
        <label class="f" style="width:120px">类型
          <el-select v-model="editForm.type" style="width:100%">
            <el-option v-for="tp in state.dicts.types" :key="tp.key" :label="tp.label" :value="tp.key"></el-option>
          </el-select>
        </label>
        <label class="f" style="width:110px">优先级
          <el-select v-model="editForm.priority" style="width:100%">
            <el-option v-for="(pm, pk) in state.dicts.priorities" :key="pk" :label="pm.label" :value="pk"></el-option>
          </el-select>
        </label>
        <label class="f" style="width:150px">截止日期<el-date-picker v-model="editForm.dueAt" type="date" value-format="YYYY-MM-DD" placeholder="选填" style="width:100%"></el-date-picker></label>
      </div>
      <div class="row" style="gap:8px;align-items:flex-start">
        <label class="f" style="flex:1">版本线（HC / HCS / HCSO / 上线 / 其他）
          <el-select v-model="editForm.series" style="width:100%" clearable placeholder="自动（按标题）" :disabled="editForm.autoMount">
            <el-option v-for="s in seriesOpts" :key="s.k" :label="s.label" :value="s.k"></el-option>
          </el-select>
        </label>
        <label class="f" style="width:170px">工作量（人天）<el-input-number v-model="editForm.estDaysNum" :min="0" :step="0.5" :precision="1" controls-position="right" style="width:100%"></el-input-number>
          <span class="hint">留空=按类型默认（需求5 / BUG0.5）</span>
        </label>
      </div>
      <div class="row" style="gap:8px;align-items:center;background:#f7f9fc;border:1px solid var(--line);border-radius:8px;padding:8px 10px">
        <el-switch v-model="editForm.autoMount" @change="onEditMountMode" style="margin-right:2px"></el-switch>
        <span class="small" style="font-weight:600;color:#14355f">自动匹配归属</span>
        <span class="hint" style="flex:1">开：按「到期日 + 大版本(HC/HCS/HCSO)」自动归到对应版本/迭代；关：手动选下面的版本与迭代。</span>
      </div>
      <template v-if="!editForm.autoMount">
        <div class="row" style="gap:8px;align-items:flex-start">
          <label class="f" style="flex:1">所属版本
            <el-select v-model="editForm.versionId" style="width:100%" clearable placeholder="选版本" @change="onEditVerChange">
              <el-option v-for="v in state.versions" :key="v.id" :label="v.name + ' · ' + seriesLabel(v.series) + (v.kind==='live' ? '（上线）' : '')" :value="v.id"></el-option>
            </el-select>
          </label>
          <label class="f" style="flex:1">所属迭代
            <el-select v-model="editForm.unitId" style="width:100%" clearable placeholder="选迭代" :disabled="!editForm.versionId">
              <el-option v-for="u in editVersionUnits" :key="u.id" :label="u.name + '（' + u.planStart + ' ~ ' + u.planEnd + '）'" :value="u.id"></el-option>
            </el-select>
          </label>
        </div>
      </template>
      <div v-else class="hint" style="margin:-4px 0 0">{{ editMountPreview }}</div>
      <div class="row" style="gap:8px">
        <label class="f" style="flex:1">特性 Owner<el-input v-model="editForm.peerDev" placeholder="同事姓名，选填"></el-input></label>
        <label class="f" style="flex:1">测试责任人<el-input v-model="editForm.peerTest" placeholder="同事姓名，选填"></el-input></label>
      </div>
      <label class="f">备注 / 描述<el-input v-model="editForm.description" type="textarea" :rows="2" placeholder="选填，补充说明等"></el-input></label>
    </div>
    <template #footer>
      <button class="act" @click="editOpen=false">取消</button>
      <button class="go" @click="saveEditTodo">保存</button>
    </template>
  </el-dialog>

  <div v-if="toast" class="toast">{{ toast }}</div>
</template>

<script>
import coreLogic from './logic/core.js';
import meLogic from './logic/me.js';
import todoOpsLogic from './logic/todoOps.js';
import overviewLogic from './logic/overview.js';
import tasksLogic from './logic/tasks.js';
import bountyLogic from './logic/bounty.js';
import riskLogic from './logic/risk.js';
import exportLogic from './logic/exportLogic.js';
import legacyLogic from './logic/legacy.js';
import HeaderBar from './components/HeaderBar.vue';
import LoginView from './components/LoginView.vue';
import MeView from './components/MeView.vue';
import AdminOverview from './components/AdminOverview.vue';
import AdminTasks from './components/AdminTasks.vue';
import AdminBoard from './components/AdminBoard.vue';
import AdminBounty from './components/AdminBounty.vue';
import AdminVersion from './components/AdminVersion.vue';
import AdminRisk from './components/AdminRisk.vue';
import AdminExport from './components/AdminExport.vue';
import AdminPeople from './components/AdminPeople.vue';

import * as echarts from 'echarts';
import ElementPlus from 'element-plus';
import { ElMessageBox, ElMessage } from 'element-plus';
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
window.ElementPlus = ElementPlus;
window.ElementPlusLocaleZhCn = zhCn;
window.echarts = echarts;
if (ElementPlus.ElMessageBox == null) ElementPlus.ElMessageBox = ElMessageBox;
if (ElementPlus.ElMessage == null) ElementPlus.ElMessage = ElMessage;



export default {
  components: { HeaderBar, LoginView, MeView, AdminOverview, AdminTasks, AdminBoard, AdminBounty, AdminVersion, AdminRisk, AdminExport, AdminPeople },
  provide() { return { root: this }; },
  mixins: [coreLogic, meLogic, todoOpsLogic, overviewLogic, tasksLogic, bountyLogic, riskLogic, exportLogic, legacyLogic],
  data() {
    var saved = '';
    try { saved = window.localStorage.getItem('maos_todo_me') || ''; } catch (e) { saved = ''; }
    /* 调试钩子：URL ?as=名字 可直接进入该成员的个人工作台（无需 localStorage） */
    try { var qs = new URLSearchParams(window.location.search); var as = qs.get('as'); if (as) saved = as; } catch (e) { /* ignore */ }
    return {
      state: null,
      view: 'login', meName: saved, loginName: '', loginErr: '',
      tab: 'overview', curVer: 'v1',
      filterAssignee: '', filterStatus: '', filterType: '',
      exportText: '', promptText: '', toast: '',
      bountyForm: { title: '', desc: '', type: 'other', diff: 'easy' },
      bountyFilter: 'open',
      bugJson: '', bugReport: null,
      quickTitle: '', quickType: 'other', quickDue: '', quickToday: true, quickDev: '', quickTest: '', quickSeries: '', quickDaysNum: null,
      autoType: true, _typePicked: false, _seriesManual: false,
      sortMode: 'smart', tlWidth: 600, openNames: ['open', 'ver'], meFilter: '',
      editOpen: false, editTodo: null, editForm: { title: '', type: 'other', priority: 'P1', dueAt: '', series: '', description: '', peerDev: '', peerTest: '', estDaysNum: null, versionId: '', unitId: '', autoMount: true },
      dndPick: null, nowMs: Date.now(),
      defMap: {},
      newForm: { title: '', type: 'other', priority: 'P1', assigneeId: '', requirementId: '', unitId: '', dueAt: '', estDaysNum: null }
    };
  },
  watch: {
    /* 标题输入时自动联动分类 + 版本线（用户手动选过后版本线不再被标题覆盖） */
    quickTitle(v) {
      if (this.autoType) this.quickType = this.guessType(v);
      if (!this._seriesManual) {
        var s = this.guessSeries(v);
        if (s) this.quickSeries = s;
      }
    },
    'newForm.title'(v) { if (this.autoType) this.newForm.type = this.guessType(v); },
    /* 自动类型开关：关 → 类型默认回「其他」（手动选类型时先置标记避免被重置）；开 → 按当前标题重新识别一次 */
    autoType(v) {
      if (!v) {
        if (!this._typePicked) {
          this.quickType = 'other';
          this.newForm.type = 'other';
        }
        this._typePicked = false;
      } else {
        if (this.quickTitle) this.quickType = this.guessType(this.quickTitle);
        if (this.newForm.title) this.newForm.type = this.guessType(this.newForm.title);
      }
    },
    /* 切视图 / 切管理台 tab 后补绘 ECharts */
    view() { this.paintCharts(); },
    tab() { this.paintCharts(); }
  },
  computed: {
    /* 编辑弹窗：所选版本下的迭代（联动） */
    editVersionUnits() {
      var s = this.state;
      if (!s) return [];
      var v = s.versions.find(function(x){ return x.id === this.editForm.versionId; }.bind(this));
      return (v && v.units) ? v.units.slice().sort(function(a,b){ return (a.index||0)-(b.index||0); }) : [];
    },
    /* 自动匹配模式下提示将要落到的版本/迭代 */
    editMountPreview() {
      var s = this.state;
      if (!s) return '';
      var due = this.editForm.dueAt || '';
      var txt = (this.editForm.title || '') + ' ' + (this.editForm.series || '');
      /* 粗预览：文本里找版本名，或按系列+到期找窗口版本 */
      var vs = s.versions.filter(function(v){ return v.kind !== 'live'; });
      var hit = null;
      for (var i = 0; i < vs.length; i++) {
        var vn = String(vs[i].name || '').toUpperCase();
        if (vn && txt.toUpperCase().indexOf(vn) >= 0) { hit = vs[i]; break; }
      }
      if (!hit) {
        var ser = this.guessSeries(txt);
        var devs = ser ? vs.filter(function(v){ return v.series === ser; }) : [];
        if (due) {
          var inWin = devs.filter(function(v){ return v.freeze <= due && due <= v.release; });
          if (inWin.length) hit = inWin[0];
        }
        if (!hit && devs.length) hit = devs[devs.length - 1];
      }
      if (!hit) return '（未找到匹配版本：确认标题含系列代号如 HCS/HCSO，或到期日落在某版本窗口）';
      var unit = null;
      if (due && hit.units) unit = hit.units.find(function(u){ return u.planStart <= due && due <= u.planEnd; });
      return '将自动归属：' + hit.name + ' · ' + (this.seriesLabel ? this.seriesLabel(hit.series) : hit.series) + (unit ? ' → ' + unit.name : '（按到期日精确到迭代）');
    }
  },

  mounted() {
    var self = this;
    window.addEventListener('hashchange', function(){
      self.parseRoute();
      self.paintCharts();
    });
    window.addEventListener('resize', function(){
      ['loadHeat', 'manDaysBar', 'monthDoneBar', 'bugRankBar'].forEach(function(id){
        var el = document.getElementById(id);
        if (el && typeof echarts !== 'undefined') { var g = echarts.getInstanceByDom(el); if (g) g.resize(); }
      });
    });
    /* 免打扰倒计时：每秒刷新本地时钟，驱动所有倒计时徽章 */
    this._tick = setInterval(function(){ self.nowMs = Date.now(); }, 1000);
    this.reload().then(function(){
      if (self.meName) {
        var emp = self.state.employees.find(function(e){ return e.name === self.meName; });
        if (!emp) {
          self.meName = '';
          try { window.localStorage.removeItem('maos_todo_me'); } catch (e) { /* ignore */ }
        }
      }
      self.parseRoute();
      if (self.meName) {
        try { window.localStorage.setItem('maos_todo_me', self.meName); } catch (e) { /* ignore */ }
        var em = self.state.employees.find(function(e){ return e.name === self.meName; });
        if (em) self.newForm.assigneeId = em.id;
      }
      self.paintCharts();
    });
  }
};

</script>