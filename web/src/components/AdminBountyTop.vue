<template>
  <div class="grid c2" style="margin-bottom:12px">
    <!-- 发布 -->
    <div class="panel">
      <h3>发布公共悬赏</h3>
      <div class="stack" style="gap:8px">
        <label class="f">标题<el-input v-model="bountyForm.title" placeholder="例如：巡检报表偶发卡死根因定位" clearable></el-input></label>
        <label class="f">描述（怎么做 / 交付什么）<el-input v-model="bountyForm.desc" type="textarea" :rows="2" placeholder="选填，给接取人说明验收口径"></el-input></label>
        <div class="row" style="gap:8px;align-items:center">
          <label class="f" style="flex:1;min-width:130px">难度等级
            <el-select v-model="bountyForm.diff" style="width:100%">
              <el-option v-for="d in state.dicts.bountyDiffs" :key="d.key" :label="'★'.repeat(d.stars) + ' ' + d.label" :value="d.key"></el-option>
            </el-select>
          </label>
          <label class="f" style="width:120px">类型
            <el-select v-model="bountyForm.type" style="width:100%">
              <el-option v-for="tp in state.dicts.types" :key="tp.key" :label="tp.label" :value="tp.key"></el-option>
            </el-select>
          </label>
        </div>
        <div class="row spread">
          <span class="chip mono" style="border-color:#e6a23c;color:#e6a23c">本等级悬赏贡献：{{ bountyPointsOf(bountyForm.diff) }} 贡献</span>
          <button class="go" @click="createBounty">发布悬赏</button>
        </div>
      </div>
    </div>
    <!-- 成员贡献排行 -->
    <div class="panel">
      <div class="row spread" style="margin-bottom:6px">
        <h3 style="margin-bottom:0">成员悬赏贡献排行（绩效参考）</h3>
        <button class="act op" @click="exportMyBounties" title="把「我」完成过的悬赏明细复制到剪贴板">导出我完成的悬赏</button>
      </div>
      <div class="stack" v-if="bountyRank.length" style="max-height:240px;overflow:auto">
        <div v-for="(e,i) in bountyRank" :key="e.id" class="row spread small" style="padding:5px 0;border-bottom:1px dashed var(--line)">
          <div class="row" style="align-items:center">
            <span class="mono muted" style="width:22px">{{ i + 1 }}</span>
            <avatar-badge :who="e" :style="i===0 ? 'border-color:#f59e0b' : ''"></avatar-badge>
            <b>{{ e.name }}</b><span class="muted small">{{ e.role }}</span>
          </div>
          <div class="row" style="align-items:center">
            <span class="chip mono small" style="border-color:#e6a23c;color:#e6a23c">{{ e.bountyPoints || 0 }} 贡献</span>
            <span class="muted small">完成 {{ e.bountyDone || 0 }} 单</span>
          </div>
        </div>
      </div>
      <div v-else class="hint">还没有成员完成悬赏，去发布一条试试。</div>
    </div>
  </div>
</template>

<script>
import AvatarBadge from './AvatarBadge.vue';
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'AdminBountyTop',
  inject: ['root'],
  components: { AvatarBadge },
  computed: Object.assign(rc(ROOT_DATA.concat(ROOT_COMPUTED)), {
    /* 我完成过的悬赏 */
    myDoneBounties() {
      if (!this.me || !this.state) return [];
      return (this.state.bounties || []).filter(function(b){ return b.status === 'done' && b.assigneeId === this.me.id; }.bind(this))
        .sort(function(a, b){ return (a.doneAt < b.doneAt ? 1 : -1); });
    }
  }),
  methods: Object.assign(rm(ROOT_METHODS), {
    exportMyBounties() {
      var self = this;
      if (!this.me) { this.root.toastMsg('先登录你是谁，再导出你的悬赏～'); return; }
      var list = this.myDoneBounties;
      if (!list.length) { this.root.toastMsg('你还没有完成过悬赏'); return; }
      var NL = String.fromCharCode(10);
      var L = [];
      L.push('我的悬赏贡献 · ' + this.me.name + ' · ' + this.me.role);
      L.push('完成 ' + list.length + ' 单 · 贡献合计 ' + list.reduce(function(s, b){ return s + (b.points || 0); }, 0));
      L.push('');
      list.forEach(function(b){
        L.push('- ' + b.title);
        L.push('  类型 ' + self.typeLabelOf(b.type) + ' · 难度 ' + b.diffLabel + ' · 贡献 ' + (b.points || 0) + (b.doneAt ? ' · 完成于 ' + b.doneAt.slice(0, 10) : ''));
        if (b.desc) L.push('  说明 ' + b.desc);
      });
      this.copyText(L.join(NL));
      this.root.toastMsg('已复制我的悬赏贡献明细（' + list.length + ' 单）');
    }
  })
};
</script>
