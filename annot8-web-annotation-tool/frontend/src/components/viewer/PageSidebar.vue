<script setup>
import { Menu } from '@lucide/vue'
import { BBadge, BButton, BImg } from 'bootstrap-vue-next'

defineProps({
  pages: {
    type: Array,
    required: true,
  },
  selectedIndex: {
    type: Number,
    required: true,
    validator: (value) => Number.isFinite(value) && value >= 0,
  },
  collapsed: {
    type: Boolean,
    required: true,
  },
})

defineEmits(['select-page', 'toggle-sidebar'])
</script>

<template>
  <aside
    class="sidebar border-end bg-light-subtle"
    :class="{ 'sidebar--collapsed': collapsed }"
    aria-label="Page thumbnails"
  >
    <div class="sidebar-header">
      <BButton
        type="button"
        class="sidebar-toggle"
        size="sm"
        variant="outline-secondary"
        :aria-label="collapsed ? 'Show page thumbnails' : 'Hide page thumbnails'"
        :title="collapsed ? 'Show page thumbnails' : 'Hide page thumbnails'"
        @click="$emit('toggle-sidebar')"
      >
        <Menu
          class="sidebar-toggle-icon"
          :size="20"
          :stroke-width="2.4"
          aria-hidden="true"
          focusable="false"
        />
      </BButton>

      <div
        v-if="!collapsed"
        class="sidebar-title text-uppercase text-secondary fw-semibold small"
      >
        Pages
      </div>
    </div>

    <div v-if="!collapsed" class="sidebar-thumbnails">
      <BButton
        v-for="(page, index) in pages"
        :key="page"
        type="button"
        class="thumb p-1 mb-3 w-100"
        :active="selectedIndex === index"
        :variant="selectedIndex === index ? 'primary' : 'light'"
        :aria-current="selectedIndex === index ? 'page' : undefined"
        :aria-label="`Open page ${index + 1}`"
        @click="$emit('select-page', index)"
      >
        <BImg :src="page" fluid rounded class="border" />
        <BBadge variant="light" class="thumb-label mt-2">
          {{ index + 1 }}
        </BBadge>
      </BButton>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 0;
  padding: 1rem;
  transition:
    width 0.15s ease,
    padding 0.15s ease;
}

.sidebar--collapsed {
  width: 48px;
  padding: 0.75rem 0.5rem;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.sidebar--collapsed .sidebar-header {
  justify-content: center;
  margin-bottom: 0;
}

.sidebar-toggle {
  flex: 0 0 auto;
  width: 2rem;
  height: 2rem;
  padding: 0;
  line-height: 1;
}

.sidebar-toggle-icon {
  vertical-align: middle;
}

.sidebar-title {
  letter-spacing: 0.08em;
}

.thumb {
  display: block;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.thumb:hover {
  transform: translateY(-1px);
}

.thumb.active img {
  border-color: rgba(255, 255, 255, 0.85) !important;
}

.thumb-label {
  min-width: 2rem;
}
</style>
