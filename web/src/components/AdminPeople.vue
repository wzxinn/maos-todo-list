<template>
  <div>
    <div class="panel" style="margin-bottom:12px">
      <h3>添加团队成员</h3>
      <div class="row" style="align-items:flex-end;gap:8px">
        <label class="f" style="flex:1;max-width:240px">姓名<el-input v-model="addName" placeholder="真实姓名，如：张三" clearable @keyup.enter="addMember"></el-input></label>
        <label class="f" style="flex:1;max-width:200px">角色
          <el-select v-model="addRole" allow-create filterable placeholder="选或输入新角色">
            <el-option v-for="r in roleOpts" :key="r" :label="r" :value="r"></el-option>
          </el-select>
        </label>
        <button class="go" @click="addMember" :disabled="!addName.trim()">添 加</button>
      </div>
      <div class="hint" style="margin-top:6px">加进来的人马上就能登录个人工作台、被指派任务。想改谁的信息，直接在下面表格里点操作。</div>
    </div>

    <div class="panel">
      <h3>成员列表（{{ state.employees.length }} 人）</h3>
      <table>
        <thead><tr><th>成员</th><th>角色</th><th>在办任务</th><th>接取悬赏</th><th>悬赏贡献</th><th style="width:230px">操作</th></tr></thead>
        <tbody>
          <tr v-for="e in state.employees" :key="e.id">
            <td><avatar-badge :who="e"></avatar-badge> <b>{{ e.name }}</b><span class="muted small" v-if="me && e.id===me.id">（当前登录）</span></td>
            <td>{{ e.role }}</td>
            <td><span class="mono small" :style="busyOf(e).length ? 'color:#e6a23c;font-weight:600' : ''">{{ busyOf(e).length }}</span></td>
            <td><span class="mono small">{{ claimedOf(e) }}</span></td>
            <td><span class="mono small">{{ e.bountyPoints || 0 }} 贡献 · 完成 {{ e.bountyDone || 0 }} 单</span></td>
            <td>
              <div class="row" style="gap:4px">
                <button class="act" style="border-color:#0e7490;color:#0e7490" @click="renameMember(e)">改名</button>
                <button class="act" style="border-color:#7c3aed;color:#7c3aed" @click="changeRole(e)">改角色</button>
                <button class="act" style="border-color:#409eff;color:#409eff" @click="openAvatar(e)">换头像</button>
                <button class="act" style="border-color:#f56c6c;color:#f56c6c" @click="removeMember(e)" :disabled="me && e.id===me.id" :title="me && e.id===me.id ? '不能删除当前登录的自己' : ''">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 换头像弹窗 -->
    <el-dialog v-model="avatarOpen" :title="'换头像 · ' + (avatarEmp ? avatarEmp.name : '')" width="400px" append-to-body>
      <div class="tac" style="padding:4px 0 12px">
        <span class="avatar av-lg" style="width:72px;height:72px;font-size:26px">
          <img v-if="avatarPreview" :src="avatarPreview" alt="" />
          <template v-else>{{ avatarEmp && avatarEmp.name ? avatarEmp.name[0] : '?' }}</template>
        </span>
      </div>
      <div class="hint" style="margin-bottom:10px">选一张本人照片或形象图，会压缩到 128px 内保存，用于全站头像显示。</div>
      <div class="row" style="gap:8px">
        <label class="go" style="display:inline-flex;align-items:center;cursor:pointer;padding:5px 12px">选择图片
          <input type="file" accept="image/*" style="display:none" @change="onPickAvatar" />
        </label>
        <button class="act" style="border-color:#f56c6c;color:#f56c6c" @click="clearAvatar" :disabled="!avatarPreview">清除头像</button>
      </div>
      <template #footer>
        <button class="act" @click="avatarOpen=false">取消</button>
        <button class="go" @click="saveAvatar" :disabled="!avatarPreview">保存头像</button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ElMessageBox } from 'element-plus';
import AvatarBadge from './AvatarBadge.vue';
import { rc, rm, ROOT_DATA, ROOT_COMPUTED, ROOT_METHODS } from './rootRefs';
export default {
  name: 'AdminPeople',
  inject: ['root'],
  components: { AvatarBadge },
  data() {
    return { addName: '', addRole: '前端开发', avatarOpen: false, avatarEmp: null, avatarPreview: '' };
  },
  computed: Object.assign(rc(ROOT_DATA.concat(ROOT_COMPUTED)), {
    roleOpts() {
      const set = ['前端开发', '后端开发', '测试开发', '特性文档', '平台开发'];
      (this.state.employees || []).forEach(e => { if (e.role && set.indexOf(e.role) < 0) set.push(e.role); });
      return set;
    }
  }),
  methods: Object.assign(rm(ROOT_METHODS.concat(['api', 'toastMsg'])), {
    busyOf(e) {
      if (!this.state) return [];
      return this.state.todos.filter(t => t.assigneeId === e.id && t.status !== 'done' && t.status !== 'canceled');
    },
    claimedOf(e) {
      if (!this.state) return 0;
      return (this.state.bounties || []).filter(b => b.status === 'claimed' && b.assigneeId === e.id).length;
    },
    addMember() {
      const name = this.addName.trim();
      if (!name) return;
      const self = this;
      this.api('/api/employee', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, role: this.addRole || '成员', by: this.me ? this.me.id : 'sys' }) })
        .then(function (r) {
          if (r && r.ok) {
            self.toastMsg('已添加成员：' + name + ' ✅');
            self.addName = '';
            self.root.reload();
          } else {
            self.toastMsg('添加失败：' + (r && r.error ? r.error : '未知错误'));
          }
        });
    },
    renameMember(e) {
      const self = this;
      ElMessageBox.prompt('给「' + e.name + '」改个新名字', '改名', { confirmButtonText: '保存', cancelButtonText: '取消', inputValue: e.name, inputPlaceholder: '新名字' })
        .then(function (r) {
          const name = (r && r.value ? String(r.value) : '').trim();
          if (!name || name === e.name) return;
          self.api('/api/employee/' + e.id + '/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name, by: self.me ? self.me.id : 'sys' }) })
            .then(function (x) {
              if (x && x.ok) { self.toastMsg('已改名：' + e.name + ' → ' + x.name + '（别人卡片上的对接人名也同步了）'); self.root.reload(); }
              else self.toastMsg('改名失败：' + (x && x.error ? x.error : ''));
            });
        })
        .catch(function () { /* 取消 */ });
    },
    changeRole(e) {
      const self = this;
      ElMessageBox.prompt('修改「' + e.name + '」的角色', '改角色', { confirmButtonText: '保存', cancelButtonText: '取消', inputValue: e.role, inputPlaceholder: '角色，如：测试开发' })
        .then(function (r) {
          const role = (r && r.value ? String(r.value) : '').trim();
          if (!role || role === e.role) return;
          self.api('/api/employee/' + e.id + '/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: role, by: self.me ? self.me.id : 'sys' }) })
            .then(function (x) {
              if (x && x.ok) { self.toastMsg('角色已更新：' + e.name + ' → ' + x.role); self.root.reload(); }
              else self.toastMsg('更新失败：' + (x && x.error ? x.error : ''));
            });
        })
        .catch(function () { /* 取消 */ });
    },
    removeMember(e) {
      const self = this;
      ElMessageBox.confirm('确定把「' + e.name + '」从团队里删掉吗？\n会连带：在办任务解除指派、接取中悬赏退回、转测名单/需求版本负责人自动清除。', '删除成员', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
        .then(function () {
          self.api('/api/employee/' + e.id + '/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ by: self.me ? self.me.id : 'sys' }) })
            .then(function (x) {
              if (x && x.ok) { self.toastMsg('已删除成员：' + e.name); self.root.reload(); }
              else self.toastMsg('删除失败：' + (x && x.error ? x.error : ''));
            });
        })
        .catch(function () { /* 取消 */ });
    },
    /* ===== 换头像 ===== */
    openAvatar(e) {
      this.avatarEmp = e;
      this.avatarPreview = e.avatar || '';
      this.avatarOpen = true;
    },
    onPickAvatar(ev) {
      const self = this;
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      if (!/^image\//.test(file.type)) { self.toastMsg('请选择图片文件'); return; }
      if (file.size > 8 * 1024 * 1024) { self.toastMsg('图片太大，选 8MB 以内的吧'); return; }
      const fr = new FileReader();
      fr.onload = function () {
        const img = new Image();
        img.onload = function () {
          const max = 128;
          let w = img.width, h = img.height;
          if (w > max || h > max) {
            const r = Math.min(max / w, max / h);
            w = Math.round(w * r); h = Math.round(h * r);
          }
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          /* 方形图存 PNG；若文件本身是 jpeg 且无透明需要，转 jpeg 更小，但保底 PNG 通用 */
          self.avatarPreview = c.toDataURL('image/png');
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    },
    saveAvatar() {
      const self = this;
      if (!this.avatarEmp || !this.avatarPreview) return;
      this.api('/api/employee/' + this.avatarEmp.id + '/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl: this.avatarPreview, by: this.me ? this.me.id : 'sys' }) })
        .then(function (x) {
          if (x && x.ok) { self.toastMsg('头像已更新 ✅'); self.avatarOpen = false; self.root.reload(); }
          else self.toastMsg('头像保存失败：' + (x && x.error ? x.error : ''));
        });
    },
    clearAvatar() {
      const self = this;
      if (!this.avatarEmp) return;
      this.api('/api/employee/' + this.avatarEmp.id + '/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl: '', by: this.me ? this.me.id : 'sys' }) })
        .then(function (x) {
          if (x && x.ok) { self.toastMsg('已清除头像，恢复首字母'); self.avatarPreview = ''; self.avatarOpen = false; self.root.reload(); }
          else self.toastMsg('清除失败：' + (x && x.error ? x.error : ''));
        });
    }
  })
};
</script>
