import { defineConfig } from 'vite';
export default defineConfig({base:'./',build:{target:'es2022',chunkSizeWarningLimit:1200},server:{port:5178,strictPort:true},preview:{port:4178,strictPort:true}});
