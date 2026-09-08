<template>
  <div>
    <div class="panel" style="margin-bottom:12px">
      <h3>数据导出 · 智能调度</h3>
      <div class="hint" style="margin-bottom:10px">导出的是扁平化的数据包（成员负载 / 需求进度 / 版本迭代转测 / 任务 / 事件 / 风险），可以直接交给大模型做调度分析；也可以一键生成调度指令文本。</div>
      <div class="row">
        <button class="go" @click="loadExport">生成导出数据</button>
        <button class="act" @click="loadPrompt">生成 AI 调度 Prompt</button>
        <button class="act" @click="downloadExport">下载 JSON</button>
        <button class="act" @click="copyText(exportText)">复制导出</button>
        <button class="act" @click="copyText(promptText)">复制 Prompt</button>
      </div>
    </div>
    <div class="grid c2">
      <div class="panel"><h3>导出数据（JSON）</h3><el-input v-model="exportText" type="textarea" :rows="14" readonly placeholder="点「生成导出数据」…"></el-input></div>
      <div class="panel"><h3>AI 调度 Prompt</h3><el-input v-model="promptText" type="textarea" :rows="14" readonly placeholder="点「生成 AI 调度 Prompt」，复制后粘贴给任意大模型…"></el-input></div>
    </div>
  </div>
</template>

<script>
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'AdminExport',
  inject: ['root'],
  computed: rc(ROOT_DATA.concat(ROOT_COMPUTED)),
  methods: rm(ROOT_METHODS)
};
</script>
