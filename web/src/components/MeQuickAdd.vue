<template>
  <!-- 快速新增（常驻最上方）：输入内容回车即加，默认进入「今日待办」 -->
  <div class="panel qadd">
    <div class="row" style="align-items:center;gap:8px">
      <el-input v-model="quickTitle" placeholder="记一条待办，回车直接加入「今日待办」…" style="flex:1;min-width:240px" @keyup.enter="quickAdd" clearable></el-input>
      <el-checkbox v-model="quickToday" style="white-space:nowrap">排今天</el-checkbox>
      <button class="go" @click="quickAdd">新增</button>
    </div>
    <div class="row small" style="margin-top:8px;align-items:center;gap:6px">
      <span class="muted small">类型：</span>
      <el-select v-model="quickType" style="width:118px" @change="onQuickTypeManual" placeholder="类型">
        <el-option v-for="tp in state.dicts.types" :key="tp.key" :label="tp.label" :value="tp.key"></el-option>
      </el-select>
      <span class="muted small">自动类型</span>
      <el-switch v-model="autoType" title="开：输入标题变化时按内容自动选类型（仍可手动选，手动选后将切为手动）；关：默认选「其他」"></el-switch>
      <span class="muted small">截止：</span>
      <el-date-picker v-model="quickDue" type="date" value-format="YYYY-MM-DD" placeholder="选填" style="width:140px"></el-date-picker>
      <span class="muted small">特性 Owner：</span>
      <el-input v-model="quickDev" placeholder="选填" style="width:110px" clearable></el-input>
      <span class="muted small">测试责任人：</span>
      <el-input v-model="quickTest" placeholder="选填" style="width:110px" clearable></el-input>
      <span class="muted small">版本线：</span>
      <el-select v-model="quickSeries" style="width:110px" placeholder="自动" clearable @change="onQuickSeriesManual">
        <el-option v-for="s in seriesOpts" :key="s.k" :label="s.label" :value="s.k"></el-option>
        <el-option label="自动（按所属版本）" value=""></el-option>
      </el-select>
    </div>
    <div class="hint" style="margin-top:6px">勾选「排今天」= 直接进今日待办（默认）；不勾 = 先躺在「未完成事项」。Owner/版本线可留空，卡片上点「编辑」随时补。</div>
  </div>
</template>

<script>
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'MeQuickAdd',
  inject: ['root'],
  computed: rc(ROOT_DATA.concat(ROOT_COMPUTED)),
  methods: rm(ROOT_METHODS)
};
</script>
