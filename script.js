<meta name='viewport' content='width=device-width, initial-scale=1'/><script>/* ============================================================
   ih5z -- Song Request Platform
   Vanilla JS. Wired to Web3Forms (primary) with Formspree fallback.
   ============================================================ */

/* ------------------------------------------------------------
   DELIVERY CONFIGURATION
   ------------------------------------------------------------
   PRIMARY -- Web3Forms (250 free submissions/month)
     1. Go to https://web3forms.com
     2. Enter your email -- you get an access key instantly.
     3. Paste it below. The key is public, safe to embed.
     Submissions land in your inbox + 30-day dashboard.

   FALLBACK -- Formspree (50 free submissions/month)
     Used automatically when WEB3FORMS_ACCESS_KEY is empty.
     This is the endpoint already wired from the previous build.
   ------------------------------------------------------------ */
const WEB3FORMS_ACCESS_KEY = "c51239a3-0ee0-40b2-9148-cdef298752f7"; // <-- paste your Web3Forms access key here
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xeaaoyqq";

const USE_WEB3FORMS = WEB3FORMS_ACCESS_KEY.trim() !== "";
const DELIVERY_ENDPOINT = USE_WEB3FORMS
  ? "https://api.web3forms.com/submit"
  : FORMSPREE_ENDPOINT;

/* ------------------------------------------------------------
   Footer year
   ------------------------------------------------------------ */
document.getElementById('year').textContent = new Date().getFullYear();

/* ------------------------------------------------------------
   Floating request button -- appears after scrolling past hero
   ------------------------------------------------------------ */
const fab = document.getElementById('fabRequest');
const formSection = document.getElementById('request');

function updateFab() {
  const pastHero = window.scrollY > 400;
  const formRect = formSection.getBoundingClientRect();
  const formInView = formRect.top < window.innerHeight && formRect.bottom > 0;
  fab.classList.toggle('visible', pastHero && !formInView);
}

window.addEventListener('scroll', updateFab, { passive: true });
window.addEventListener('resize', updateFab);
updateFab();

/* ------------------------------------------------------------
   Form references
   ------------------------------------------------------------ */
const form            = document.getElementById('requestForm');
const submitBtn       = document.getElementById('submitBtn');
const resetBtn        = document.getElementById('resetBtn');
const formError       = document.getElementById('formError');
const successOverlay  = document.getElementById('successOverlay');
const successSong     = document.getElementById('successSong');
const successStyle    = document.getElementById('successStyle');
const submitAnotherBtn= document.getElementById('submitAnotherBtn');

const FIELDS = {
  songName:     document.getElementById('songName'),
  artistName:   document.getElementById('artistName'),
  editStyle:    document.getElementById('editStyle'),
  songLanguage: document.getElementById('songLanguage'),
  songLink:     document.getElementById('songLink'),
  nickname:     document.getElementById('nickname'),
  reason:       document.getElementById('reason'),
  instructions: document.getElementById('instructions'),
};

const YT_RE   = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i;
const SPOT_RE = /^(https?:\/\/)?(open\.spotify\.com|spotify\.link)\//i;

/* ------------------------------------------------------------
   Error helpers
   ------------------------------------------------------------ */
function setFieldError(name, msg) {
  const field = FIELDS[name]?.closest('.field');
  const errEl = document.querySelector(`.field-error[data-for="${name}"]`);
  if (!field || !errEl) return;
  if (msg) {
    field.classList.add('has-error');
    FIELDS[name].setAttribute('aria-invalid', 'true');
    errEl.textContent = msg;
  } else {
    field.classList.remove('has-error');
    FIELDS[name].removeAttribute('aria-invalid');
    errEl.textContent = '';
  }
}

function clearAllErrors() {
  for (const name of Object.keys(FIELDS)) setFieldError(name, '');
  hideFormError();
}

function showFormError(msg) {
  formError.textContent = msg;
  formError.hidden = false;
}
function hideFormError() {
  formError.hidden = true;
  formError.textContent = '';
}

/* ------------------------------------------------------------
   Duplicate protection (localStorage)
   ------------------------------------------------------------ */
const DUPE_KEY = 'ih5z_recent_requests';

function normalizeKey(song, artist) {
  return `${song.trim().toLowerCase()}::${artist.trim().toLowerCase()}`;
}

function getRecentRequests() {
  try {
    return JSON.parse(localStorage.getItem(DUPE_KEY) || '[]');
  } catch { return []; }
}

function isDuplicate(song, artist) {
  const key = normalizeKey(song, artist);
  return getRecentRequests().some(r => r.key === key);
}

function rememberRequest(song, artist) {
  const list = getRecentRequests();
  list.push({ key: normalizeKey(song, artist), ts: Date.now() });
  const trimmed = list.slice(-50);
  localStorage.setItem(DUPE_KEY, JSON.stringify(trimmed));
}

/* ------------------------------------------------------------
   Validation
   ------------------------------------------------------------ */
function validateForm() {
  clearAllErrors();
  let valid = true;

  const song      = FIELDS.songName.value.trim();
  const artist    = FIELDS.artistName.value.trim();
  const style     = FIELDS.editStyle.value;
  const language  = FIELDS.songLanguage.value;
  const link      = FIELDS.songLink.value.trim();

  if (!song) {
    setFieldError('songName', 'Song name is required.'); valid = false;
  } else if (song.length > 120) {
    setFieldError('songName', 'Keep it under 120 characters.'); valid = false;
  }

  if (!artist) {
    setFieldError('artistName', 'Artist name is required.'); valid = false;
  } else if (artist.length > 120) {
    setFieldError('artistName', 'Keep it under 120 characters.'); valid = false;
  }

  if (!style) {
    setFieldError('editStyle', 'Pick an edit style.'); valid = false;
  }

  if (!language) {
    setFieldError('songLanguage', 'Pick a language.'); valid = false;
  }

  if (link) {
    let parsed = null;
    try { parsed = new URL(link.startsWith('http') ? link : `https://${link}`); }
    catch { /* fall through */ }
    if (!parsed || !(YT_RE.test(parsed.href) || SPOT_RE.test(parsed.href))) {
      setFieldError('songLink', 'Must be a YouTube or Spotify link.');
      valid = false;
    }
  }

  if (valid && isDuplicate(song, artist)) {
    showFormError('Looks like you already submitted this song recently. Give a different one a try, or wait a bit.');
    valid = false;
  }

  return valid;
}

/* ------------------------------------------------------------
   Submission
   ------------------------------------------------------------ */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // honeypot check -- bots fill this, humans never see it
  if (document.getElementById('gotcha').value !== '') {
    showSuccess();
    return;
  }

  if (!validateForm()) {
    const firstError = form.querySelector('.has-error input, .has-error select, .has-error textarea');
    firstError?.focus();
    return;
  }

  const song   = FIELDS.songName.value.trim();
  const artist = FIELDS.artistName.value.trim();
  const style  = FIELDS.editStyle.value;

  const payload = new FormData(form);

  if (USE_WEB3FORMS) {
    payload.append('access_key', WEB3FORMS_ACCESS_KEY);
    payload.append('subject', `ih5z request: ${song} -- ${artist}`);
    payload.append('from_name', 'ih5z requests');
  } else {
    // Formspree path
    payload.set('_subject', `ih5z request: ${song} -- ${artist}`);
    payload.append('_submittedAt', new Date().toISOString());
    payload.append('_source', 'ih5z-song-request');
  }

  setLoading(true);
  hideFormError();

  try {
    const res = await fetch(DELIVERY_ENDPOINT, {
      method: 'POST',
      body: payload,
      headers: { 'Accept': 'application/json' },
    });

    let data = null;
    try { data = await res.json(); } catch { /* non-JSON response */ }

    // Web3Forms returns { success: true } on success, { success: false, message } on failure
    if (USE_WEB3FORMS && data && data.success !== true) {
      throw new Error(data.message || 'The form service rejected the submission.');
    }

    if (!res.ok) {
      let detail = `Submission failed (${res.status}).`;
      if (data?.errors?.length) {
        detail = data.errors.map(err => err.message || err.field).join(' · ');
      } else if (data?.message) {
        detail = data.message;
      }
      throw new Error(detail);
    }

    rememberRequest(song, artist);
    showSuccess();
  } catch (err) {
    const msg = err.message || 'Something went wrong. Please try again in a moment.';
    showFormError(
      USE_WEB3FORMS
        ? `${msg} If this keeps happening, the access key may need to be re-verified.`
        : `${msg} Formspree may be over its monthly limit -- switch to Web3Forms in script.js.`
    );
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle('loading', isLoading);
  submitBtn.querySelector('.btn-label').textContent = isLoading ? 'Sending…' : 'Submit Request';
}

function showSuccess() {
  successSong.textContent  = FIELDS.songName.value.trim() || '--';
  successStyle.textContent = FIELDS.editStyle.value || '--';
  successOverlay.hidden = false;
  submitAnotherBtn.focus();
}

/* ------------------------------------------------------------
   Reset
   ------------------------------------------------------------ */
resetBtn.addEventListener('click', () => {
  form.reset();
  clearAllErrors();
  FIELDS.songName.focus();
});

submitAnotherBtn.addEventListener('click', () => {
  successOverlay.hidden = true;
  form.reset();
  clearAllErrors();
  document.getElementById('request').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => FIELDS.songName.focus(), 400);
});

/* Escape closes modal */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !successOverlay.hidden) {
    successOverlay.hidden = true;
  }
});

/* Live-clear field errors on input/change */
for (const el of Object.values(FIELDS)) {
  el?.addEventListener('input', () => {
    if (document.querySelector(`.field-error[data-for="${el.name}"]`)?.textContent) {
      setFieldError(el.name, '');
    }
  });
  el?.addEventListener('change', () => {
    if (document.querySelector(`.field-error[data-for="${el.name}"]`)?.textContent) {
      setFieldError(el.name, '');
    }
  });
}</script>