<template>
  <span class="avatar" :class="lg ? 'av-lg' : ''">
    <img v-if="who && who.avatar" :src="who.avatar" alt="" />
    <template v-else>{{ who && who.name ? who.name[0] : '?' }}</template>
  </span>
</template>

<script>
export default {
  name: 'AvatarBadge',
  props: {
    who: { type: Object, default: null },
    lg: { type: Boolean, default: false }
  }
};
</script>
