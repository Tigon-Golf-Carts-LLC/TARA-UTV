import { useEffect, useRef, useState } from 'react';

import { injectStructuredData } from './structuredData';
import { mountInquiryForm } from './inquiryForm';
import { BASE, withBase } from './lib/base';
import site from './data/site.json';
import models from './data/models.json';

type RouteMeta = {
  file: string;
  title: string;
  description?: string;
  ogImage?: string;
  bodyClass: string;
};
type RouteRedirect = { redirect: string };
type RouteEntry = RouteMeta | RouteRedirect;
type Routes = Record<string, RouteEntry>;

type Props = {
  prerenderedHtml: string;
  prerenderedRoute: string;
};

/** Pages that should show the inquiry form. */
const FORM_PAGES = new Set(['/contact/']);

function normalizePath(pathname: string): string {
  let result = pathname;
  const prefix = BASE.replace(/\/$/, '');
  if (prefix && result.startsWith(prefix)) {
    result = result.slice(prefix.length) || '/';
  }
  if (!result.startsWith('/')) result = '/' + result;
  if (result !== '/' && !result.endsWith('/')) result += '/';
  return result;
}

function lookupRoute(routes: Routes, path: string): RouteEntry | null {
  if (routes[path]) return routes[path];
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

/** Wire the product color list to the vehicle image slides (one per color). */
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

/** Model links in the footer come from the build-time snapshot. */
function footerModelLinks(): string {
  const featured = models
    .filter((model) => model.series === 'T2 Series')
    .slice(0, 4);
  const list = featured.length ? featured : models.slice(0, 4);
  return list
    .map(
      (model) =>
        `<a href="${withBase(model.url)}">${model.name.replace(/\s*\|.*$/, '')}</a>`,
    )
    .join('\n                ');
}

function enhance(container: HTMLElement, path: string) {
  const { email, phoneDisplay, phoneTel } = site.contact;

  // Load the cloned site's behavior script (menus, sliders, tabs). It binds on
  // DOMContentLoaded / load, both of which fired before this content existed,
  // so re-dispatch them once it is ready.
  const siteScript = document.createElement('script');
  siteScript.src = `${BASE}js/jquery.min_index.js`;
  siteScript.async = false;
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
          <a class="tfc-button" href="${withBase('/financing/')}">Get 0% Financing &#8594;</a>
          <span class="tfc-note">On approved credit</span>
        </div>
      </div>`;
    container.appendChild(cta);
  }

  // Site-wide footer (client-requested; the original footer was removed).
  if (!document.getElementById('tara-footer')) {
    const footer = document.createElement('footer');
    footer.id = 'tara-footer';
    footer.innerHTML = `
      <div class="tf-inner">
        <div class="tf-col tf-brand">
          <img src="${BASE}images/tara-utv-logo.png" alt="TARA Utility Task Vehicles (UTV)" />
          <p>TARA Utility Task Vehicles (UTV) — sales, service, and support for electric utility task vehicles, UTVs, and utility vehicles.</p>
          <p class="tf-disclaimer">We are an independent, authorized dealership selling TARA vehicles. We are not TARA, the manufacturer.</p>
          <a class="tf-phone" href="tel:${phoneTel}">&#9742; ${phoneDisplay}</a>
          <a class="tf-email" href="mailto:${email}">&#9993; ${email}</a>
        </div>
        <div class="tf-col">
          <h4>Vehicles</h4>
          <a href="${withBase('/t2-series/')}">T2 Utility Task Vehicle Series</a>
          <a href="${withBase('/fleet-utvs/')}">Fleet Utility Task Vehicles</a>
          <a href="${withBase('/accessories/')}">Accessories</a>
        </div>
        <div class="tf-col">
          <h4>Models</h4>
          ${footerModelLinks()}
        </div>
        <div class="tf-col">
          <h4>Support</h4>
          <a href="${withBase('/technical-support/')}">Technical Support</a>
          <a href="${withBase('/maintenance-support/')}">Maintenance</a>
          <a href="${withBase('/warranty-terms/')}">Warranty Terms</a>
          <a href="${withBase('/safety-information/')}">Safety Information</a>
          <a href="${withBase('/recall-information/')}">Recall Information</a>
          <a href="${withBase('/emergency-response-guides/')}">Emergency Guides</a>
          <a href="${withBase('/faqs/')}">FAQs</a>
          <a href="${withBase('/financing/')}">Financing</a>
        </div>
        <div class="tf-col">
          <h4>Company</h4>
          <a href="${BASE}">Home</a>
          <a href="${withBase('/about-us/')}">About Us</a>
          <a href="${withBase('/cases/')}">Customer Cases</a>
          <a href="${withBase('/blog/')}">Blog</a>
          <a href="${withBase('/contact/')}">Contact</a>
        </div>
      </div>
      <div class="tf-bottom">
        <span>&copy; ${new Date().getFullYear()} <a href="https://tigongolfcarts.com/tara-ev" rel="sponsored">TARA Utility Task Vehicles (UTV)</a>. All rights reserved.</span>
        <span class="tf-legal">
          <a href="${withBase('/privacy-policy/')}">Privacy Policy</a>
          <a href="${withBase('/terms-and-conditions/')}">Terms &amp; Conditions</a>
        </span>
      </div>`;
    container.appendChild(footer);
  }

  // Site-wide "Call Now" button (dealership phone line).
  if (!document.getElementById('tara-call-now')) {
    const call = document.createElement('a');
    call.id = 'tara-call-now';
    call.href = `tel:${phoneTel}`;
    call.innerHTML = '<span class="call-icon">&#9742;</span> Call Now';
    call.setAttribute('aria-label', `Call TARA at ${phoneDisplay}`);
    document.body.appendChild(call);
  }

  // Product pages: show one vehicle image per selected color.
  initProductColorPicker(container);

  // Contact page: the inquiry form posts to a third-party endpoint (or falls
  // back to a mailto: message) — there is no backend to post to.
  if (FORM_PAGES.has(path)) {
    const article = container.querySelector('article.entry, .web_main .layout');
    if (article) {
      const slot = document.createElement('div');
      slot.id = 'tara-inquiry-form';
      article.insertAdjacentElement('afterend', slot);
      mountInquiryForm(slot);
    }
  }
}

export default function App({ prerenderedHtml, prerenderedRoute }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>(
    prerenderedHtml ? 'ready' : 'loading',
  );

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    // Fast path: the page was prerendered, so its markup shipped with the
    // document. Re-attach it and enhance — no network request at all.
    if (prerenderedHtml) {
      container.innerHTML = prerenderedHtml;
      const path = prerenderedRoute || normalizePath(window.location.pathname);
      injectStructuredData(path, document.title);
      enhance(container, path);
      setStatus('ready');
      return;
    }

    // Fallback path: 404.html for a URL with no prerendered file. Resolve it
    // against the static route manifest (a plain JSON file, not an API).
    async function load() {
      const path = normalizePath(window.location.pathname);
      try {
        const routesRes = await fetch(`${BASE}content/routes.json`);
        const routes: Routes = await routesRes.json();
        const entry = lookupRoute(routes, path);
        if (!entry) {
          if (!cancelled) setStatus('notfound');
          return;
        }
        if ('redirect' in entry) {
          window.location.replace(withBase(entry.redirect));
          return;
        }

        const res = await fetch(`${BASE}content/${encodeURIComponent(entry.file)}`);
        if (!res.ok) {
          if (!cancelled) setStatus('notfound');
          return;
        }
        const html = await res.text();
        if (cancelled || !containerRef.current) return;

        document.title = entry.title;
        applyMeta(path, entry);
        injectStructuredData(path, entry.title);
        if (entry.bodyClass) document.body.className = entry.bodyClass;

        containerRef.current.innerHTML = html;
        setStatus('ready');
        enhance(containerRef.current, path);
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus('notfound');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [prerenderedHtml, prerenderedRoute]);

  return (
    <>
      <div ref={containerRef} />
      {status === 'loading' && (
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>Loading…</div>
      )}
      {status === 'notfound' && (
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <h1>Page not found</h1>
          <p>
            The page you were looking for is not available.{' '}
            <a href={BASE}>Return to the home page</a> or call{' '}
            <a href={`tel:${site.contact.phoneTel}`}>
              {site.contact.phoneDisplay}
            </a>
            .
          </p>
        </div>
      )}
    </>
  );
}

/** Client-side head updates, used only on the 404 fallback path. */
function applyMeta(path: string, meta: RouteMeta) {
  const canonicalUrl = `${site.baseUrl}${path}`;
  const description = meta.description ?? '';
  const socialImage = `${site.baseUrl}${meta.ogImage ?? '/images/og-image.png'}`;

  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', canonicalUrl);

  const setMeta = (key: 'name' | 'property', value: string, content: string) => {
    let tag = document.querySelector<HTMLMetaElement>(`meta[${key}="${value}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(key, value);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  };

  setMeta('name', 'description', description);
  setMeta('name', 'image', socialImage);
  setMeta('property', 'og:title', meta.title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', socialImage);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('name', 'twitter:title', meta.title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', socialImage);
}
