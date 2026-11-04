// Runtime settings. In the container nginx answers /config.js itself, from its environment (see
// deploy/nginx.conf.template); this file only serves `npm run dev`. Empty values keep the
// build-time defaults in src/lib/config.ts.
window.WHENUE_CONFIG = { visitLinkBase: '' };
