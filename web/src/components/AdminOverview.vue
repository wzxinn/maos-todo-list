<template>
  <div>
    <div class="grid c4" style="margin-bottom:12px">
      <div class="stat"><div class="cap">进行中任务</div><div class="num">{{ stats.active }}</div><div class="hint">待处理/处理中/评审</div></div>
      <div class="stat"><div class="cap">未来 7 天转测</div><div class="num">{{ state.examsUpcoming.length }}</div><div class="hint">迭代转测节点</div></div>
      <div class="stat"><div class="cap">未确认风险</div><div class="num" :style="stats.risk>0 ? 'color:#f56c6c' : 'color:#67c23a'">{{ stats.risk }}</div><div class="hint">高/危 {{ stats.riskH }} 条</div></div>
      <div class="stat"><div class="cap">并行版本</div><div class="num">{{ state.versions.length }}</div><div class="hint">多版本并行节奏</div></div>
    </div>

    <!-- 成员是否可支撑 + OnCall 排班管理 -->
    <admin-support style="margin-bottom:12px"></admin-support>

    <!-- 未来 7 天：成员人力管道负载热力图（ECharts） -->
    <div class="panel" style="margin-bottom:12px">
      <h3>成员负载热力图 · 未来 7 天（转测×3 / 截止×2）</h3>
      <div id="loadHeat" style="width:100%;height:280px"></div>
      <div class="hint">颜色越深当天的管道负载越高（转测 3 / 截止 2，合计封顶 9）；悬停看当天塞了什么事。</div>
    </div>

    <!-- 未来最近一个迭代：待处理事项清单 -->
    <div class="panel" style="margin-bottom:12px" v-if="nextIter">
      <div class="row spread" style="margin-bottom:4px">
        <h3 style="margin-bottom:0">未来最近一个迭代 · 待处理事项清单</h3>
        <div class="row">
          <span class="chip" style="border-color:#0284c7;color:#0284c7">{{ nextIter.versionName }} · {{ nextIter.unit.name }}</span>
          <span class="chip mono small">{{ nextIter.unit.planStart }} ~ {{ nextIter.unit.planEnd }}</span>
          <span class="chip mono small" :style="nextIter.unit.status.code==='overdue' ? 'color:#f56c6c;border-color:#f56c6c' : 'color:#909399'">{{ nextIter.unit.status.label }}</span>
        </div>
      </div>
      <div v-if="nextIter.todos.length">
        <table>
          <thead><tr><th>任务</th><th>负责人</th><th>状态</th><th>截止</th><th>版本线</th></tr></thead>
          <tbody>
            <tr v-for="t in nextIter.todos" :key="t.id">
              <td><span class="chip mono small" :style="'color:'+t.typeColor+';border-color:'+t.typeColor">{{ t.typeLabel }}</span> {{ t.title }}</td>
              <td>{{ t.assigneeName }}</td>
              <td><span class="chip mono small" :style="'color:'+t.statusColor+';border-color:'+t.statusColor">{{ t.statusLabel }}</span></td>
              <td class="mono small">{{ t.dueAt ? t.dueAt + '（' + t.dueLabel + '）' : '—' }}</td>
              <td>{{ seriesLabel(t.series) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="hint">这个迭代还没有挂任务。</div>
    </div>

    <!-- 人力汇总：剩余占用 + 月度完成分布 -->
    <div class="grid c2">
      <div class="panel">
        <h3>手头占用人力 · 剩余估算（人天）</h3>
        <div id="manDaysBar" style="width:100%;height:300px"></div>
        <div class="hint">每位成员当前所有未完成事项的估算人天：优先取「工作量」填写的值；没填则按类型默认（需求=5 / BUG=0.5 / 其余按优先级 6/4/2.5/1）；超过容量上限会红字标注。</div>
      </div>
      <div class="panel">
        <h3>月度完成人力 · 每人每月合计（人天）</h3>
        <div id="monthDoneBar" style="width:100%;height:300px"></div>
        <div class="hint">按完成时间归到月份；每根柱子 = 当月的总估算人天。</div>
      </div>
    </div>
  </div>
</template>

<script>
import AdminSupport from './AdminSupport.vue';
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'AdminOverview',
  inject: ['root'],
  components: { AdminSupport },
  computed: rc(ROOT_DATA.concat(ROOT_COMPUTED)),
  methods: rm(ROOT_METHODS)
};
</script>
