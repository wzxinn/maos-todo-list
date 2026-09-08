<template>
  <!-- 版本系列联动筛选：点玫瑰图扇区或这里，仅看某条线的活（HC/HCS/HCSO/上线） -->
  <div class="row" style="margin:2px 0 10px;align-items:center;gap:6px;flex-wrap:wrap">
    <span class="muted small">我的待办 · 只看：</span>
    <button class="act" :class="meFilter==='' ? 'sort-on' : ''" @click="meFilter=''">全部</button>
    <button v-for="s in seriesOpts" :key="s.k" class="act" :class="meFilter===s.k ? 'sort-on' : ''" :style="meFilter===s.k ? 'border-color:'+s.color : ''" @click="meFilter = (meFilter===s.k ? '' : s.k)">
      {{ s.label }}（{{ seriesCount(s.k) }}）
    </button>
    <span class="hint" v-if="meFilter">已过滤：{{ seriesLabel(meFilter) }} 的活，点「全部」回来。</span>
  </div>
</template>

<script>
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'MeSeriesBar',
  inject: ['root'],
  computed: rc(ROOT_DATA.concat(ROOT_COMPUTED)),
  methods: rm(ROOT_METHODS)
};
</script>
