<template>
  <!-- 右栏折叠组：未完成 / 已完成 / 版本节奏 -->
  <el-collapse v-model="openNames" class="panel open-collapse" @change="onMeCollapse">
    <el-collapse-item name="open">
      <template #title>
        <div style="width:100%;font-size:13px;font-weight:700;color:#14355f">未完成事项 <span class="muted small" style="font-weight:400">{{ openTodos.length }} 项</span></div>
      </template>
      <div class="row" style="margin-bottom:8px;gap:6px">
        <span class="muted small" style="margin-right:4px">排序：</span>
        <button class="act" :class="sortMode==='smart' ? 'sort-on' : ''" @click="sortMode='smart'">重要×紧急</button>
        <button class="act" :class="sortMode==='due' ? 'sort-on' : ''" @click="sortMode='due'">按截止</button>
        <button class="act" :class="sortMode==='prio' ? 'sort-on' : ''" @click="sortMode='prio'">按优先级</button>
      </div>
      <div class="stack" v-if="openTodos.length" style="max-height:52vh;overflow:auto;padding-right:4px">
        <todo-card v-for="t in openTodos" :key="t.id" :t="t" mode="open"></todo-card>
      </div>
      <div v-else class="hint">未完成的都清空啦，可以歇会儿。想干哪件先点它的「开始处理」。</div>
    </el-collapse-item>
    <el-collapse-item name="done">
      <template #title>
        <div style="width:100%;font-size:13px;font-weight:700;color:#14355f">已完成事项 <span class="muted small" style="font-weight:400">（{{ doneTodos.length }}）</span></div>
      </template>
      <div class="stack" v-if="doneTodos.length" style="max-height:34vh;overflow:auto;padding-right:4px">
        <todo-card v-for="t in doneTodos" :key="t.id" :t="t" mode="done"></todo-card>
      </div>
      <div v-else class="hint">还没有完成过的事项。</div>
    </el-collapse-item>
    <el-collapse-item name="ver">
      <template #title>
        <div style="width:100%;font-size:13px;font-weight:700;color:#14355f">版本节奏 · 多版本并行时间线</div>
      </template>
      <version-timeline></version-timeline>
    </el-collapse-item>
  </el-collapse>
</template>

<script>
import TodoCard from './TodoCard.vue';
import VersionTimeline from './VersionTimeline.vue';
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'MeSidePanel',
  inject: ['root'],
  components: { TodoCard, VersionTimeline },
  computed: rc(ROOT_DATA.concat(ROOT_COMPUTED)),
  methods: rm(ROOT_METHODS)
};
</script>
