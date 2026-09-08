<template>
  <!-- 个人工作台：只看自己 -->
  <div class="userbar">
    <avatar-badge :who="me"></avatar-badge>
    <span class="who">{{ me.name }} · {{ me.role }}</span>
    <span class="hint">这里是你的待办工作台，今天该干什么一眼看清；上方输入内容回车即加待办，版本节奏/已完成在右侧折叠即可。</span>
    <template v-if="todayDueCount>0 || todayOverdueCount>0">
      <span class="chip" style="color:#e6a23c;border-color:#e6a23c">今天截止 {{ todayDueCount }}</span>
      <span class="chip" style="color:#f56c6c;border-color:#f56c6c">已超期 {{ todayOverdueCount }}</span>
    </template>
    <button class="act op" @click="exportMeTodos" title="把当前待办任务复制到剪贴板（今日待办 + 未完成事项）">复制待办</button>
    <button class="act op" @click="openDoneExport" title="按时间范围导出我已完成的工作项，并按版本分类汇总">导出已完成</button>

    <!-- 导出已完成：时间范围 + 按版本汇总 -->
    <el-dialog v-model="expOpen" title="导出已完成工作项" width="520px" append-to-body>
      <div class="stack" style="gap:8px">
        <div class="row" style="align-items:center;gap:8px">
          <span class="muted small">完成时间范围：</span>
          <el-date-picker v-model="expFrom" type="date" value-format="YYYY-MM-DD" placeholder="开始" style="width:150px"></el-date-picker>
          <span class="muted small">至</span>
          <el-date-picker v-model="expTo" type="date" value-format="YYYY-MM-DD" placeholder="结束" style="width:150px"></el-date-picker>
        </div>
        <div class="row small" style="gap:6px">
          <span class="muted small">快捷：</span>
          <button class="act" @click="setQuick(7)">近7天</button>
          <button class="act" @click="setQuick(30)">近30天</button>
          <button class="act" @click="setMonth">本月</button>
          <button class="act" @click="setAll">全部</button>
        </div>
        <div class="hint">统计范围内我已完成（done）的工作项，按版本线分组汇总：各版本完成的需求 / 悬赏 / BUG修复 / 其他，并列出每项明细。结果复制到剪贴板。</div>
      </div>
      <template #footer>
        <button class="act" @click="expOpen=false">取消</button>
        <button class="go" @click="buildDoneReport" :disabled="!me">生成并复制</button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import AvatarBadge from './AvatarBadge.vue';
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'MeUserbar',
  inject: ['root'],
  components: { AvatarBadge },
  data() {
    var d = new Date();
    var pad = function(n){ return n < 10 ? '0' + n : '' + n; };
    var todayS = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    var from = new Date(d.getFullYear(), d.getMonth(), 1);
    return { expOpen: false, expFrom: from.getFullYear() + '-' + pad(from.getMonth() + 1) + '-' + pad(from.getDate()), expTo: todayS };
  },
  computed: Object.assign(rc(ROOT_DATA.concat(ROOT_COMPUTED)), {}),
  methods: Object.assign(rm(ROOT_METHODS), {
    openDoneExport() { this.setMonth(); this.expOpen = true; },
    fmt(d) { var x = new Date(d); var p = function(n){ return n < 10 ? '0' + n : '' + n; }; return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()); },
    setQuick(n) {
      var to = new Date(); to.setHours(0,0,0,0);
      var from = new Date(to); from.setDate(from.getDate() - (n - 1));
      this.expTo = this.fmt(to);
      this.expFrom = this.fmt(from);
    },
    setMonth() {
      var now = new Date();
      this.expTo = this.fmt(now);
      this.expFrom = this.fmt(new Date(now.getFullYear(), now.getMonth(), 1));
    },
    setAll() {
      this.expFrom = '';
      this.expTo = '';
    },
    buildDoneReport() {
      var self = this;
      if (!self.me || !self.state) return;
      var NL = String.fromCharCode(10);
      var L = [];
      L.push('已完成工作导出 · ' + self.me.name + ' · ' + self.me.role);
      L.push('时间范围：' + (this.expFrom || '最早') + ' ~ ' + (this.expTo || '今天') + '　导出时间：' + this.state.today);
      L.push('');
      /* 我已完成且（未限定范围 或 doneAt 在范围内） */
      var fromS = this.expFrom, toS = this.expTo;
      var inRange = function(d){ return (!fromS || d >= fromS) && (!toS || d <= toS); };
      var mine = self.state.todos.filter(function(t){
        if (t.assigneeId !== self.me.id) return false;
        if (t.status !== 'done') return false;
        var doneAt = t.doneAt || t.updatedAt;
        var dd = (doneAt || '').slice(0, 10);
        return inRange(dd);
      });

      if (!mine.length) { this.root.toastMsg('该时间范围内没有已完成的工作项'); return; }

      var seriesOrder = ['HC', 'HCS', 'HCSO', '上线', '其他'];
      var groups = {};
      mine.forEach(function(t){
        var key = seriesOrder.indexOf(t.series) >= 0 ? t.series : '其他';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });

      var labelOf = function(k){ return self.seriesLabel(k); };
      var count = 0;
      seriesOrder.forEach(function(ser){
        var list = groups[ser];
        if (!list || !list.length) return;
        count += list.length;
        /* 分类计数：需求 / 悬赏 / BUG修复 / 其他待办 */
        var c = { requirement: 0, bounty: 0, bug: 0, other: 0 };
        list.forEach(function(t){
          if (t.bounty) { c.bounty++; return; }
          if (t.type === 'requirement') c.requirement++;
          else if (t.type === 'bug') c.bug++;
          else c.other++;
        });
        var parts = [];
        if (c.requirement) parts.push('需求 ' + c.requirement + ' 个');
        if (c.bounty) parts.push('悬赏 ' + c.bounty + ' 个');
        if (c.bug) parts.push('BUG修复 ' + c.bug + ' 个');
        if (c.other) parts.push('其他待办 ' + c.other + ' 个');
        L.push('【' + labelOf(ser) + '版本】完成 ' + list.length + ' 项：' + parts.join('、'));
        /* 明细：每项一行，done 时间排序 */
        list.slice().sort(function(a, b){ var da = (a.doneAt || a.updatedAt || ''); var db = (b.doneAt || b.updatedAt || ''); return (da < db ? 1 : -1); }).forEach(function(t){
          var dn = ((t.doneAt || t.updatedAt) || '').slice(0, 10);
          var kind = t.bounty ? '悬赏' : (t.typeLabel || t.type);
          L.push('  - [' + dn + '] ' + kind + '：' + t.title + (t.reqNo ? '（' + t.reqNo + '）' : '') + (t.unitName ? '　' + t.unitName : ''));
        });
        L.push('');
      });
      L.push('合计 ' + count + ' 项');
      this.copyText(L.join(NL));
      this.root.toastMsg('已复制已完成工作汇总（' + count + ' 项）');
    }
  })
};
</script>
