/* 自动生成：App.vue 控制器逻辑按域拆分（computed/methods 归组） */
export default {
  methods: {
    cellOf(e, d) { var f = e.load.busy.find(function(x){ return x.date === d; }); return f || { load: 0, items: [] }; },
    cellStyle(c) {
            if (!c.load) return 'border-color:transparent;background:transparent';
            var a = 0.16 + c.load * 0.12;
            var col = c.load >= 5 ? '220,38,38' : (c.load >= 3 ? '180,83,9' : '2,132,199');
            return 'background:rgba(' + col + ',' + a.toFixed(2) + ');border-color:rgba(' + col + ',.55);color:#fff;font-weight:700';
          },
    cellTitle(c) { if (!c.items.length) return ''; return c.items.map(function(i){ return '[' + i.kind + '] ' + i.label; }).join(' | '); },
    loadOf(e, d) { return this.cellOf(e, d).load; },
    dayLoadColor(e, d) { var l = this.loadOf(e, d); if (!l) return 'color:#909399'; return l >= 4 ? 'color:#f56c6c' : 'color:#0e7490'; },
    dayItems(e, d) { return this.cellOf(e, d).items; },
    rate(a, m) { return m ? Math.max(6, Math.round(a / m * 100)) : 6; },
    goLiveOf(v) { var m = v.milestones.find(function(x){ return x.key === 'go_live'; }); return m ? m.at : '—'; },
    def(u) { if (!this.defMap[u.id]) this.defMap[u.id] = { defect: 0, retake: '' }; return this.defMap[u.id]; },
    meSegStyle(v, u) {
            var axis = this.meAxis(v);
            var total = Math.max(1, this.diffDays(axis.min, axis.max));
            var left = Math.max(0, this.diffDays(axis.min, u.planStart)) / total * 100;
            var w = Math.max(1, this.diffDays(u.planStart, u.planEnd) + 1) / total * 100;
            var col = u.status.code === 'passed' ? 'rgba(14,159,110,.65)' : u.status.code === 'ongoing' ? 'rgba(2,132,199,.6)' : u.status.code === 'overdue' ? 'rgba(220,38,38,.55)' : 'rgba(148,163,184,.5)';
            return 'left:' + left + '%;width:' + w + '%;background:' + col;
          },
    verAxis(versions) {
            var dates = [];
            versions.forEach(function(v){
              dates.push(v.freeze, v.release);
              if (v.milestones) v.milestones.forEach(function(m){ dates.push(m.at); });
              v.units.forEach(function(u){ dates.push(u.planStart, u.planEnd); });
            });
            dates.sort();
            var todayS = this.state ? this.state.today : '';
            if (todayS) dates.push(todayS);
            dates.sort();
            return { min: dates[0], max: dates[dates.length - 1] };
          },
    segStyle(axis, p) {
            var st = p.start, en = p.end || p.start;
            var left = this.diffDays(axis.min, st), w = Math.max(1, this.diffDays(st, en) + 1);
            var color = p.kind === 'lesson' ? 'rgba(2,132,199,.5)' : p.kind === 'homework' ? 'rgba(67,56,202,.5)' : p.kind === 'review' ? 'rgba(37,99,235,.4)' : 'rgba(190,24,93,.6)';
            return 'left:' + (left * 16 + 2) + 'px;width:' + (w * 16 - 3) + 'px;background:' + color;
          },
    markLeft(axis, date) { return this.diffDays(axis.min, date) * 16 + 1; },
    prioStyle(p) { return 'color:' + (p === 'P0' ? '#f56c6c' : p === 'P1' ? '#e6a23c' : p === 'P2' ? '#e6a23c' : '#909399'); },
    guideOf(v) { var g = this.state.mainline.stageGuide[v.stage]; return g || []; },
  }
};