<script setup>
import { computed } from 'vue';

// Simple floor plan of storage locations: one tile per product that has a rack code.
const props = defineProps({
  products: { type: Array, default: () => [] },
  selectedId: { type: [String, Number], default: '' },
});
const emit = defineEmits(['select']);

const tiles = computed(() => props.products
  .filter((product) => product.storage_location)
  .map((product) => ({
    id: product.id,
    code: product.storage_location,
    name: product.name,
    stock: Number(product.warehouse_stock),
    state: Number(product.warehouse_stock) === 0 ? 'empty'
      : Number(product.warehouse_stock) <= Number(product.reorder_point) ? 'low' : 'good',
  }))
  .sort((a, b) => a.code.localeCompare(b.code, 'id', { numeric: true })));
</script>

<template>
  <div class="rack-map">
    <button
      v-for="tile in tiles"
      :key="tile.id"
      type="button"
      class="rack-tile"
      :class="[tile.state, { selected: String(tile.id) === String(selectedId) }]"
      :title="`${tile.code} · ${tile.name} · ${tile.stock} unit`"
      :aria-label="`Rak ${tile.code}, ${tile.name}, ${tile.stock} unit`"
      @click="emit('select', tile.id)"
    >
      <span>{{ tile.code }}</span>
      <strong>{{ tile.stock }}</strong>
    </button>
    <p v-if="!tiles.length" class="rack-empty">Belum ada produk dengan lokasi rak.</p>
  </div>
</template>
