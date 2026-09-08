/* 自动生成：App.vue 控制器逻辑按域拆分（computed/methods 归组） */
export default {
  computed: {
    bountyFilters() { return [
            { k: 'open', label: '悬赏中' }, { k: 'claimed', label: '已接取' }, { k: 'done', label: '已完结' }, { k: 'all', label: '全部' }
          ]; },
    bountyFilterLabel() {
            var f = this.bountyFilters.find(function(x){ return x.k === this.bountyFilter; }.bind(this));
            return f ? f.label : '';
          },
    bountyFiltered() {
            var self = this; if (!this.state) return [];
            var list = this.state.bounties || [];
            if (this.bountyFilter !== 'all') list = list.filter(function(b){ return b.status === self.bountyFilter; });
            var order = { open: 0, claimed: 1, done: 2 };
            return list.slice().sort(function(a,b){ return (order[a.status] - order[b.status]) || ((b.points||0) - (a.points||0)); });
          },
    bountyRank() {
            if (!this.state) return [];
            return this.state.employees.slice().sort(function(a,b){ return ((b.bountyPoints||0) - (a.bountyPoints||0)) || ((b.bountyDone||0)-(a.bountyDone||0)); });
          },
  },
  methods: {
    bountyPointsOf(diffKey) { var d = (this.state && this.state.dicts.bountyDiffs || []).find(function(x){ return x.key === diffKey; }); return d ? d.points : 0; },
    createBounty() {
            var f = this.bountyForm, self = this;
            if (!(f.title || '').trim()) { this.toastMsg('先写悬赏标题～'); return; }
            this.api('/api/bounty', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: f.title, desc: f.desc, type: f.type, diff: f.diff, by: self.me ? self.me.id : 'sys' }) })
              .then(function(r){
                if (r.ok) { self.toastMsg('悬赏已发布 🏆 贡献 ' + self.bountyPointsOf(f.diff)); self.bountyForm = { title: '', desc: '', type: 'other', diff: 'easy' }; self.reload(); }
                else self.toastMsg('发布失败：' + (r.error || ''));
              });
          },
    claimBounty(b) {
            var self = this;
            var who = this.me ? this.me.id : '';
            if (!who) { this.toastMsg('先登录你是谁，再接取悬赏～'); return; }
            this.api('/api/bounty/' + b.id + '/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigneeId: who }) })
              .then(function(r){
                if (r.ok) { self.toastMsg('你已接取「' + b.title + '」，进了你的未完成事项 🎯'); self.reload(); }
                else self.toastMsg('接取失败：' + (r.error || ''));
              });
          },
    returnBounty(b) {
            var self = this;
            this.api('/api/bounty/' + b.id + '/return', { method: 'POST' })
              .then(function(r){ if (r.ok) self.toastMsg('悬赏已退回，重新开放接取'); self.reload(); });
          },
    delBounty(b) {
            var self = this;
            ElementPlus.ElMessageBox.confirm('确认删除悬赏「' + b.title + '」吗？', '删除悬赏', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
              .then(function(){ self.api('/api/bounty/' + b.id + '/delete', { method: 'POST' }).then(function(){ self.reload(); }); })
              .catch(function(){});
          },
  }
};