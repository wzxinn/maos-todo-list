<template>
  <!-- 榜单列表 -->
  <div class="panel">
    <div class="row spread" style="margin-bottom:8px">
      <h3 style="margin-bottom:0">公共悬赏榜 · {{ bountyFilterLabel }}（{{ bountyFiltered.length }}）</h3>
      <div class="row" style="gap:4px">
        <button v-for="f in bountyFilters" :key="f.k" class="act" :class="bountyFilter===f.k ? 'sort-on' : ''" @click="bountyFilter=f.k">{{ f.label }}</button>
      </div>
    </div>
    <div v-if="bountyFiltered.length" class="stack">
      <div v-for="b in bountyFiltered" :key="b.id" class="bounty-card">
        <div class="row spread">
          <div class="row" style="align-items:flex-start;flex:1">
            <div class="bounty-diff" :style="'color:'+b.diffColor+';border:1px solid '+b.diffColor">{{ '★'.repeat(b.stars) }}</div>
            <div class="stack" style="flex:1;gap:2px">
              <div class="row">
                <b>{{ b.title }}</b>
                <span class="chip mono small" :style="'color:'+b.diffColor+';border-color:'+b.diffColor">{{ b.diffLabel }}</span>
                <span class="chip mono small" style="border-color:#e6a23c;color:#e6a23c">{{ b.points }} 贡献</span>
                <span class="chip mono small" :style="'color:'+b.statusColor+';border-color:'+b.statusColor">{{ b.statusLabel }}</span>
              </div>
              <div v-if="b.desc" class="small" style="color:#909399">{{ b.desc }}</div>
              <div class="small muted">类型 {{ typeLabelOf(b.type) }} · 发布 {{ b.createdByName }} {{ (b.createdAt||'').slice(0,10) }}</div>
              <div v-if="b.status==='claimed'" class="small"><span style="color:#0284c7">接取人：{{ b.assigneeName }}</span></div>
              <div v-if="b.status==='done'" class="small"><span style="color:#67c23a">由 {{ b.assigneeName }} 完成{{ (b.doneAt||'').slice(0,10) }}，已发放 {{ b.points }} 贡献</span></div>
            </div>
          </div>
          <div class="stack" style="align-items:flex-end;gap:4px">
            <template v-if="b.status==='open'">
              <span class="muted small">当前登录：{{ meName }}</span>
              <button class="act" style="border-color:#409eff;color:#409eff" @click="claimBounty(b)">我接取</button>
            </template>
            <template v-else-if="b.status==='claimed'">
              <span class="muted small" v-if="b.assigneeId===me.id">我接的</span>
              <button class="act" style="border-color:#e6a23c;color:#e6a23c" @click="returnBounty(b)">退回悬赏</button>
            </template>
            <button v-if="b.status==='open' && b.createdBy===me.id" class="act" style="border-color:#f56c6c;color:#f56c6c" @click="delBounty(b)">删除</button>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="hint">该筛选下暂无悬赏。</div>
  </div>
</template>

<script>
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'AdminBountyList',
  inject: ['root'],
  computed: rc(ROOT_DATA.concat(ROOT_COMPUTED)),
  methods: rm(ROOT_METHODS)
};
</script>
