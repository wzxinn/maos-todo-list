<template>
  <me-userbar></me-userbar>
  <div class="stack">
    <me-quick-add></me-quick-add>
    <me-series-bar></me-series-bar>
    <!-- 双栏：左栏=今日待办(常驻)；右栏=未完成/已完成/版本节奏(折叠组) -->
    <div class="me-grid">
      <div class="me-main stack">
        <today-panel></today-panel>
      </div>
      <div class="me-side stack">
        <me-side-panel></me-side-panel>
      </div>
    </div>
  </div>
</template>

<script>
import MeUserbar from './MeUserbar.vue';
import MeQuickAdd from './MeQuickAdd.vue';
import MeSeriesBar from './MeSeriesBar.vue';
import TodayPanel from './TodayPanel.vue';
import MeSidePanel from './MeSidePanel.vue';
export default {
  name: 'MeView',
  inject: ['root'],
  components: { MeUserbar, MeQuickAdd, MeSeriesBar, TodayPanel, MeSidePanel }
};
</script>
