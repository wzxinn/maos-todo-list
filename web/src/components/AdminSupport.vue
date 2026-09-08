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

    <!-- ===== OnCall 排班表 ===== -->
    <div class="panel">
      <h3>OnCall 排班表</h3>
      <div class="hint" style="margin-bottom:8px">给成员设置 OnCall 值守的时间范围（含首尾日）。排班中的人在看板里显示 OnCall —— 高负载、低优先支撑，不优先派活。</div>
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
      <div v-else class="hint" style="margin-bottom:8px">还没有 OnCall 排班，在下面加一条。</div>
      <div class="row small" style="align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap">
        <span class="muted small" style="font-weight:700;color:#14355f">新增排班：</span>
        <el-select v-model="ocForm.empId" placeholder="选成员" style="width:140px" size="small">
          <el-option v-for="e in state.employees" :key="e.id" :label="e.name + ' · ' + e.role" :value="e.id"></el-option>
        </el-select>
        <el-date-picker v-model="ocForm.from" type="date" value-format="YYYY-MM-DD" placeholder="开始日" style="width:120px" size="small"></el-date-picker>
        <el-date-picker v-model="ocForm.to" type="date" value-format="YYYY-MM-DD" placeholder="结束日" style="width:120px" size="small"></el-date-picker>
        <button class="go" style="padding:3px 10px" @click="addOncall" :disabled="!ocForm.empId || !ocForm.from || !ocForm.to">添加</button>
      </div>
    </div>
  </div>
</template>

<script>
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
    }
  })
};
</script>
