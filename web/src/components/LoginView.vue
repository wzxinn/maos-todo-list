<template>
  <div class="login-wrap">
    <div class="login-card">
      <h2>嗨，欢迎回来 👋</h2>
      <div class="sub">写下你的名字，开启今天的待办吧。<br/>这里只会有你自己的任务、日程和产出；想看团队节奏、安排转测或排查风险，进去后随时去「管理台」。</div>
      <div class="row" style="align-items:center">
        <el-input v-model="loginName" placeholder="输入你的名字" size="large" style="flex:1" @keyup.enter="doLogin" clearable></el-input>
        <button class="go" @click="doLogin">带我进去 →</button>
      </div>
      <div v-if="loginErr" class="login-err">{{ loginErr }}</div>
      <div class="hint" style="margin-top:12px">不确定名字？点一下同事的名字填入试试：<span v-for="e in state.employees" :key="e.id" class="chip" style="cursor:pointer;border-color:#dcdfe6" @click="loginName=e.name">{{ e.name }}</span></div>
    </div>
  </div>
</template>

<script>
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'LoginView',
  inject: ['root'],
  computed: rc(ROOT_DATA.concat(ROOT_COMPUTED)),
  methods: rm(ROOT_METHODS)
};
</script>
