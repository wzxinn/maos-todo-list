<template>
  <div>
    <!-- 顶部选择：版本 → 迭代 -->
    <div class="panel" style="margin-bottom:12px">
      <div class="row" style="align-items:center;gap:10px;flex-wrap:wrap">
        <h3 style="margin:0">迭代看板</h3>
        <span class="muted small">版本：</span>
        <el-select v-model="pickVersion" style="width:170px" size="small" placeholder="选版本" @change="onVersionChange">
          <el-option v-for="v in state.versions" :key="v.id" :label="v.name + ' · ' + seriesLabel(v.series)" :value="v.id"></el-option>
        </el-select>
        <span class="muted small">迭代：</span>
        <el-select v-model="pickUnit" style="width:200px" size="small" placeholder="选迭代" @change="onUnitChange">
          <el-option v-for="u in versionUnits" :key="u.id" :label="u.name + '（' + u.planStart + ' ~ ' + u.planEnd + '）'" :value="u.id"></el-option>
        </el-select>
        <span class="hint">拖卡片到其它列 = 改任务状态；顶部统计该迭代人天/进度。</span>
      </div>
      <template v-if="curUnit && unitTodos.length">
        <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">
          <span class="chip mono small" style="border-color:#409eff;color:#1f6fd6">总 {{ totalDays }} 人天</span>
          <span class="chip mono small" style="border-color:#67c23a;color:#529a43">已完成 {{ doneDays }} 人天</span>
          <span class="chip mono small" style="border-color:#e6a23c;color:#b25e09">剩余 {{ leftDays }} 人天</span>
          <span class="chip mono small">{{ donePct }}%</span>
        </div>
      </template>
    </div>

    <!-- 泳道 -->
    <div class="panel" style="margin-bottom:12px" v-if="curUnit">
      <h3>泳道 · {{ curUnit.name }}</h3>
      <div class="lanes" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;align-items:start">
        <div v-for="lane in lanes" :key="lane.key" class="lane" style="background:#f6f8fb;border:1px solid var(--line);border-radius:10px;min-height:120px"
             @dragover.prevent="dragOverLane(lane.key)" @drop.prevent="dropOnLane(lane.key)">
          <div class="row spread" style="padding:8px 10px;align-items:center">
            <b style="font-size:12px;color:#17233d">{{ lane.title }}</b>
            <span class="chip mono small">{{ laneTodos(lane.key).length }}</span>
          </div>
          <div class="stack" style="padding:0 8px 8px;gap:6px">
            <div v-for="t in laneTodos(lane.key)" :key="t.id" class="lane-card" draggable="true"
                 @dragstart="dragStart(t)" @dragend="dragEnd"
                 style="background:#fff;border:1px solid var(--line2);border-left:3px solid #409eff;border-radius:8px;padding:7px 9px;cursor:grab">
              <div class="row" style="justify-content:space-between;gap:6px">
                <span class="small" style="font-weight:600;color:#17233d;flex:1">{{ t.title }}</span>
                <span class="chip mono small" :style="'color:'+t.typeColor+';border-color:'+t.typeColor" :title="t.typeLabel">{{ t.typeLabel }}</span>
              </div>
              <div class="row small muted" style="margin-top:5px;justify-content:space-between;gap:6px">
                <span>{{ t.assigneeName || '未指派' }}</span>
                <span v-if="t.dueAt" :class="t.dueDiff<0 ? 'red' : ''" style="white-space:nowrap">{{ t.dueDiff < 0 ? '超期' + (-t.dueDiff) + 'd' : (t.dueDiff===0 ? '今天截止' : '剩' + t.dueDiff + 'd') }}</span>
              </div>
              <div class="row small muted" style="margin-top:2px;justify-content:space-between;gap:6px">
                <span class="mono small">{{ t.estDays }} 人天</span>
                <span class="muted small">{{ t.priorityLabel }}</span>
              </div>
            </div>
            <div v-if="!laneTodos(lane.key).length" class="hint" style="text-align:center;padding:10px 0">拖卡片到这里</div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="panel hint" style="padding:26px">先在上方选一个版本和迭代，再看它的泳道与燃尽图。</div>

    <!-- 燃尽图 -->
    <div class="panel" v-if="curUnit">
      <div class="row spread" style="margin-bottom:6px">
        <h3 style="margin-bottom:0">燃尽图 · {{ curUnit.name }}（{{ curUnit.planStart }} ~ {{ curUnit.planEnd }}）</h3>
        <button class="act op" @click="renderBurn" title="重绘">重绘</button>
      </div>
      <div class="hint" style="margin-bottom:8px">蓝线=理想剩余（总量在窗口内线性归零）；橙线=按完成时点回算的实际剩余。若某天没有完成动作会走平，方便看出"积压"。</div>
      <div ref="burnBox" style="width:100%;height:320px"></div>
    </div>
  </div>
</template>

<script>
import * as echarts from 'echarts';
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'AdminBoard',
  inject: ['root'],
  data() {
    return { pickVersion: '', pickUnit: '', dragId: null };
  },
  computed: Object.assign(rc(ROOT_DATA.concat(ROOT_COMPUTED)), {
    versionUnits() {
      var s = this.state;
      if (!s) return [];
      var v = s.versions.find(function(x){ return x.id === this.pickVersion; }.bind(this));
      return (v && v.units) ? v.units.slice() : [];
    },
    curUnit() {
      if (!this.state) return null;
      return this.state.versions.reduce(function(acc, v){
        if (acc) return acc;
        var u = (v.units || []).find(function(x){ return x.id === this.pickUnit; }.bind(this));
        return u || null;
      }.bind(this), null);
    },
    unitTodos() {
      var s = this.state;
      if (!s || !this.pickUnit) return [];
      return s.todos.filter(function(t){
        return t.unitId === this.pickUnit && t.status !== 'canceled';
      }.bind(this));
    },
    totalDays() { var n = 0; this.unitTodos.forEach(function(t){ n += (t.estDays || 0); }); return Math.round(n * 10) / 10; },
    doneDays() { var n = 0; this.unitTodos.forEach(function(t){ if (t.status === 'done') n += (t.estDays || 0); }); return Math.round(n * 10) / 10; },
    leftDays() { var n = 0; this.unitTodos.forEach(function(t){ if (t.status !== 'done') n += (t.estDays || 0); }); return Math.round(n * 10) / 10; },
    donePct() { return this.totalDays ? Math.round(this.doneDays / this.totalDays * 100) : 0; },
    lanes() {
      return [
        { key: 'todo', title: '未开始', color: '#909399' },
        { key: 'doing', title: '处理中', color: '#409eff' },
        { key: 'review', title: '评审中', color: '#e6a23c' },
        { key: 'done', title: '已完成', color: '#67c23a' }
      ];
    }
  }),
  methods: Object.assign(rm(ROOT_METHODS), {
    laneTodos(key) {
      return this.unitTodos.filter(function(t){ return t.status === key; })
        .sort(function(a, b){ return (a.dueDiff == null ? 999 : a.dueDiff) - (b.dueDiff == null ? 999 : b.dueDiff); });
    },
    onVersionChange() { this.pickUnit = ''; },
    onUnitChange() { this.renderBurn(); },
    dragStart(t) { this.dragId = t.id; },
    dragEnd() { this.dragId = null; },
    dragOverLane() { /* allow drop */ },
    dropOnLane(target) {
      if (!this.dragId) return;
      var t = this.state.todos.find(function(x){ return x.id === this.dragId; }.bind(this));
      this.dragId = null;
      if (!t || t.status === target) return;
      var self = this;
      this.root.api('/api/todo/' + t.id + '/board', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: target }) })
        .then(function(r){
          if (r && r.ok) { self.root.toastMsg('已移到「' + self.laneLabel(target) + '」：' + t.title); self.root.reload(); }
          else self.root.toastMsg((r && r.error) ? r.error : '移动失败');
        });
    },
    laneLabel(key) {
      var l = this.lanes.find(function(x){ return x.key === key; });
      return l ? l.title : key;
    },
    renderBurn() {
      var el = this.$refs.burnBox;
      if (!el || !this.curUnit) return;
      var u = this.curUnit;
      var s = this.state;
      var DAY = 86400000;
      var par = function(ds){ return Date.parse(ds + 'T00:00:00Z'); };
      var todayS = s.today;
      var total = this.totalDays;
      if (!total || !u.planStart) { var c0 = echarts.getInstanceByDom(el); if (c0) c0.clear(); return; }

      /* 日期序列：planStart → planEnd */
      var start = new Date(par(u.planStart));
      var end = new Date(par(u.planEnd));
      var dates = [];
      for (var d = new Date(start.getTime()); d <= end; d = new Date(d.getTime() + DAY)) {
        dates.push(d.toISOString().slice(0, 10));
      }
      if (!dates.length) return;

      /* 理想线：总人天按剩余天数比例线性归零（含首尾，倒数天数=index） */
      var n = dates.length;
      var ideal = dates.map(function(ds, i){
        var remainDays = n - i;                 /* 当天还有多少个"日历日"（含当天到结束） */
        return Math.round(total * (remainDays / n) * 100) / 100;
      });

      /* 实际线：按完成任务时的 doneAt/updatedAt 落在哪天，把该天及以后的剩余减掉 */
      var doneByDay = {};
      this.unitTodos.forEach(function(t){
        if (t.status !== 'done') return;
        var at = t.doneAt || t.updatedAt || '';
        var day = String(at).slice(0, 10);
        if (!day || day < u.planStart) day = u.planStart;
        if (day > u.planEnd) day = u.planEnd;
        doneByDay[day] = (doneByDay[day] || 0) + (t.estDays || 0);
      });
      var acc = 0;
      var actual = dates.map(function(ds){
        acc += (doneByDay[ds] || 0);
        return Math.max(0, Math.round((total - acc) * 100) / 100);
      });

      var chart = echarts.getInstanceByDom(el) || echarts.init(el);
      chart.setOption({
        animationDuration: 150,
        color: ['#409eff', '#e6a23c'],
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'line' },
          backgroundColor: 'rgba(255,255,255,.98)', borderColor: '#cbd5e1',
          textStyle: { color: '#303133', fontSize: 12 },
          formatter: function(ps){
            if (!ps || !ps.length) return '';
            var ds = ps[0].axisValue;
            var L = ['<b>' + ds + '</b>'];
            ps.forEach(function(p){
              var nm = p.seriesName;
              var extra = '';
              if (nm === '实际剩余' && p.dataIndex === dates.length - 1) extra = '（' + s.todos.filter(function(t){ return t.unitId === u.id && t.status !== 'done' && t.status !== 'canceled'; }).length + ' 项未完）';
              L.push((p.marker || '') + nm + '：' + p.value + ' 人天' + extra);
            });
            return L.join('<br/>');
          }
        },
        legend: { bottom: 0, itemWidth: 14, itemHeight: 10, textStyle: { fontSize: 11 } },
        grid: { left: 60, right: 24, top: 20, bottom: 40, containLabel: true },
        xAxis: {
          type: 'category', boundaryGap: false,
          data: dates.map(function(ds){ return ds.slice(5); }),
          axisLabel: { color: '#909399', hideOverlap: true },
          axisLine: { lineStyle: { color: '#dcdfe6' } }
        },
        yAxis: { type: 'value', name: '人天', axisLabel: { color: '#909399' }, splitLine: { lineStyle: { color: '#f2f6fc' } } },
        series: [
          { name: '理想剩余', type: 'line', data: ideal, symbol: 'none', lineStyle: { width: 2, type: 'dashed' } },
          { name: '实际剩余', type: 'line', data: actual, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2 }, itemStyle: { color: '#e6a23c' } }
        ]
      });
    }
  }),
  mounted() { this.$nextTick(this.renderBurn); },
  watch: {
    state() { var self = this; this.$nextTick(function(){ self.renderBurn(); }); }
  }
};
</script>

<style scoped>
.lane-card.dragging { opacity: .5 }
.red { color: #f56c6c; font-weight: 700 }
</style>
