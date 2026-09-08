<template>
  <div>
    <div class="panel" style="margin-bottom:12px">
      <h3>BUG 单导入（JSON → 按责任人进待办）</h3>
      <div class="row spread" style="margin-top:8px">
        <span v-if="bugReport" class="small" :style="bugReport.error ? 'color:#f56c6c' : 'color:#67c23a'">
          共 {{ bugReport.total }} 条：新建 {{ bugReport.created }} · 更新 {{ bugReport.updated }} · 跳过 {{ bugReport.skipped }}
          <template v-if="bugReport.unmatchedNames && bugReport.unmatchedNames.length">｜没匹配到成员：{{ bugReport.unmatchedNames.join('、') }}</template>
          <template v-if="bugReport.error">｜{{ bugReport.error }}</template>
        </span>
        <button class="go" @click="importBugs" :disabled="!bugJson.trim()">解析并导入</button>
      </div>
    </div>
    <div class="grid c2">
      <div class="panel">
        <h3>新建任务 · 指派</h3>
        <div class="stack" style="gap:10px">
          <label class="f">标题<el-input v-model="newForm.title" placeholder="例如：修复 BUG#8821（输入时类型自动联动，可手动改）"></el-input></label>
          <div class="grid c3">
            <label class="f">类型
              <span class="row" style="gap:6px">
                <el-select v-model="newForm.type" style="flex:1" @change="onManualTypePick" placeholder="类型">
                  <el-option v-for="tp in state.dicts.types" :key="tp.key" :label="tp.label" :value="tp.key"></el-option>
                </el-select>
                <span class="muted small" style="white-space:nowrap">自动</span>
                <el-switch v-model="autoType" title="开：输入标题自动选类型；手动点类型后切手动，默认其他"></el-switch>
              </span>
            </label>
            <label class="f">优先级
              <el-select v-model="newForm.priority" placeholder="优先级">
                <el-option v-for="(pm, pk) in state.dicts.priorities" :key="pk" :label="pm.label" :value="pk"></el-option>
              </el-select>
            </label>
            <label class="f">负责人
              <el-select v-model="newForm.assigneeId" placeholder="负责人">
                <el-option v-for="e in state.employees" :key="e.id" :label="e.name + ' · ' + e.role" :value="e.id"></el-option>
              </el-select>
            </label>
            <label class="f">关联需求
              <el-select v-model="newForm.requirementId" placeholder="无" clearable>
                <el-option label="无" value=""></el-option>
                <el-option v-for="r in state.requirements" :key="r.id" :label="r.name" :value="r.id"></el-option>
              </el-select>
            </label>
            <label class="f">所属版本 / 迭代
              <el-select v-model="newForm.unitId" placeholder="无" clearable>
                <el-option label="无" value=""></el-option>
                <el-option v-for="u in allUnits" :key="u.id" :label="u.versionName + ' · ' + u.name" :value="u.id"></el-option>
              </el-select>
            </label>
            <label class="f">截止日期<el-date-picker v-model="newForm.dueAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%"></el-date-picker></label>
          </div>
          <div class="row spread"><span class="hint">任务会写进事件日志，供历史检索与导出分析。</span><button class="go" @click="createTodo">创建任务</button></div>
        </div>
      </div>
      <div class="panel">
        <h3>任务清单（可按负责人/状态/类型筛）</h3>
        <div class="row small" style="margin-bottom:8px;gap:10px">
          <label class="f" style="flex-direction:row;align-items:center;gap:4px">负责人
            <el-select v-model="filterAssignee" style="width:110px" placeholder="全部" clearable>
              <el-option label="全部" value=""></el-option>
              <el-option v-for="e in state.employees" :key="e.id" :label="e.name" :value="e.id"></el-option>
            </el-select>
          </label>
          <label class="f" style="flex-direction:row;align-items:center;gap:4px">状态
            <el-select v-model="filterStatus" style="width:110px" placeholder="全部" clearable>
              <el-option label="全部" value=""></el-option>
              <el-option v-for="(m,k) in state.dicts.statuses" :key="k" :label="m.label" :value="k"></el-option>
            </el-select>
          </label>
          <label class="f" style="flex-direction:row;align-items:center;gap:4px">类型
            <el-select v-model="filterType" style="width:110px" placeholder="全部" clearable>
              <el-option label="全部" value=""></el-option>
              <el-option v-for="tp in state.dicts.types" :key="tp.key" :label="tp.label" :value="tp.key"></el-option>
            </el-select>
          </label>
          <button class="act" @click="filterAssignee='';filterStatus='';filterType=''">重置筛选</button>
        </div>
        <div class="stack" v-if="filteredTodos.length" style="max-height:520px;overflow:auto;padding-right:4px">
          <div v-for="t in filteredTodos" :key="t.id" class="todo-item row spread" :class="todoCls(t)">
            <div class="stack" style="flex:1;gap:3px">
              <div class="row">
                <span class="chip mono small" :style="'color:'+t.typeColor+';border-color:'+t.typeColor">{{ t.typeLabel }}</span>
                <span class="chip mono small" :style="'color:'+t.priorityColor+';border-color:'+t.priorityColor">{{ t.priorityLabel }}</span>
                <b class="small t-title">{{ t.title }}</b>
                <a v-if="t.bugNo" :href="t.bugUrl || '#'" target="_blank" rel="noopener" class="chip mono small buglink" title="在 BUG 平台打开详情（新标签页）">BUG {{ t.bugNo }} · 查看详情 ↗</a>
              </div>
              <div class="row small t-meta">
                <span>负责人：<b style="color:#409eff">{{ t.assigneeName }}</b></span>
                <template v-if="t.unitName"><span>·</span><span>{{ t.unitName }}</span></template>
                <template v-if="t.sourceVersion"><span>·</span><span>版本 {{ t.sourceVersion }}</span></template>
                <template v-if="t.dueAt"><span>·</span><span class="mono" :style="t.dueDiff<0?'color:#f56c6c;font-weight:600':(t.dueDiff<=1?'color:#e6a23c':'')">截止 {{ t.dueAt }}（{{ t.dueLabel }}）</span></template>
              </div>
              <div v-if="t.description" class="t-desc">{{ t.description }}</div>
            </div>
            <div class="row">
              <span class="chip mono small" :style="'color:'+t.statusColor+';border-color:'+t.statusColor">{{ t.statusLabel }}</span>
              <button class="act op" @click="openEditTodo(t)" title="编辑标题/类型/优先级/截止/版本线/对接人/描述">编辑</button>
              <button v-for="nt in nextOf(t)" :key="nt.to" class="act op" @click="setStatus(t,nt.to)">{{ nt.label }}</button>
              <button class="act op" @click="delTodo(t)">删除</button>
            </div>
          </div>
        </div>
        <div v-else class="hint">没有符合条件的任务。</div>
      </div>
    </div>
  </div>
</template>

<script>
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'AdminTasks',
  inject: ['root'],
  computed: rc(ROOT_DATA.concat(ROOT_COMPUTED)),
  methods: rm(ROOT_METHODS)
};
</script>
