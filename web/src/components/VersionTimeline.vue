<template>
  <div>
    <div ref="box" style="width:100%;height:330px"></div>
    <div v-if="noActive" class="hint" style="margin-top:8px">所有版本都标记完成啦——时间线只展示进行中版本；要恢复就在下方版本管理里点「恢复」。</div>
    <div class="hint" style="margin-top:4px">横条 = 各版本「冻结 ~ 发布」窗口，条上文字是版本名；圆点 = 迭代（悬停看窗口与转测）。红色竖带 = 并行重叠。</div>
  </div>
</template>

<script>
import * as echarts from 'echarts';
export default {
  name: 'VersionTimeline',
  inject: ['root'],
  data() {
    return { noActive: false };
  },
  computed: {
    state() { return this.root ? this.root.state : null; },
    activeVersions() {
      var s = this.state;
      if (!s || !s.versions) return [];
      return s.versions.filter(function(v){ return !v.completed; });
    }
  },
  mounted() {
    var self = this;
    this._redraw = function(){ self.draw(); };
    this.$nextTick(this.draw);
    window.addEventListener('resize', this._redraw);
    document.addEventListener('ver-timeline-refresh', this._redraw);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this._redraw);
    document.removeEventListener('ver-timeline-refresh', this._redraw);
    var el = this.$refs.box;
    if (el) { var c = echarts.getInstanceByDom(el); if (c) c.dispose(); }
  },
  watch: {
    state() { var self = this; this.$nextTick(function(){ self.draw(); }); }
  },
  methods: {
    draw() {
      var el = this.$refs.box;
      if (!el) return;
      var s = this.state;
      if (!s || !s.versions) return;
      var list = this.activeVersions;
      this.noActive = !list.length;
      if (el.clientWidth === 0) return;
      var DAY = 86400000;
      var par = function(d){ return Date.parse(d + 'T00:00:00Z'); };
      var serColor = { HC: '#0e7490', HCS: '#7c3aed', HCSO: '#db2777' };
      var todayMs = par(s.today);

      /* 版本横条（加粗线 = 冻结~发布）+ 版本名标注 + 迭代点 */
      var bandSeries = [];
      var nameData = [];
      var iterData = [];
      var liveData = [];
      var allMs = [todayMs];
      var devVersions = [];

      list.forEach(function(v){
        if (!serColor[v.series]) return;
        var lane = v.series;
        var from = par(v.freeze), to = par(v.release);
        var mid = Math.round((from + to) / 2);
        allMs.push(from, to);
        var col = serColor[lane];
        var isLive = v.kind === 'live';
        if (!isLive) devVersions.push(v);

        /* 版本横条：两点加粗横线 */
        bandSeries.push({
          type: 'line',
          data: [[from, lane], [to, lane]],
          symbol: 'none',
          lineStyle: { width: 22, color: col, opacity: isLive ? 0.2 : 0.5, cap: 'round' },
          silent: true,
          z: 2
        });
        /* 版本名：条中点上方直接标注版本名 + 发布 DDL（不依赖 hover） */
        var ddLabel = isLive ? '已上线' : ('发布 DDL ' + (v.release || '').slice(5));
        nameData.push({
          value: [mid, lane],
          label: {
            show: true,
            formatter: function(){ return '{n|' + v.name + '}\n{d|' + ddLabel + '}'; },
            position: 'top',
            distance: 2,
            rich: {
              n: { color: '#1f3a5f', fontSize: 12, fontWeight: 700, lineHeight: 15, padding: [0, 0, 1, 0] },
              d: { color: isLive ? '#67c23a' : '#e6a23c', fontSize: 10, lineHeight: 13, padding: [0, 0, 1, 0] }
            },
            backgroundColor: 'rgba(255,255,255,.85)',
            padding: [2, 6],
            borderRadius: 3
          }
        });
        (v.units || []).forEach(function(u){
          var uStart = par(u.planStart), uEnd = par(u.planEnd);
          allMs.push(uStart, uEnd);
          var examAt = u.examView && u.examView.examAt ? par(u.examView.examAt) : null;
          if (examAt) allMs.push(examAt);
          iterData.push({
            value: [uStart, lane],
            symbolSize: 8,
            itemStyle: { color: isLive ? '#cbd5e1' : (u.status && u.status.code === 'passed' ? '#67c23a' : col), borderColor: '#fff', borderWidth: 1 },
            u: {
              type: 'iter', v: v.name, ser: lane, unit: u.name,
              start: u.planStart, end: u.planEnd,
              examAt: examAt ? u.examView.examAt : null,
              examSub: examAt && u.examView.subject ? u.examView.subject : '',
              live: isLive
            }
          });
        });
      });

      /* 并行重叠（仅 dev 跨系列） */
      var overlapAreas = [];
      var names = [];
      for (var i = 0; i < devVersions.length; i++) {
        for (var j = i + 1; j < devVersions.length; j++) {
          var a = devVersions[i], b = devVersions[j];
          if (a.series === b.series) continue;
          var lo = Math.max(par(a.freeze), par(b.freeze));
          var hi = Math.min(par(a.release), par(b.release));
          if (lo < hi) {
            var hit = overlapAreas.find(function(x){ return lo < x.hi && x.lo < hi; });
            if (hit) { hit.lo = Math.min(hit.lo, lo); hit.hi = Math.max(hit.hi, hi); }
            else overlapAreas.push({ lo: lo, hi: hi });
            names.push(a.name + ' × ' + b.name);
          }
        }
      }

      var guideSeries = {
        type: 'line',
        data: [],
        silent: true,
        markLine: {
          symbol: 'none',
          lineStyle: { color: '#e6a23c', type: 'dashed', width: 1.5 },
          label: { show: true, position: 'end', formatter: '今天', color: '#e6a23c', fontSize: 11 },
          data: [{ xAxis: todayMs }]
        },
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(245,108,108,.14)' },
          data: overlapAreas.map(function(o){ return [{ xAxis: o.lo }, { xAxis: o.hi }]; })
        },
        z: 1
      };

      var minMs = Math.min.apply(null, allMs) - 2 * DAY;
      var maxMs = Math.max.apply(null, allMs) + 2 * DAY;
      var rows = ['HC', 'HCS', 'HCSO'].filter(function(ser){ return list.some(function(v){ return v.series === ser; }); });

      var chart = echarts.getInstanceByDom(el) || echarts.init(el);
      chart.setOption({
        animationDuration: 150,
        grid: { left: 50, right: 20, top: 40, bottom: 32 },
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: 'rgba(255,255,255,.98)',
          borderColor: '#cbd5e1',
          textStyle: { color: '#303133', fontSize: 12 },
          formatter: function(p){
            if (!p || !p.data || !p.data.u) return '';
            var u = p.data.u;
            var out = [];
            out.push('<b>' + u.v + '（' + u.ser + '）</b>');
            out.push(u.unit);
            out.push('计划窗口：' + u.start + ' ~ ' + u.end);
            if (u.examAt) out.push('转测：' + u.examAt + (u.examSub ? '（' + u.examSub + '）' : ''));
            else out.push('转测：未排期');
            return out.join('<br/>');
          }
        },
        xAxis: {
          type: 'value',
          min: minMs, max: maxMs,
          axisLabel: {
            color: '#909399', hideOverlap: true, interval: 'auto',
            formatter: function(v){ var d = new Date(v); var p = function(n){ return n < 10 ? '0' + n : '' + n; }; return p(d.getMonth() + 1) + '-' + p(d.getDate()); }
          },
          splitLine: { show: false },
          axisLine: { lineStyle: { color: '#dcdfe6' } }
        },
        yAxis: {
          type: 'category',
          data: rows,
          inverse: true,
          axisLabel: { color: function(v){ return serColor[v] || '#909399'; }, fontWeight: 700, fontSize: 12 },
          axisLine: { show: false }, axisTick: { show: false }
        },
        series: bandSeries.concat([
          {
            type: 'scatter',
            data: nameData,
            symbolSize: 0,
            silent: true,
            label: { show: true },
            z: 3
          },
          {
            type: 'scatter',
            data: iterData,
            z: 5
          },
          guideSeries
        ])
      });
      if (overlapAreas.length) {
        chart.setOption({
          title: [{
            text: '并行重叠：' + names.join('、'),
            left: 'center', top: 0,
            textStyle: { color: '#f56c6c', fontSize: 11, fontWeight: 400 }
          }]
        });
      } else {
        chart.setOption({ title: [{ text: '', left: 'center', top: 0 }] });
      }
    }
  }
};
</script>
