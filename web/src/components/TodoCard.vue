<template>
  <div class="todo-item" :class="[todoCls(t), mode==='done' ? 'row spread' : 'td-col']">
    <!-- ============ 已完成（精简行） ============ -->
    <div class="row" style="flex:1" v-if="mode==='done'">
      <span class="chip mono small" :style="'color:'+t.typeColor+';border-color:'+t.typeColor">{{ t.typeLabel }}</span>
      <template v-if="t.series"><span class="mono small" :style="'color:'+seriesColor(t.series)">{{ seriesLabel(t.series) }}</span></template>
      <s class="small t-title">{{ t.title }}</s>
    </div>
    <div class="row" v-if="mode==='done'">
      <span class="muted mono small">完成于 {{ (t.updatedAt||'').slice(0,16).replace('T',' ') }}</span>
      <button class="act op" @click="openEditTodo(t)">编辑</button>
      <button class="act op" @click="setStatus(t,'todo')">重开</button>
      <button class="act op" @click="delTodo(t)">删除</button>
    </div>
    <div v-if="mode==='done' && t.description" class="t-desc" style="flex-basis:100%">{{ t.description }}</div>

    <!-- ============ 未完成（三段式） ============ -->
    <template v-if="mode!=='done'">
      <div class="td-main">
        <!-- head：左=紧急/类型/风险；右=剩余天数 -->
        <div class="td-head row spread">
          <div class="row" style="gap:5px">
            <span class="chip mono small" :style="'color:'+t.priorityColor+';border-color:'+t.priorityColor" title="紧急程度">{{ t.priorityLabel }}</span>
            <span class="chip mono small" :style="'color:'+t.typeColor+';border-color:'+t.typeColor">{{ t.typeLabel }}</span>
            <span v-if="t.meta && t.meta.risk === true" class="chip mono small" style="border-color:#f56c6c;color:#c4561d;background:#fdf6ec" :title="(t.meta&&t.meta.riskNote)||'已上报风险，见管理台风险看板'">已报风险</span>
            <span v-if="isDnd(t)" class="chip mono small" style="border-color:#67c23a;color:#529a43;background:#f0f9eb">专注中 · {{ dndLeftText(t) }}</span>
          </div>
          <div class="row" style="gap:5px">
            <span v-if="t.dueAt" class="chip mono small" :style="ddlStyle(t)" :title="t.dueAt">{{ ddlText(t) }}</span>
          </div>
        </div>

        <!-- 第二行：左=需求/BUG 单号 + 所属版本及迭代(hover 转测)；右=悬赏 -->
        <div class="td-links row spread">
          <div class="row" style="gap:5px;flex-wrap:wrap">
            <template v-if="t.bugNo">
              <a v-if="t.bugUrl" class="chip mono small buglink" :href="t.bugUrl" target="_blank" rel="noopener" :title="(t.reqName ? t.reqName + ' · ' : '') + '在 BUG 平台打开详情（新标签页）'">BUG-{{ t.bugNo }} ↗</a>
              <span v-else class="chip mono small" style="border-color:#db2777;color:#be185d" :title="t.reqName || ''">BUG-{{ t.bugNo }}</span>
            </template>
            <template v-else-if="t.reqNo">
              <a v-if="t.reqUrl" class="chip mono small" style="border-color:#0e7490;color:#0e7490;background:#ecfeff;text-decoration:none" :href="t.reqUrl" target="_blank" rel="noopener" :title="(t.reqName ? t.reqName + ' · ' : '') + '在需求平台打开（新标签页）'">{{ t.reqNo }} ↗</a>
              <span v-else class="chip mono small" style="border-color:#0e7490;color:#0e7490" :title="t.reqName || ''">{{ t.reqNo }}</span>
            </template>
            <template v-if="t.verName || t.unitShort">
              <span v-if="t.series && t.series!=='其他'" class="chip mono small" :style="'color:'+seriesColor(t.series)+';border-color:'+seriesColor(t.series)" :title="iterTitle(t)">{{ '#' + t.series }} {{ t.verName }}<template v-if="t.unitShort"> · {{ t.unitShort }}</template></span>
              <span v-else class="chip mono small muted" :title="iterTitle(t)">{{ t.verName }}<template v-if="t.unitShort"> · {{ t.unitShort }}</template></span>
            </template>
          </div>
          <span v-if="t.bounty" class="chip mono small" :style="'color:'+t.bounty.diffColor+';border-color:'+t.bounty.diffColor+';background:#fffaf0'" :title="'公共悬赏 · ' + t.bounty.diffLabel + ' 难度'">悬赏 · {{ t.bounty.diffLabel }}</span>
        </div>

        <!-- body：名称 / 描述 / 当前进度 / Owner -->
        <div class="td-body">
          <div class="td-title">{{ t.title }}</div>
          <div v-if="t.description" class="t-desc">{{ t.description }}</div>
          <div class="td-prog" v-if="t.status!=='canceled'">
            <span class="muted small" style="margin-right:2px">{{ t.type==='bug' ? '缺陷流转' : '进度' }}</span>
            <el-button-group class="prog-group">
              <el-button v-for="s in progressStages" :key="s" size="small" :type="t.progress===s ? 'primary' : 'default'" :class="t.progress===s ? 'prog-on' : ''" @click="setProgress(t,s)">{{ s }}</el-button>
            </el-button-group>
          </div>
          <div class="td-owner row small" v-if="(mode==='open' || mode==='today') && t.type!=='bug'">
            <button class="peer-chip" @click="editPeer(t,'dev')" :title="ownerDev ? '点击修改特性 Owner' : '点击填写特性 Owner'">特性 Owner: {{ ownerDev || '—' }}</button>
            <button class="peer-chip" @click="editPeer(t,'test')" :title="ownerTest ? '点击修改测试责任人' : '点击填写测试责任人'">测试责任人: {{ ownerTest || '—' }}</button>
          </div>
        </div>
      </div>

      <!-- foot：操作区 -->
      <div v-if="xferOpen" class="xfer-row row small">
        <span class="muted small" style="font-weight:700;color:#14355f">转交给：</span>
        <template v-if="xferCandidates.length">
          <button v-for="e in xferCandidates" :key="e.id" class="act op" @click="transferTodo(t, e)" :title="'转给 ' + e.name + '（' + (e.role||'') + '）'">{{ e.name }}</button>
        </template>
        <span v-else class="hint">没有其他成员可转（去管理台-人员里加人）</span>
        <button class="act" style="border-color:#c0c4cc;color:#909399" @click="xferOpen=false">取消</button>
      </div>
      <div class="td-foot row spread">
        <div class="row">
          <button class="act op" @click="openEditTodo(t)" title="编辑标题/类型/优先级/截止/版本线/对接人/描述">编辑</button>
          <button v-if="t.status==='todo'" class="act op" @click="startTodo(t)">开始处理</button>
          <button v-if="t.status==='doing'" class="act op" @click="finishTodo(t)">完成</button>
          <button v-if="t.status==='doing'" class="act op" @click="riskTodo(t)">报风险</button>
          <template v-if="t.status==='review'">
            <button class="act op" @click="setStatus(t,'done')">评审通过</button>
            <button class="act op" @click="setStatus(t,'doing')">驳回返工</button>
          </template>
          <button v-if="t.status==='doing'" class="act op" @click="shelfTodo(t)">暂时搁置</button>
          <button class="act op" @click="xferOpen=!xferOpen" title="忙不过来时把这条转给别人负责">{{ xferOpen ? '收起转交' : '转交' }}</button>
          <button class="act op" @click="delTodo(t)">删除</button>
        </div>
        <div class="row" style="align-items:center">
          <template v-if="isDnd(t)">
            <button class="act op-focus" @click="setDnd(t,0)" title="结束专注">结束专注</button>
          </template>
          <template v-else-if="dndPick===t.id">
            <span class="muted small">专注多久：</span>
            <button class="act op-focus" @click="setDnd(t,30)">30分钟</button>
            <button class="act op-focus" @click="setDnd(t,60)">1小时</button>
            <button class="act op-focus" @click="setDnd(t,120)">2小时</button>
            <button class="act op-focus" @click="setDnd(t,240)">4小时</button>
            <button class="act op-focus" @click="dndPick=null">取消</button>
          </template>
          <button v-else-if="t.status==='doing'" class="act op-focus" @click="dndPick=t.id" title="一段时间内不被催/不打扰，专注干活">专注</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ElMessageBox } from 'element-plus';
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'TodoCard',
  inject: ['root'],
  props: { t: Object, mode: { type: String, default: 'today' } },
  data() { return { xferOpen: false }; },
  computed: Object.assign(rc(ROOT_DATA.concat(ROOT_COMPUTED)), {
    /* 卡片上展示的 Owner / 测试责任人（复用 peerDev/peerTest 数据） */
    ownerDev() { return (this.t.meta && this.t.meta.peerDev) || ''; },
    ownerTest() { return (this.t.meta && this.t.meta.peerTest) || ''; },
    /* 转交候选：全员（除自己外），按名字排 */
    xferCandidates() {
      var s = this.state;
      if (!s || !s.employees) return [];
      var meId = this.me ? this.me.id : (this.t.assigneeId || '');
      return s.employees.filter(function(e){ return e.id !== meId; })
        .sort(function(a, b){ return (a.name < b.name ? -1 : 1); });
    },
    progressStages() {
      /* BUG 类走缺陷流转，其余需求/任务走研发阶段 */
      if (this.t.type === 'bug') return ['待处理', '已分析', '修复中', '修复完成', '已转测'];
      return ['方案设计', '方案评审', '等交互稿', '代码开发', '双端联调', '转测修单', '发布上线'];
    }
  }),
  methods: Object.assign(rm(ROOT_METHODS), {
    /* 转交任务给他人：状态/今日标记原样保留，对方直接接手 */
    transferTodo(t, emp) {
      var self = this;
      var me = this.me;
      ElMessageBox.confirm(
        '把「' + t.title + '」转交给 ' + emp.name + '（' + (emp.role || '') + '）？\n转走后它会从你的列表消失，出现在对方列表；状态原样保留。',
        '转交任务', { confirmButtonText: '转交', cancelButtonText: '取消', type: 'info' }
      ).then(function(){
        self.root.api('/api/todo/' + t.id + '/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: emp.id, by: me ? me.id : 'sys' }) })
          .then(function(r){
            self.xferOpen = false;
            if (r && r.ok) { self.root.toastMsg('已转交给 ' + emp.name + '：' + t.title); self.root.reload(); }
            else self.root.toastMsg('转交失败：' + (r && r.error ? r.error : ''));
          });
      }).catch(function(){ /* 取消 */ });
    },
    /* 迭代 chip 的 hover：转测时间/迭代窗口 */
    iterTitle(t) {
      var parts = [];
      if (t.unitShort) parts.push('迭代 ' + t.unitShort);
      if (t.unitPlanStart && t.unitPlanEnd) parts.push('窗口 ' + t.unitPlanStart.slice(5) + ' ~ ' + t.unitPlanEnd.slice(5));
      if (t.unitExamAt) parts.push('转测 ' + t.unitExamAt.slice(5));
      else if (t.unitShort) parts.push('转测未排期');
      return parts.join(' · ') || (t.verName || '');
    }
  })
};
</script>

<style scoped>
/* 背景/边框沿用全局 .todo-item 样式（含 b-done 灰底），这里只处理三段布局 */
.td-col { display: flex; flex-direction: column; align-items: stretch }
.td-main { width: 100%; }
.td-head { gap: 8px; margin-bottom: 6px; }
.td-links { gap: 8px; margin-bottom: 6px; }
.td-links .buglink { text-decoration: none }
.td-title { font-weight: 700; font-size: 14px; color: #17233d; margin: 1px 0 2px; }
.td-body .t-desc { margin-bottom: 6px }
.td-prog { display: flex; align-items: center; gap: 4px; margin: 2px 0 6px; flex-wrap: wrap }
.td-prog .prog-group { flex-wrap: wrap; row-gap: 3px }
.td-prog .prog-group .el-button { margin-left: 0 !important; }
.td-owner { gap: 8px; margin: 1px 0 6px }
.td-foot { border-top: 1px dashed #ebeef5; padding-top: 7px; margin-top: 2px; gap: 10px; align-items: center }
@media (max-width: 900px) { .td-foot { flex-direction: column; align-items: flex-start } }
</style>
