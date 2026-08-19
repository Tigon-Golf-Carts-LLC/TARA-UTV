import { useEffect, useRef, useState } from 'react';
import { injectStructuredData } from './structuredData';
import { mountInquiryForm } from './inquiryForm';

const BASE = import.meta.env.BASE_URL; // e.g. "/"

type RouteMeta = {
  file: string;
  title: string;
  description?: string;
  ogImage?: string;
  bodyClass: string;
  redirect?: never;
};

type RouteRedirect = { redirect: string };
type Routes = Record<string, RouteEntry>;

function normalizePath(p: string): string {
  let path = p;
  if (BASE !== '/' && path.startsWith(BASE.replace(/\/$/, ''))) {
    path = path.slice(BASE.replace(/\/$/, '').length) || '/';
  }
  if (!path.startsWith('/')) path = '/' + path;
  if (path !== '/' && !path.endsWith('/')) path += '/';
  return path;
}

function lookupRoute(routes: Routes, path: string): RouteEntry | null {
  if (routes[path]) return routes[path];
  // tolerate percent-encoding case differences
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    decoded = path;
  }
  for (const key of Object.keys(routes)) {
    try {
      if (decodeURIComponent(key) === decoded) return routes[key];
    } catch {
      /* skip malformed keys */
    }
  }
  return null;
}

/** Pages that should show the self-hosted inquiry form. */
const FORM_PAGES = new Set(['/contact/']);

/** Wire the product color list to the vehicle image slides (one image per color). */
function initProductColorPicker(root: HTMLElement) {
  const slides = root.querySelectorAll<HTMLElement>('.pro_img .swiper-slide');
  const colors = root.querySelectorAll<HTMLElement>('.pro_color li');
  if (slides.length === 0) return;

  const select = (idx: number) => {
    slides.forEach((s, i) => s.classList.toggle('color-active', i === idx));
    colors.forEach((c, i) => c.classList.toggle('color-active', i === idx));
  };
  select(0);
  colors.forEach((li, i) => li.addEventListener('click', () => select(i)));
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>(
    'loading',
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const path = normalizePath(window.location.pathname);
      try {
        const routesRes = await fetch(`${BASE}content/routes.json`);
        const routes: Routes = await routesRes.json();
        const entry = lookupRoute(routes, path);
        if (!entry) {
          // No 404 page — send unknown URLs to the home page.
          if (!cancelled && path !== '/') window.location.replace(BASE);
          if (!cancelled) setStatus('notfound');
          return;
        }
        // Handle client-side redirect for duplicate/alias routes.
        if ('redirect' in entry) {
          const target = BASE.replace(/\/$/, '') + entry.redirect;
          window.location.replace(target);
          return;
        }
        const meta: RouteMeta = entry;
        const res = await fetch(
          `${BASE}content/${encodeURIComponent(meta.file)}`,
        );
        if (!res.ok) {
          if (!cancelled) setStatus('notfound');
          return;
        }
        const html = await res.text();
        if (cancelled || !containerRef.current) return;

        document.title = meta.title;
        injectStructuredData(path, meta.title);

        // Update per-route meta: canonical, description, OG, Twitter Card.
        const siteOrigin = 'https://tarautv.com';
        const canonicalUrl = `${siteOrigin}${path}`;

        // Canonical link tag
        let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonical) {
          canonical = document.createElement('link');
          canonical.setAttribute('rel', 'canonical');
          document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', canonicalUrl);

        const setMeta = (selector: string, attribute: 'name' | 'property', value: string) => {
          let tag = document.querySelector<HTMLMetaElement>(selector);
          if (!tag) {
            tag = document.createElement('meta');
            tag.setAttribute(attribute, selector.match(/["']([^"']+)["']/)?.[1] ?? '');
            document.head.appendChild(tag);
          }
          tag.setAttribute('content', value);
        };
        const description = meta.description ?? '';
        const socialImage = `${siteOrigin}${meta.ogImage ?? '/images/og-image.png'}`;

        // Standard meta description and image.
        setMeta('meta[name="description"]', 'name', description);
        setMeta('meta[name="image"]', 'name', socialImage);

        // Open Graph: page-specific title, description, image, and URL.
        setMeta('meta[property="og:title"]', 'property', meta.title);
        setMeta('meta[property="og:description"]', 'property', description);
        setMeta('meta[property="og:image"]', 'property', socialImage);
        setMeta('meta[property="og:url"]', 'property', canonicalUrl);

        // Twitter preview mirrors the Open Graph metadata.
        setMeta('meta[name="twitter:title"]', 'name', meta.title);
        setMeta('meta[name="twitter:description"]', 'name', description);
        setMeta('meta[name="twitter:image"]', 'name', socialImage);

        if (meta.bodyClass) document.body.className = meta.bodyClass;
        containerRef.current.innerHTML = html;
        setStatus('ready');

        // Load the site's original behavior script (menus, sliders, tabs).
        const siteScript = document.createElement('script');
        siteScript.src = `${BASE}js/jquery.min_index.js`;
        siteScript.async = false;
        // The site script attaches its menu/slider handlers on
        // DOMContentLoaded / load, which already fired before we injected
        // the page content — so re-dispatch them once the script is ready.
        siteScript.onload = () => {
          document.dispatchEvent(new Event('DOMContentLoaded'));
          window.dispatchEvent(new Event('load'));
        };
        document.body.appendChild(siteScript);

        // Financing page: payment calculator behavior.
        if (document.getElementById('fin-price')) {
          const finScript = document.createElement('script');
          finScript.src = `${BASE}js/financing.js`;
          document.body.appendChild(finScript);
        }

        // Site-wide 0% financing CTA — last section before the footer.
        if (!document.getElementById('tara-financing-cta')) {
          const cta = document.createElement('section');
          cta.id = 'tara-financing-cta';
          cta.innerHTML = `
            <div class="tfc-inner">
              <div class="tfc-rate">
                <span class="tfc-rate-num">0<sup>%</sup></span>
                <span class="tfc-rate-label">APR Financing</span>
              </div>
              <div class="tfc-copy">
                <p class="tfc-kicker">&#9733; Limited-Time Offer</p>
                <h2 class="tfc-title">0% Financing on TARA Utility Task Vehicles</h2>
                <p class="tfc-sub">Drive home your TARA today &mdash; 0% financing options for up to <strong>36 months</strong>.</p>
              </div>
              <div class="tfc-action">
                <a class="tfc-button" href="/financing/">Get 0% Financing &#8594;</a>
                <span class="tfc-note">On approved credit</span>
              </div>
            </div>`;
          containerRef.current.appendChild(cta);
        }

        // Site-wide footer (client-requested; original footer was removed).
        if (!document.getElementById('tara-footer')) {
          const footer = document.createElement('footer');
          footer.id = 'tara-footer';
          footer.innerHTML = `
            <div class="tf-inner">
              <div class="tf-col tf-brand">
                <img src="${BASE}images/tara-utv-logo.png" alt="TARA Utility Task Vehicles (UTV)" />
                <p>TARA Utility Task Vehicles (UTV) — sales, service, and support for electric utility task vehicles, UTVs, and utility vehicles.</p>
                <p class="tf-disclaimer">We are an independent, authorized dealership selling TARA vehicles. We are not TARA, the manufacturer.</p>
                <a class="tf-phone" href="tel:8448443432">&#9742; 844-844-3432</a>
              </div>
              <div class="tf-col">
                <h4>Vehicles</h4>
                <a href="/t2-series/">T2 Utility Task Vehicle Series</a>
                <a href="/fleet-utvs/">Fleet Utility Task Vehicles</a>
                <a href="/accessories/">Accessories</a>
              </div>
              <div class="tf-col">
                <h4>Models</h4>
                <a href="/turfman-450-utility-vehicle-product/">Turfman 450</a>
                <a href="/turfman-700-utility-vehicle-product/">Turfman 700</a>
                <a href="/turfman-700-eec-utility-vehicle-product/">Turfman 700 EEC</a>
                <a href="/turfman-1000-utility-vehicle-product/">Turfman 1000</a>
              </div>
              <div class="tf-col">
                <h4>Support</h4>
                <a href="/technical-support/">Technical Support</a>
                <a href="/maintenance-support/">Maintenance</a>
                <a href="/warranty-terms/">Warranty Terms</a>
                <a href="/safety-information/">Safety Information</a>
                <a href="/recall-information/">Recall Information</a>
                <a href="/emergency-response-guides/">Emergency Guides</a>
                <a href="/faqs/">FAQs</a>
                <a href="/financing/">Financing</a>
              </div>
              <div class="tf-col">
                <h4>Company</h4>
                <a href="/">Home</a>
                <a href="/about-us/">About Us</a>
                <a href="/cases/">Customer Cases</a>
                <a href="/blog/">Blog</a>
                <a href="/contact/">Contact</a>
              </div>
            </div>
            <div class="tf-bottom">
              <span>&copy; ${new Date().getFullYear()} TARA Utility Task Vehicles (UTV). All rights reserved.</span>
              <span class="tf-legal">
                <a href="/privacy-policy/">Privacy Policy</a>
                <a href="/terms-and-conditions/">Terms &amp; Conditions</a>
              </span>
            </div>`;
          // Append inside the content container so the footer sits directly
          // after the page content (JS-injected drawers live at body end).
          containerRef.current.appendChild(footer);
        }

        // Site-wide "Call Now" button (dealership phone line).
        if (!document.getElementById('tara-call-now')) {
          const call = document.createElement('a');
          call.id = 'tara-call-now';
          call.href = 'tel:8448443432';
          call.innerHTML = '<span class="call-icon">&#9742;</span> Call Now';
          call.setAttribute('aria-label', 'Call TARA at 844-844-3432');
          document.body.appendChild(call);
        }

        // Product pages: show one vehicle image per selected color.
        // The original site used a Swiper synced to the color list; the
        // cloned bundle doesn't initialize it, so wire it up directly.
        initProductColorPicker(containerRef.current);

        // On contact (and similar) pages, inject the self-hosted inquiry form
        // after the article content. The original Mautic embed was removed at
        // the client's request; this replaces it with a form routed through
        // the project's api-server → Gmail.
        if (FORM_PAGES.has(path) && containerRef.current) {
          const article = containerRef.current.querySelector(
            'article.entry, .web_main .layout',
          );
          if (article) {
            const slot = document.createElement('div');
            slot.id = 'tara-inquiry-form';
            article.insertAdjacentElement('afterend', slot);
            mountInquiryForm(slot);
          }
        }

      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus('notfound');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div ref={containerRef} />
      {status === 'loading' && (
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          Loading…
        </div>
      )}
    </>
  );
}

type RouteEntry = RouteMeta | RouteRedirect;
