/* 自动生成：App.vue 控制器逻辑按域拆分（computed/methods 归组） */
export default {
  computed: {
    riskGroups() {
            var s = this.state; if (!s) return [];
            var DEF = [
              { key: 'user', title: '成员自己上报', color: '#f56c6c', desc: '处理中的单子主动点的「报风险」', match: function(r){ return r.kind === 'user_report'; } },
              { key: 'delay', title: '任务延期 / 已超期', color: '#e6a23c', desc: '引擎扫描到超期或临近「超急/一般」截止的任务', match: function(r){ return r.kind === 'delay'; } },
              { key: 'overload', title: '人员过载', color: '#e6a23c', desc: '活动任务数/并行迭代/周转测超过容量', match: function(r){ return r.kind === 'overload'; } },
              { key: 'leave', title: '人员请假', color: '#7c3aed', desc: '请假日程撞上转测或「超急/一般」截止', match: function(r){ return r.kind === 'leave'; } }
            ];
            return DEF.map(function(g){
              return { key: g.key, title: g.title, color: g.color, desc: g.desc, items: s.risks.filter(g.match) };
            });
          },
  },
  methods: {
    ackRisk(r) { var self = this; this.api('/api/risk/' + r.id + '/ack', { method: 'POST' }).then(function(){ self.reload(); }); },
  }
};