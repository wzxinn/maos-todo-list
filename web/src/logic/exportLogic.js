/* 自动生成：App.vue 控制器逻辑按域拆分（computed/methods 归组） */
export default {
  methods: {
    loadExport() { var self = this; this.api('/api/export').then(function(b){ self.exportText = JSON.stringify(b, null, 2); }); },
    loadPrompt() { var self = this; fetch('/api/prompt').then(function(r){ return r.text(); }).then(function(t){ self.promptText = t; }); },
    downloadExport() {
            if (!this.exportText) this.loadExport();
            var blob = new Blob([this.exportText], { type: 'application/json' });
            var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'maos-todo-export.json'; a.click();
          },
    copyText(txt) {
            if (!txt) return;
            var ok = false;
            if (navigator.clipboard && window.isSecureContext) {
              navigator.clipboard.writeText(txt).then(function(){ ok = true; }).catch(function(){ /* fallthrough */ });
            }
            /* 非 https / 剪贴板 API 不可用时的兜底 */
            setTimeout(function(){
              if (ok) return;
              var ta = document.createElement('textarea');
              ta.value = txt;
              ta.style.position = 'fixed'; ta.style.opacity = '0';
              document.body.appendChild(ta);
              ta.select();
              try { document.execCommand('copy'); } catch (e) { /* ignore */ }
              document.body.removeChild(ta);
            }, 60);
            this.toastMsg('已复制～');
          },
  }
};