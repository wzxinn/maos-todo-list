<template>
  <header>
    <div class="logo">maos'todo<span class="muted" style="font-size:12px;font-weight:400"> · 研发调度中枢</span></div>
    <div class="head-right">
      <template v-if="state && view!=='login' && me">
        <span class="head-user"><avatar-badge :who="me"></avatar-badge><b>你好，{{ me.name }}</b><span class="muted" v-if="me">· {{ me.role }}</span></span>
        <button class="gray" @click="logout">换个身份</button>
      </template>
      <span class="chip mono">今日 {{ state ? state.today : '' }}</span>
    </div>
  </header>
</template>

<script>
import AvatarBadge from './AvatarBadge.vue';
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'HeaderBar',
  inject: ['root'],
  components: { AvatarBadge },
  computed: rc(ROOT_DATA.concat(ROOT_COMPUTED)),
  methods: rm(ROOT_METHODS)
};
</script>
