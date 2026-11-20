import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' + HashRouter = the built site works unchanged on
// https://<user>.github.io/<repo>/ today AND on a custom domain later.
export default defineConfig({
  plugins: [react()],
  base: './',
})
