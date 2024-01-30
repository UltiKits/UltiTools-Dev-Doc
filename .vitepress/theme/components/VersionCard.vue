<script setup>
import {useData} from "vitepress";

const {lang} = useData()
let language = lang.value.split('-')[0];
</script>

<template>
  <div class="ver">
    <span>API {{ language == 'zh' ? '版本' : 'version' }}: 608</span>
  </div>
</template>

<style>
.ver {
  align-items: center;
  display: flex;
  height: 36px;
  width: 100%;
  margin-top: 16px;
  background-color: var(--vp-c-bg-soft);
  border-radius: 8px;
  padding-left: 12px;
}

.ver > span {
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  user-select: none;
}
</style>