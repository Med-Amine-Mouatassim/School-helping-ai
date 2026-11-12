// Sélectionne l’API selon l’hôte qui sert la page.
const localApiHosts = ['localhost', '127.0.0.1'];
const isLocalFrontend = localApiHosts.includes(window.location.hostname);

export const API_BASE_URL = window.__API_BASE_URL__ || (isLocalFrontend
  ? 'http://localhost:3000'
  : 'https://great-vocational-sprint-female.trycloudflare.com');

window.__API_BASE_URL__ = API_BASE_URL;
