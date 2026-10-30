import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
const App = lazy(() => import('./webBridge').then(() => import('./i18n')).then(() => import('./App')).then(module => ({default: module.App})));
import brandLogo from '@brand/logo.png?url';
import ncLogo from '@brand/community/nc-logo.svg?url';
import './design/global.css';
const isCommunity = (location.pathname === '/' && !('cth' in window)) || location.pathname === '/community' || location.pathname.startsWith('/community/');

const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.type = isCommunity ? 'image/svg+xml' : 'image/png';
favicon.href = isCommunity ? ncLogo : brandLogo;
document.head.appendChild(favicon);

const splashMark = document.querySelector('#cth-splash .mk');
if (splashMark && !isCommunity) {
  const img = document.createElement('img');
  img.src = brandLogo;
  img.alt = 'Munder Difflin';
  img.style.cssText = 'height:56px;width:auto;display:block';
  splashMark.replaceWith(img);
}

const CommunityApp = lazy(() => import('./community/CommunityApp'));

if (!isCommunity) {
  const communityLink = document.createElement('a');
  communityLink.href = '/community';
  communityLink.textContent = 'Northwind Community ↗';
  communityLink.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;background:#111111;color:#ffffff;border:1px solid #444444;padding:11px 16px;border-radius:4px;text-decoration:none;font:12px system-ui;box-shadow:0 2px 8px #0002';
  document.body.appendChild(communityLink);
}
const root = document.getElementById('root');
if (!root) throw new Error('No root element');

createRoot(root).render(
  <StrictMode>
    {isCommunity ? <Suspense fallback={<div role="status" style={{padding:40}}>Opening the Northwind community…</div>}><CommunityApp /></Suspense> : <Suspense fallback={<div role="status" style={{padding:40}}>Opening the office…</div>}><App /></Suspense>} 
  </StrictMode>
);
