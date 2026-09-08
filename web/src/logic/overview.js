/* 自动生成：App.vue 控制器逻辑按域拆分（computed/methods 归组） */
export default {
  computed: {
    stats() {
            var s = this.state; if (!s) return { active: 0, risk: 0, riskH: 0 };
            var act = s.todos.filter(function(t){ return t.status !== 'done' && t.status !== 'canceled'; }).length;
            var h = s.risks.filter(function(r){ return r.level === 'high' || r.level === 'critical'; }).length;
            return { active: act, risk: s.risks.length, riskH: h };
          },
    weekDays() { return (this.state && this.state.employees.length) ? this.state.employees[0].load.busy.map(b => b.date) : []; },
    axis() {
            var v = this.cur; if (!v) return { min: '', max: '' };
            var dates = [v.freeze, v.release];
            v.units.forEach(function(u){ dates.push(u.planStart, u.planEnd); if (u.examView) dates.push(u.examView.examAt); });
            dates.sort();
            return { min: dates[0], max: dates[dates.length - 1] };
          },
    overlaps() {
            var vs = this.state ? this.state.versions : [];
            var out = [];
            for (var i = 0; i < vs.length; i++) for (var j = i + 1; j < vs.length; j++) {
              var a = vs[i], b = vs[j];
              var lo = a.freeze < b.freeze ? b.freeze : a.freeze;
              var hi = a.release < b.release ? a.release : b.release;
              var d = this.diffDays(lo, hi);
              if (d > 0) out.push({ a: a.name, b: b.name, days: d + 1, note: a.name + ' 与 ' + b.name + ' 并行窗口 ' + lo + ' ~ ' + hi + '，留意转测与发布冲突' });
            }
            return out;
          },
    nextIter() {
            var s = this.state; if (!s) return null;
            var t = s.today;
            var pool = [];
            s.versions.forEach(function(v){
              (v.units || []).forEach(function(u){
                pool.push({ versionName: v.name, unit: u });
              });
            });
            if (!pool.length) return null;
            pool.sort(function(a, b){ return (a.unit.planStart < b.unit.planStart ? -1 : 1); });
            var pick = pool.find(function(x){ return x.unit.planStart >= t; }) || pool[0];
            var todos = s.todos.filter(function(x){
              return x.unitId === pick.unit.id && x.status !== 'done' && x.status !== 'canceled';
            }).sort(function(a,b){ return (a.dueDiff==null?99:a.dueDiff)-(b.dueDiff==null?99:b.dueDiff); });
            return { versionName: pick.versionName, unit: pick.unit, todos: todos };
          },
    manStats() {
            var s = this.state; if (!s) return { remaining: [], monthly: [], months: [] };
            var rem = {}, mon = {}, months = [];
            s.todos.forEach(function(t){
              var owner = s.employees.find(function(x){ return x.id === t.assigneeId; });
              if (!owner) return;
              if (t.status !== 'done' && t.status !== 'canceled') {
                rem[t.assigneeId] = (rem[t.assigneeId] || 0) + (t.estDays || 0);
              } else if (t.status === 'done') {
                var m = String(t.updatedAt || '').slice(0, 7);
                if (!m) return;
                if (months.indexOf(m) < 0) months.push(m);
                mon[m] = mon[m] || {};
                mon[m][t.assigneeId] = (mon[m][t.assigneeId] || 0) + (t.estDays || 0);
              }
            });
            months.sort();
            var remaining = s.employees.map(function(e){
              return { id: e.id, name: e.name, role: e.role, days: Math.round((rem[e.id] || 0) * 10) / 10, cap: e.capacity.maxActiveTodos || 5 };
            }).filter(function(x){ return x.days > 0; }).sort(function(a,b){ return b.days - a.days; });
            var monthly = months.map(function(m){
              var row = { month: m };
              s.employees.forEach(function(e){ row[e.id] = Math.round((mon[m][e.id] || 0) * 10) / 10; });
              return row;
            });
            return { remaining: remaining, monthly: monthly, months: months };
          },
  },
  methods: {
    renderLoadHeat() {
            var el = document.getElementById('loadHeat');
            if (!el || typeof echarts === 'undefined' || !this.state || el.clientWidth === 0) return;      var s = this.state;
            var days = s.employees.length ? s.employees[0].load.busy.map(function(b){ return b.date; }) : [];
            var names = s.employees.map(function(e){ return e.name; });
            var data = [];
            s.employees.forEach(function(e, yi){
              e.load.busy.forEach(function(b, xi){
                data.push([xi, yi, b.load]);
              });
            });
            var chart = echarts.getInstanceByDom(el) || echarts.init(el);
            var tooltip = function(p){
              var e = s.employees[p.value[1]];
              var b = e.load.busy[p.value[0]];
              var head = '<b>' + e.name + '</b> · ' + b.date + '（' + (b.items.length ? '' : '空档') + '）';
              var lines = [head];
              b.items.forEach(function(i){ lines.push('<div>· [' + (i.kind === 'exam' ? '转测' : '截止') + '] ' + i.label + '</div>'); });
              if (!b.items.length) lines.push('<div style="color:#9aa7bd">负载 ' + b.load + '：没有硬性安排</div>');
              return lines.join('');
            };
            chart.setOption({
              tooltip: { position: 'top', backgroundColor: 'rgba(255,255,255,.98)', borderColor: '#cbd5e1', textStyle: { color: '#303133', fontSize: 12 }, formatter: tooltip },
              grid: { left: 70, right: 24, top: 10, bottom: 40 },
              xAxis: { type: 'category', data: days.map(function(d){ return d.slice(5); }), splitArea: { show: true }, axisLabel: { color: '#909399' } },
              yAxis: { type: 'category', data: names, splitArea: { show: true }, axisLabel: { color: '#334155' } },
              visualMap: { min: 0, max: 9, calculable: true, orient: 'horizontal', left: 'center', bottom: 2, textStyle: { fontSize: 11 }, inRange: { color: ['#eaf3fb', '#cfe4f5', '#9fc7ea', '#4d9fd8', '#f56c6c'] } },
              series: [{ name: '负载', type: 'heatmap', data: data, label: { show: true, color: '#fff', fontSize: 11 }, emphasis: { itemStyle: { shadowBlur: 8 } } }]
            });
          },
    renderManDaysBar() {
            var el = document.getElementById('manDaysBar');
            if (!el || typeof echarts === 'undefined' || !this.state || el.clientWidth === 0) return;
            var st = this.manStats;
            var chart = echarts.getInstanceByDom(el) || echarts.init(el);
            chart.setOption({
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(255,255,255,.98)', borderColor: '#cbd5e1', textStyle: { color: '#303133', fontSize: 12 } },
              grid: { left: 70, right: 30, top: 10, bottom: 10, containLabel: true },
              xAxis: { type: 'value', name: '人天', axisLabel: { color: '#909399' }, splitLine: { lineStyle: { color: '#f2f6fc' } } },
              yAxis: { type: 'category', data: st.remaining.map(function(x){ return x.name + '（' + x.role + '）'; }), inverse: true, axisLabel: { color: '#334155' } },
              series: [{
                type: 'bar', barWidth: '46%',
                data: st.remaining.map(function(x){ return { value: x.days, itemStyle: { color: x.days > (x.cap * 3) ? '#f56c6c' : '#409eff', borderRadius: [0, 6, 6, 0] } }; }),
                label: { show: true, position: 'right', formatter: function(p){ return p.value + ' 人天'; }, color: '#303133' }
              }]
            });
          },
    renderMonthDoneBar() {
            var el = document.getElementById('monthDoneBar');
            if (!el || typeof echarts === 'undefined' || !this.state || el.clientWidth === 0) return;
            var s = this.state;
            var self = this;
            var months = [];
            var map = {}; /* month -> {empId: days} */
            s.todos.forEach(function(t){
              if (t.status !== 'done') return;
              var m = String(t.updatedAt || '').slice(0, 7);
              if (!m) return;
              if (months.indexOf(m) < 0) months.push(m);
              map[m] = map[m] || {};
              map[m][t.assigneeId] = (map[m][t.assigneeId] || 0) + (t.estDays || 0);
            });
            months.sort();
            if (!months.length) months = [String(this.state.today).slice(0, 7)];
            var palette = ['#409eff', '#67c23a', '#e6a23c', '#7c3aed', '#db2777', '#0d9488'];
            var chart = echarts.getInstanceByDom(el) || echarts.init(el);
            chart.setOption({
              color: palette,
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(255,255,255,.98)', borderColor: '#cbd5e1', textStyle: { color: '#303133', fontSize: 12 } },
              legend: { bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 11 } },
              grid: { left: 10, right: 20, top: 10, bottom: 34, containLabel: true },
              xAxis: { type: 'category', data: months, axisLabel: { color: '#909399' } },
              yAxis: { type: 'value', name: '人天', axisLabel: { color: '#909399' }, splitLine: { lineStyle: { color: '#f2f6fc' } } },
              series: s.employees.map(function(e, i){
                return {
                  name: e.name, type: 'bar', stack: 'days', barWidth: '58%',
                  data: months.map(function(m){ return Math.round((map[m] && map[m][e.id] || 0) * 10) / 10; }),
                  itemStyle: { color: palette[i % palette.length] }
                };
              })
            });
          },
    renderAdminCharts() {
            this.renderLoadHeat();
            this.renderManDaysBar();
            this.renderMonthDoneBar();
          },
  }
};