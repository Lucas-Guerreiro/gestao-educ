// Service Worker passivo para EscolaSystem PWA
// Evita problemas de cache agressivo com hashes dinâmicos gerados pelo Vite

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpa absolutamente todos os caches antigos para evitar tela branca por scripts deletados
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Listener vazio: permite que o navegador faça as requisições direto da rede,
  // garantindo que os novos bundles JS do Vite sejam carregados sem conflito,
  // mas atendendo aos requisitos mínimos de PWA instalável do Chrome/iOS.
});
