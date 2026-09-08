<template>
  <!-- 左栏：今日待办（常驻展开） -->
  <div class="panel" style="border-color:#93c5fd">
    <div class="row spread" style="margin-bottom:8px">
      <h3 style="margin-bottom:0">今日待办 · 今天就专心干这些</h3>
      <span class="muted small">{{ todayTodos.length }} 项</span>
    </div>
    <div class="stack" v-if="todayTodos.length">
      <todo-card v-for="t in todayTodos" :key="t.id" :t="t" mode="today"></todo-card>
    </div>
    <div v-else class="hint">今天盘子空着——在上面输入待办回车就进来了；没来得及排今天的，都躺在右边「未完成事项」。</div>
  </div>
</template>

<script>
import TodoCard from './TodoCard.vue';
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'TodayPanel',
  inject: ['root'],
  components: { TodoCard },
  computed: rc(ROOT_DATA.concat(ROOT_COMPUTED)),
  methods: rm(ROOT_METHODS)
};
</script>
