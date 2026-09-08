<template>
  <div>
    <div class="row" style="margin-bottom:10px">
      <span class="muted small">分类汇总：成员上报 / 任务延期超期 / 人员过载 / 人员请假</span>
      <button class="act" @click="reload">重新扫一遍</button>
    </div>
    <div v-if="!riskGroups.length" class="panel tac" style="padding:36px"><span class="chip" style="border-color:#67c23a;color:#67c23a">✓ 当前没有未确认风险</span></div>
    <div class="stack" style="gap:14px">
      <div v-for="g in riskGroups" :key="g.key" class="panel">
        <div class="row spread" style="margin-bottom:8px">
          <div class="row" style="align-items:center">
            <span class="dot" :style="'background:'+g.color"></span>
            <h3 style="margin-bottom:0">{{ g.title }}</h3>
            <span class="chip mono small">{{ g.items.length }} 条</span>
          </div>
          <span class="hint">{{ g.desc }}</span>
        </div>
        <div class="grid c2" v-if="g.items.length">
          <div v-for="r in g.items" :key="r.id" class="risk" :style="'border-color:'+riskColor(r.level)">
            <div class="row spread" style="margin-bottom:6px">
              <div class="row">
                <span class="rk" :style="'color:'+riskColor(r.level)+';border:1px solid '+riskColor(r.level)">{{ r.level.toUpperCase() }}</span>
                <b>{{ r.title }}</b>
                <span class="muted small">{{ riskKindLabel(r.kind) }}</span>
              </div>
              <button class="act" @click="ackRisk(r)">已处理</button>
            </div>
            <div class="small" style="line-height:1.7">{{ r.message }}</div>
            <div class="hint" style="margin-top:6px">建议：{{ r.suggestion }}</div>
          </div>
        </div>
        <div v-else class="hint">暂无</div>
      </div>
    </div>
  </div>
</template>

<script>
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'AdminRisk',
  inject: ['root'],
  computed: rc(ROOT_DATA.concat(ROOT_COMPUTED)),
  methods: rm(ROOT_METHODS)
};
</script>
