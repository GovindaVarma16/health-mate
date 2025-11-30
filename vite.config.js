import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
 server: {
  proxy: {
    "/api": {
      target: "https://healthmatebackend-875662263.development.catalystserverless.com",
      changeOrigin: true,
      secure: false,
      rewrite: (path) => "/healthmate"   // <-- IMPORTANT
    }
  }
}
})
