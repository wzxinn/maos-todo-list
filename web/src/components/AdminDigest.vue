<template>
  <div>
    <!-- ===== 催办提醒 ===== -->
    <div class="panel" style="margin-bottom:12px">
      <div class="row spread" style="margin-bottom:4px">
        <h3 style="margin-bottom:0">催办提醒 · 一键生成</h3>
        <div class="row" style="gap:6px">
          <span class="muted small">提前</span>
          <el-select v-model="remindDays" style="width:90px" size="small">
            <el-option label="1 天内" :value="1"></el-option>
            <el-option label="2 天内" :value="2"></el-option>
            <el-option label="3 天内" :value="3"></el-option>
          </el-select>
          <span class="muted small">到期</span>
          <button class="act op" @click="genRemind" :disabled="!remindRows.length" title="按成员生成催办文案">生成催办</button>
        </div>
      </div>
      <div class="hint" style="margin-bottom:8px">扫出每位成员「即将到期 / 已超期且未完成」的待办，按人分组拼一段可直接发到成员群的消息；点「生成」后自动复制，粘贴到群里即可。</div>
      <div v-if="remindOut" class="mono" style="background:#f7f9fc;border:1px dashed var(--line2);border-radius:8px;padding:8px 10px;white-space:pre-wrap;font-size:12px;line-height:1.7;color:#303133">{{ remindOut }}</div>
      <div v-else class="hint">如果没人有临近到期或超期的未完成待办，这里会是空的（生成按钮不可点）。</div>
    </div>

    <!-- ===== 今日团队产出总结 ===== -->
    <div class="panel">
      <div class="row spread" style="margin-bottom:4px">
        <h3 style="margin-bottom:0">今日团队产出 · 一键生成</h3>
        <button class="act op" @click="genSummary" :disabled="!summaryRows.length" title="按成员汇总今天完成的事项">生成总结</button>
      </div>
      <div class="hint" style="margin-bottom:8px">把今天完成过的事项（含人天）按成员汇总，生成一段适合发群/发邮件的日报文案，自动复制到剪贴板。</div>
      <div v-if="summaryOut" class="mono" style="background:#f7f9fc;border:1px dashed var(--line2);border-radius:8px;padding:8px 10px;white-space:pre-wrap;font-size:12px;line-height:1.7;color:#303133">{{ summaryOut }}</div>
      <div v-else class="hint">今天还没有成员完成过事项，晚上再来看就热闹了。</div>
    </div>
  </div>
</template>

<script>
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'AdminDigest',
  inject: ['root'],
  data() {
    return { remindDays: 1, remindOut: '', summaryOut: '' };
  },
  computed: Object.assign(rc(ROOT_DATA.concat(ROOT_COMPUTED)), {
    /* 每位成员即将到期（含超期）的未完成待办 */
    remindRows() {
      var s = this.state;
      if (!s) return [];
      var horizon = this.remindDays;
      var rows = {};
      s.todos.forEach(function(t){
        if (t.status === 'done' || t.status === 'canceled') return;
        if (t.dueDiff == null) return;
        if (t.dueDiff <= horizon) {           /* 超期（负数）或临近 */
          var who = t.assigneeName || '未指派';
          rows[who] = rows[who] || [];
          rows[who].push(t);
        }
      });
      var out = Object.keys(rows).map(function(name){
        var list = rows[name].sort(function(a, b){ return (a.dueDiff - b.dueDiff); });
        return { name: name, items: list };
      }).sort(function(a, b){ return (a.name < b.name ? -1 : 1); });
      return out;
    },
    /* 今天完成的事项（doneAt/updatedAt 是今天）按人汇总 */
    summaryRows() {
      var s = this.state;
      if (!s) return [];
      var today = s.today;
      var rows = {};
      s.todos.forEach(function(t){
        if (t.status !== 'done') return;
        var at = t.doneAt || t.updatedAt || '';
        if (String(at).slice(0, 10) !== today) return;
        var who = t.assigneeName || '未指派';
        rows[who] = rows[who] || [];
        rows[who].push(t);
      });
      var out = Object.keys(rows).map(function(name){
        var list = rows[name].sort(function(a, b){ return (a.updatedAt < b.updatedAt ? -1 : 1); });
        return { name: name, items: list };
      }).sort(function(a, b){ return (a.name < b.name ? -1 : 1); });
      return out;
    }
  }),
  methods: Object.assign(rm(ROOT_METHODS), {
    _fmtDue(t) {
      if (!t.dueAt) return '';
      if (t.dueDiff < 0) return '已超期 ' + (-t.dueDiff) + ' 天';
      if (t.dueDiff === 0) return '今天截止';
      return '剩 ' + t.dueDiff + ' 天';
    },
    genRemind() {
      var self = this;
      var s = this.state;
      var NL = String.fromCharCode(10);
      var L = [];
      L.push('⏰ 催办提醒 · ' + s.today + '（临近截止/超期未完成）');
      L.push('');
      this.remindRows.forEach(function(row){
        L.push('@' + row.name + ' 你还有 ' + row.items.length + ' 项待办要收口：');
        row.items.forEach(function(t){
          var prio = t.priorityLabel ? '（' + t.priorityLabel + '）' : '';
          L.push('  · ' + t.title + ' —— ' + self._fmtDue(t) + prio);
        });
        L.push('');
      });
      L.push('请确认预计完成时间；忙不过来的尽早说，好安排人支援～');
      var text = L.join(NL);
      this.remindOut = text;
      this.copyText(text);
      this.root.toastMsg('催办文案已生成并复制 📋');
    },
    genSummary() {
      var self = this;
      var s = this.state;
      var NL = String.fromCharCode(10);
      var total = 0;
      var L = [];
      L.push('📊 今日团队产出 · ' + s.today);
      L.push('');
      this.summaryRows.forEach(function(row){
        var days = row.items.reduce(function(sum, t){ return sum + (t.estDays || 0); }, 0);
        total += days;
        L.push('✅ ' + row.name + '：完成 ' + row.items.length + ' 项' + (days ? '（约 ' + days + ' 人天）' : ''));
        row.items.forEach(function(t){
          var extra = [];
          if (t.typeLabel) extra.push(t.typeLabel);
          if (t.verName) extra.push(t.verName);
          if (t.unitShort) extra.push(t.unitShort);
          L.push('  · ' + t.title + (extra.length ? '　' + extra.join(' / ') : ''));
        });
        L.push('');
      });
      L.push('今日合计完成 ' + this.summaryRows.reduce(function(n, r){ return n + r.items.length; }, 0) + ' 项' + (total ? ' · 约 ' + Math.round(total * 10) / 10 + ' 人天' : ''));
      var text = L.join(NL);
      this.summaryOut = text;
      this.copyText(text);
      this.root.toastMsg('今日产出总结已生成并复制 📋');
    }
  })
};
</script>
