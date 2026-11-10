// Vite is the free tool that runs and packages the game.
export default {
  base: './',
  server: { host: true, port: 5173, open: true },
  build: { chunkSizeWarningLimit: 1200 }
};
