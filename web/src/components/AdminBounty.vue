<template>
  <admin-bounty-top></admin-bounty-top>
  <admin-bounty-list></admin-bounty-list>
</template>

<script>
import AdminBountyTop from './AdminBountyTop.vue';
import AdminBountyList from './AdminBountyList.vue';
export default {
  name: 'AdminBounty',
  components: { AdminBountyTop, AdminBountyList }
};
</script>
