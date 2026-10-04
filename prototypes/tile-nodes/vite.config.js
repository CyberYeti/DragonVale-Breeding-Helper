// PROTOTYPE (throwaway) for "Graph nodes reuse the Dragon tile component" (#17).
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
export default defineConfig({ plugins: [svelte()], server: { fs: { allow: [".."] } } });
