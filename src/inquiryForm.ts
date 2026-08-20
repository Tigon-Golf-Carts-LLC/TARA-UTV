import { COUNTRIES } from './countries';
import site from './data/site.json';

/**
 * Third-party form endpoint (Formspree / Netlify Forms / Google Forms), baked
 * in at build time from VITE_FORM_ENDPOINT. GitHub Pages has no backend, so
 * when it is empty the form falls back to opening a prefilled e-mail instead.
 */
const FORM_ENDPOINT: string = site.formEndpoint;

const CONTACT_EMAIL = site.contact.email;
const CONTACT_PHONE = site.contact.phoneDisplay;
const CONTACT_TEL = site.contact.phoneTel;

const FORM_STYLE = `
.tara-inquiry-wrapper { max-width: 600px; margin: 10px auto; padding: 0 15px; }
.tara-inquiry-row { display: block; margin-bottom: 20px; }
.tara-inquiry-row input,
.tara-inquiry-row select,
.tara-inquiry-row textarea {
  width: 100%; box-sizing: border-box; padding: 12px 14px;
  border: 1px solid #d5d5d5; border-radius: 4px;
  font-size: 15px; font-family: inherit; color: #333; background: #fff;
}
.tara-inquiry-row textarea { min-height: 120px; resize: vertical; }
.tara-inquiry-row input:focus,
.tara-inquiry-row select:focus,
.tara-inquiry-row textarea:focus { outline: none; border-color: #8dc63f; }
.tara-inquiry-submit {
  display: inline-block; padding: 12px 40px; border: none; border-radius: 4px;
  background: #8dc63f; color: #fff; font-size: 16px; font-weight: 700;
  cursor: pointer; transition: background .2s;
}
.tara-inquiry-submit:hover { background: #7ab32f; }
.tara-inquiry-submit[disabled] { opacity: .6; cursor: default; }
.tara-inquiry-error { margin-bottom: 10px; color: #c0392b; }
.tara-inquiry-success { margin-bottom: 10px; color: #27ae60; font-weight: 700; }
.tara-inquiry-direct { margin-top: 18px; text-align: center; font-size: 15px; color: #444; }
.tara-inquiry-direct a { color: #8dc63f; font-weight: 700; text-decoration: none; }
.tara-inquiry-direct a:hover { text-decoration: underline; }
`;

/** Build a prefilled mailto: link from the submitted form fields. */
function mailtoLink(data: Record<string, FormDataEntryValue>): string {
  const line = (label: string, key: string) => {
    const value = String(data[key] ?? '').trim();
    return value ? `${label}: ${value}\n` : '';
  };
  const body =
    line('Name', 'name') +
    line('E-mail', 'email') +
    line('Inquiry type', 'inquiryType') +
    line('Phone', 'phone') +
    line('Country', 'country') +
    `\n${String(data['message'] ?? '').trim()}\n\n` +
    `Sent from ${window.location.href}`;
  return (
    `mailto:${CONTACT_EMAIL}` +
    `?subject=${encodeURIComponent(`TARA UTV inquiry from ${String(data['name'] ?? '').trim()}`)}` +
    `&body=${encodeURIComponent(body)}`
  );
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/**
 * Renders the inquiry form into `container`. On a static host there is no
 * backend, so submissions go to a third-party form service when
 * VITE_FORM_ENDPOINT is set, and otherwise open a prefilled e-mail. Either way
 * the visitor also gets a direct phone and e-mail CTA.
 */
export function mountInquiryForm(container: Element): void {
  const options = COUNTRIES.map(
    (c) => `<option value="${esc(c)}">${esc(c)}</option>`,
  ).join('');

  container.innerHTML = `
  <style>${FORM_STYLE}</style>
  <div class="tara-inquiry-wrapper">
    <form class="tara-inquiry-form" novalidate>
      <div class="tara-inquiry-error" hidden></div>
      <div class="tara-inquiry-success" hidden></div>
      <!-- honeypot: hidden from real users, filled by bots -->
      <div style="display:none" aria-hidden="true">
        <input name="website" type="text" tabindex="-1" autocomplete="off" />
      </div>
      <div class="tara-inquiry-row">
        <input name="name" type="text" placeholder="Name" required maxlength="200" />
      </div>
      <div class="tara-inquiry-row">
        <input name="email" type="email" placeholder="Your E-mail Address" required maxlength="320" />
      </div>
      <div class="tara-inquiry-row">
        <select name="inquiryType">
          <option value="">Select an Option</option>
          <option value="Dealer">Dealer</option>
          <option value="Customer">Customer</option>
        </select>
      </div>
      <div class="tara-inquiry-row">
        <input name="phone" type="tel" placeholder="Phone Number" maxlength="50" />
      </div>
      <div class="tara-inquiry-row">
        <select name="country">
          <option value="">Country</option>
          ${options}
        </select>
      </div>
      <div class="tara-inquiry-row">
        <textarea name="message" placeholder="Do you have any questions for us?" maxlength="5000"></textarea>
      </div>
      <div class="tara-inquiry-row" style="text-align:center">
        <button type="submit" class="tara-inquiry-submit">SUBMIT</button>
      </div>
    </form>
    <p class="tara-inquiry-direct">
      Prefer to reach us directly? Call
      <a href="tel:${esc(CONTACT_TEL)}">${esc(CONTACT_PHONE)}</a>
      or e-mail
      <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>.
    </p>
  </div>`;

  const form = container.querySelector<HTMLFormElement>('.tara-inquiry-form')!;
  const errorEl = form.querySelector<HTMLElement>('.tara-inquiry-error')!;
  const successEl = form.querySelector<HTMLElement>('.tara-inquiry-success')!;
  const submitBtn = form.querySelector<HTMLButtonElement>('.tara-inquiry-submit')!;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    successEl.hidden = true;

    const data = Object.fromEntries(new FormData(form).entries());
    if (!String(data['name'] || '').trim() || !String(data['email'] || '').trim()) {
      errorEl.textContent = 'Please fill in your name and e-mail address.';
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait ...';

    try {
      if (FORM_ENDPOINT) {
        // Third-party form service. It handles delivery, spam filtering, and
        // notification e-mail — no server of ours is involved.
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            ...data,
            _subject: `TARA UTV inquiry from ${data['name']}`,
            page: window.location.pathname,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}) as Record<string, unknown>);
          throw new Error(
            typeof (body as { error?: unknown }).error === 'string'
              ? ((body as { error: string }).error)
              : `Submission failed (${res.status}).`,
          );
        }
      } else {
        // No endpoint configured: hand the message to the visitor's mail app.
        window.location.href = mailtoLink(data);
      }

      form.reset();
      successEl.textContent = FORM_ENDPOINT
        ? 'Thank you! Your message has been sent. We will get back to you shortly.'
        : `Your e-mail app is opening with your message. If nothing happens, e-mail us at ${CONTACT_EMAIL}.`;
      successEl.hidden = false;
    } catch (err) {
      errorEl.innerHTML =
        (err instanceof Error ? esc(err.message) : 'Something went wrong.') +
        ` Please e-mail <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>` +
        ` or call <a href="tel:${esc(CONTACT_TEL)}">${esc(CONTACT_PHONE)}</a>.`;
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'SUBMIT';
    }
  });
}
