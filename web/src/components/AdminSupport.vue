<template>
  <div>
    <!-- ===== 成员是否可支撑 ===== -->
    <div class="panel" style="margin-bottom:12px">
      <div class="row spread" style="margin-bottom:6px">
        <h3 style="margin-bottom:0">成员是否可支撑 · 谁现在能接活</h3>
        <button class="act op" @click="reload" title="刷新数据">刷新</button>
      </div>
      <div class="hint" style="margin-bottom:8px">口径：排在前面的越可支撑 —— 非专注 / 非 OnCall 的成员按「近 5 天待办数」从少到多；专注中与 OnCall 值守排最后，默认不派活。行尾的「活动」是该成员所有未完成事项数（不限 5 天）。</div>
      <div class="stack" v-if="supportRows.length" style="gap:6px">
        <div v-for="row in supportRows" :key="row.emp.id" class="row spread" style="align-items:center;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:#fff">
          <div class="row" style="align-items:center;gap:8px;flex:1;min-width:0">
            <avatar-badge :who="row.emp"></avatar-badge>
            <div style="min-width:0">
              <div style="font-weight:700;color:#17233d">{{ row.emp.name }} <span class="muted small">{{ row.emp.role }}</span></div>
              <div class="muted small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                <template v-if="row.focus">手头有专注任务（正在深度处理）</template>
                <template v-else-if="row.oncall">OnCall 值守 {{ row.ocNow.from.slice(5) }} ~ {{ row.ocNow.to.slice(5) }}</template>
                <template v-else-if="row.ocUp">已排 OnCall：{{ row.ocUp.from }} ~ {{ row.ocUp.to }}</template>
                <template v-else>近 5 天待办 {{ row.near5 }} 项</template>
              </div>
            </div>
          </div>
          <div class="row" style="align-items:center;gap:8px">
            <span class="chip mono small">{{ '活动 ' + row.emp.load.activeTodos }}</span>
            <span class="chip mono small" :style="row.focus ? 'border-color:#67c23a;color:#529a43;background:#f0f9eb' : (row.oncall ? 'border-color:#e6a23c;color:#b25e09;background:#fdf6ec' : 'border-color:#409eff;color:#1f6fd6;background:#ecf5ff')">
              {{ row.focus ? '专注中' : (row.oncall ? 'OnCall' : ('可支撑 · 近5天 ' + row.near5)) }}
            </span>
          </div>
        </div>
      </div>
      <div v-else class="hint">还没有成员，去「人员管理」先加人。</div>
    </div>

    <!-- ===== OnCall 值班日历图 ===== -->
    <div class="panel" style="margin-bottom:12px">
      <div class="row spread" style="margin-bottom:6px">
        <h3 style="margin-bottom:0">OnCall 值班日历</h3>
        <button class="act op" @click="renderOcChart" title="重绘时间线">重绘</button>
      </div>
      <div class="hint" style="margin-bottom:8px">横轴为日期，每条色带 = 一位成员的 OnCall 区间（含首尾日）；红虚线 = 今天。只画「今天起及未来」的值守，过期的在下方表格里能查。</div>
      <div ref="ocChart" style="width:100%;height:300px"></div>
      <div v-if="!ocVisibleRows.length" class="hint" style="margin-top:6px">还没有 OnCall 排班，在下面录入一条，图就会长出来。</div>
    </div>

    <!-- ===== OnCall 排班表：录入入口 + 列表 ===== -->
    <div class="panel">
      <h3>OnCall 排班表</h3>
      <div class="row" style="gap:8px;align-items:center;padding:8px 10px;background:#f7f9fc;border:1px solid var(--line);border-radius:8px;margin-bottom:10px;flex-wrap:wrap">
        <span class="muted small" style="font-weight:700;color:#14355f">新增 OnCall：</span>
        <el-select v-model="ocForm.empId" placeholder="选成员" style="width:140px" size="small">
          <el-option v-for="e in state.employees" :key="e.id" :label="e.name + ' · ' + e.role" :value="e.id"></el-option>
        </el-select>
        <el-date-picker v-model="ocForm.from" type="date" value-format="YYYY-MM-DD" placeholder="开始日" style="width:130px" size="small"></el-date-picker>
        <span class="muted small">至</span>
        <el-date-picker v-model="ocForm.to" type="date" value-format="YYYY-MM-DD" placeholder="结束日" style="width:130px" size="small"></el-date-picker>
        <button class="go" @click="addOncall" :disabled="!ocForm.empId || !ocForm.from || !ocForm.to">添加排班</button>
      </div>
      <div v-if="oncallRows.length">
        <table>
          <thead><tr><th>成员</th><th>开始</th><th>结束</th><th>状态</th><th style="width:90px">操作</th></tr></thead>
          <tbody>
            <tr v-for="o in oncallRows" :key="o.id">
              <td>{{ o.empName }} <span class="muted small">{{ o.empRole }}</span></td>
              <td class="mono small">{{ o.from }}</td>
              <td class="mono small">{{ o.to }}</td>
              <td>
                <span v-if="o.on" class="chip mono small" style="border-color:#e6a23c;color:#b25e09;background:#fdf6ec">值守中</span>
                <span v-else-if="o.to < state.today" class="chip mono small" style="border-color:#c0c4cc;color:#909399">已结束</span>
                <span v-else class="chip mono small" style="border-color:#409eff;color:#1f6fd6;background:#ecf5ff">待值守</span>
              </td>
              <td><button class="act" style="border-color:#fbc4c4;color:#f56c6c" @click="removeOncall(o)">取消</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="hint">还没有 OnCall 排班，用上面的「新增 OnCall」加一条。</div>
    </div>
  </div>
</template>

<script>
import * as echarts from 'echarts';
import AvatarBadge from './AvatarBadge.vue';
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';

export default {
  name: 'AdminSupport',
  inject: ['root'],
  components: { AvatarBadge },
  data() {
    return { ocForm: { empId: '', from: '', to: '' } };
  },
  computed: Object.assign(rc(ROOT_DATA.concat(ROOT_COMPUTED)), {
    oncallRows() {
      var s = this.state;
      if (!s) return [];
      return (s.oncalls || []).slice().sort(function(a, b){ return (a.from < b.from ? -1 : a.from > b.from ? 1 : 0); });
    },
    /* 图上画的排班：今天起及未来（进行中/待值守），按人归组 */
    ocVisibleRows() {
      var s = this.state;
      if (!s) return [];
      var today = s.today;
      return (s.oncalls || []).filter(function(o){ return o.to >= today; })
        .sort(function(a, b){ return (a.from < b.from ? -1 : a.from > b.from ? 1 : 0); });
    }
  }),
  methods: Object.assign(rm(ROOT_METHODS), {
    addOncall() {
      var self = this;
      var f = this.ocForm;
      var emp = this.state.employees.find(function(e){ return e.id === f.empId; });
      if (!emp) { this.root.toastMsg('先选一个成员～'); return; }
      if (!f.from || !f.to) { this.root.toastMsg('起止日期都要选～'); return; }
      if (f.to < f.from) { this.root.toastMsg('结束不能早于开始～'); return; }
      this.root.api('/api/oncall', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empId: f.empId, from: f.from, to: f.to, by: this.root.me ? this.root.me.id : 'sys' }) })
        .then(function(r){
          if (r && r.ok) {
            self.root.toastMsg('已添加 OnCall 排班：' + emp.name + ' ' + f.from + ' ~ ' + f.to);
            self.ocForm = { empId: '', from: '', to: '' };
            self.root.reload();
          } else {
            self.root.toastMsg((r && r.error) ? r.error : '添加失败');
          }
        });
    },
    removeOncall(o) {
      var self = this;
      this.root.api('/api/oncall/' + o.id + '/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ by: this.root.me ? this.root.me.id : 'sys' }) })
        .then(function(r){
          if (r && r.ok) { self.root.toastMsg('已取消排班：' + o.empName + ' ' + o.from + ' ~ ' + o.to); self.root.reload(); }
          else self.root.toastMsg((r && r.error) ? r.error : '取消失败');
        });
    },
    /* ===== OnCall 日历时间线图 ===== */
    renderOcChart() {
      var el = this.$refs.ocChart;
      if (!el || el.clientWidth === 0) return;
      var rows = this.ocVisibleRows;
      var today = this.state.today;
      var DAY = 86400000;
      var par = function(ds){ return Date.parse(ds + 'T00:00:00Z'); };
      if (!rows.length) {
        var ch0 = echarts.getInstanceByDom(el);
        if (ch0) { ch0.clear(); }
        return;
      }
      var lanes = [];
      rows.forEach(function(o){ if (lanes.indexOf(o.empName) < 0) lanes.push(o.empName); });
      var palette = ['#e6a23c', '#f59e0b', '#f97316', '#ef8a3c', '#d97706', '#ea9736', '#e0a83a', '#cf7f1f'];
      /* 每段排班一条粗横线（两端有点，点上 hover 出详情） */
      var bandSeries = rows.map(function(o){
        var li = lanes.indexOf(o.empName);
        return {
          name: o.empName,
          type: 'line',
          data: [
            { value: [par(o.from), o.empName], o: o },
            { value: [par(o.to), o.empName], o: o }
          ],
          symbol: 'circle', symbolSize: 8,
          lineStyle: { width: 22, color: palette[li % palette.length], opacity: 0.55, cap: 'round' },
          itemStyle: { color: palette[li % palette.length], borderColor: '#fff', borderWidth: 1.5 },
          z: 3,
          emphasis: { focus: 'none' }
        };
      });
      var todaySeries = {
        type: 'line', data: [], silent: true,
        markLine: {
          symbol: 'none',
          lineStyle: { color: '#f56c6c', type: 'dashed', width: 1.5 },
          label: { show: true, position: 'end', formatter: '今天', color: '#f56c6c', fontSize: 11 },
          data: [{ xAxis: par(today) }]
        },
        z: 5
      };
      var allMs = rows.map(function(o){ return par(o.from); }).concat(rows.map(function(o){ return par(o.to); })).concat([par(today)]);
      var minMs = Math.min.apply(null, allMs) - 2 * DAY;
      var maxMs = Math.max.apply(null, allMs) + 2 * DAY;
      var chart = echarts.getInstanceByDom(el) || echarts.init(el);
      chart.setOption({
        animationDuration: 150,
        grid: { left: 84, right: 20, top: 20, bottom: 30 },
        tooltip: {
          trigger: 'item', confine: true,
          backgroundColor: 'rgba(255,255,255,.98)', borderColor: '#cbd5e1',
          textStyle: { color: '#303133', fontSize: 12 },
          formatter: function(p){
            if (!p || !p.data) return '';
            var o = p.data.o || p.data;
            if (!o || !o.empName) return '';
            var st = o.on ? '值守中' : (o.to < today ? '已结束' : '待值守');
            return '<b>' + o.empName + ' OnCall</b><br/>' + o.from + ' ~ ' + o.to + '<br/>' + st;
          }
        },
        xAxis: {
          type: 'value', min: minMs, max: maxMs,
          axisLabel: { color: '#909399', hideOverlap: true, formatter: function(v){ var d = new Date(v); var p = function(n){ return n < 10 ? '0' + n : '' + n; }; return p(d.getMonth() + 1) + '-' + p(d.getDate()); } },
          splitLine: { show: false },
          axisLine: { lineStyle: { color: '#dcdfe6' } }
        },
        yAxis: {
          type: 'category', data: lanes, inverse: true,
          axisLabel: { color: '#334155', fontWeight: 700, fontSize: 12 },
          axisLine: { show: false }, axisTick: { show: false }
        },
        series: bandSeries.concat([todaySeries])
      });
    }
  }),
  mounted() {
    var self = this;
    this._ocResize = function(){ self.$nextTick(self.renderOcChart); };
    this.$nextTick(this.renderOcChart);
    window.addEventListener('resize', this._ocResize);
  },
  beforeUnmount() {
    if (this._ocResize) window.removeEventListener('resize', this._ocResize);
    var el = this.$refs.ocChart;
    if (el) { var c = echarts.getInstanceByDom(el); if (c) c.dispose(); }
  },
  watch: {
    state() { var self = this; this.$nextTick(function(){ self.renderOcChart(); }); }
  }
};
</script>
