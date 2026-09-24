const C = window.PAIRLINE_CONFIG || {};

const hasConfig = Boolean(
  C.SUPABASE_URL &&
  C.SUPABASE_ANON_KEY &&
  C.OWNER_EMAIL &&
  window.supabase
);

const sb = hasConfig
  ? window.supabase.createClient(
      C.SUPABASE_URL,
      C.SUPABASE_ANON_KEY
    )
  : null;

let user = null;

const $ = id => document.getElementById(id);

function esc(v = '') {
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* -----------------------------
   SCREEN CONTROL
----------------------------- */

function hideDashboard() {
  const dashboard = $('dashboard');

  if (dashboard) {
    dashboard.hidden = true;
    dashboard.classList.add('hidden');
  }
}

function showLogin() {
  const login = $('login');
  const dashboard = $('dashboard');
  const setup = $('setupNotice');

  if (login) login.hidden = false;

  if (setup) setup.hidden = true;

  if (dashboard) {
    dashboard.hidden = true;
    dashboard.classList.add('hidden');
  }
}

function showSetup() {
  const login = $('login');
  const dashboard = $('dashboard');
  const setup = $('setupNotice');

  if (login) login.hidden = true;

  if (dashboard) {
    dashboard.hidden = true;
    dashboard.classList.add('hidden');
  }

  if (setup) setup.hidden = false;
}

function showDashboard() {
  const login = $('login');
  const dashboard = $('dashboard');
  const setup = $('setupNotice');

  if (login) login.hidden = true;
  if (setup) setup.hidden = true;

  if (dashboard) {
    dashboard.hidden = false;
    dashboard.classList.remove('hidden');
  }
}

function setStatus(id, msg, ok = true) {
  const el = $(id);

  if (!el) return;

  el.textContent = msg;
  el.style.color = ok ? '' : '#9d2c2c';
}

/* -----------------------------
   DEFAULT DATA
----------------------------- */

const defaultServices = [
  {
    title: 'Lawn Mowing',
    description: 'Reliable lawn mowing to keep your property looking clean and maintained.',
    sort_order: 1
  },
  {
    title: 'Edging',
    description: 'Clean, sharp edges along sidewalks, driveways, and lawn borders.',
    sort_order: 2
  },
  {
    title: 'Weed Whacking',
    description: 'Grass and weed trimming around areas a mower cannot reach.',
    sort_order: 3
  },
  {
    title: 'Gutter Cleaning',
    description: 'Removal of leaves and debris from residential gutters.',
    sort_order: 4
  },
  {
    title: 'Equipment Repairs',
    description: 'Equipment repair and maintenance services.',
    sort_order: 5
  }
];

const defaultReviews = [
  {
    name: 'Customer',
    rating: 5,
    text: 'Great service!',
    sort_order: 1,
    published: true
  }
];

/* -----------------------------
   AUTHENTICATION
----------------------------- */

async function signIn() {
  if (!sb) {
    showSetup();
    return;
  }

  const email = $('emailInput').value.trim();
  const password = $('passwordInput').value;

  if (!email || !password) {
    setStatus(
      'loginStatus',
      'Enter your email and password.',
      false
    );
    return;
  }

  const { error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showLogin();

    setStatus(
      'loginStatus',
      error.message,
      false
    );
  }
}

async function signOut() {
  if (!sb) return;

  await sb.auth.signOut();

  user = null;

  showLogin();

  setStatus(
    'loginStatus',
    'You have been signed out.',
    true
  );
}

async function handleUser(u) {
  if (!u) {
    user = null;
    showLogin();
    return;
  }

  const signedInEmail =
    (u.email || '').trim().toLowerCase();

  const ownerEmail =
    (C.OWNER_EMAIL || '').trim().toLowerCase();

  /*
    IMPORTANT:
    The dashboard is ONLY shown if the
    authenticated Supabase user's email
    exactly matches OWNER_EMAIL.
  */

  if (
    !ownerEmail ||
    !signedInEmail ||
    signedInEmail !== ownerEmail
  ) {
    user = null;

    await sb.auth.signOut();

    showLogin();

    setStatus(
      'loginStatus',
      'That email is not authorized for the owner dashboard.',
      false
    );

    return;
  }

  user = u;

  showDashboard();

  await loadAll();
}

async function check() {
  /*
    ALWAYS start with the dashboard hidden.
  */

  hideDashboard();
  showLogin();

  if (!sb) {
    showSetup();
    return;
  }

  const {
    data,
    error
  } = await sb.auth.getSession();

  if (error) {
    showLogin();

    setStatus(
      'loginStatus',
      error.message,
      false
    );

    return;
  }

  if (data && data.session) {
    await handleUser(data.session.user);
  }

  sb.auth.onAuthStateChange(
    (_event, session) => {
      setTimeout(() => {
        if (session) {
          handleUser(session.user);
        } else {
          user = null;
          showLogin();
        }
      }, 0);
    }
  );
}

/* -----------------------------
   LOAD DATA
----------------------------- */

async function loadAll() {
  if (!sb || !user) {
    showLogin();
    return;
  }

  const [
    { data: s, error: serviceError },
    { data: g, error: galleryError },
    { data: r, error: reviewError },
    { data: set, error: settingsError }
  ] = await Promise.all([
    sb
      .from('services')
      .select('*')
      .order('sort_order'),

    sb
      .from('gallery')
      .select('*')
      .order('sort_order'),

    sb
      .from('reviews')
      .select('*')
      .order('sort_order'),

    sb
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
  ]);

  if (serviceError) {
    console.error(serviceError);
  }

  if (galleryError) {
    console.error(galleryError);
  }

  if (reviewError) {
    console.error(reviewError);
  }

  if (settingsError) {
    console.error(settingsError);
  }

  renderServices(
    s && s.length
      ? s
      : defaultServices
  );

  renderGallery(g || []);

  renderReviews(
    r && r.length
      ? r
      : defaultReviews
  );

  $('googleUrl').value =
    set?.google_review_url ||
    C.GOOGLE_REVIEW_URL ||
    '';

  $('leaveReviewUrl').value =
    set?.leave_review_url ||
    C.LEAVE_REVIEW_URL ||
    'https://g.page/r/CVTTVOFnIt7jEAE/review';

  $('areaText').value =
    set?.service_area_text ||
    'Pairline Mowing serves Port Huron, Michigan and surrounding areas. Contact us to ask whether your address is within our service area.';
}

/* -----------------------------
   SERVICES
----------------------------- */

function renderServices(items) {
  const box = $('servicesEditor');

  if (!box) return;

  box.innerHTML = items.map((item, i) => `
    <div class="list-item">
      <div class="admin-grid">

        <div class="field">
          <label>Service name</label>
          <input
            data-service-title="${i}"
            value="${esc(item.title || '')}">
        </div>

        <div class="field">
          <label>Sort order</label>
          <input
            type="number"
            data-service-sort="${i}"
            value="${Number(item.sort_order || i + 1)}">
        </div>

        <div class="field full">
          <label>Description</label>
          <textarea data-service-description="${i}">${esc(item.description || '')}</textarea>
        </div>

      </div>
    </div>
  `).join('');
}

function collectServices() {
  return [...document.querySelectorAll('[data-service-title]')]
    .map((input, i) => ({
      title: input.value.trim(),
      description:
        document.querySelector(
          `[data-service-description="${i}"]`
        )?.value.trim() || '',
      sort_order:
        Number(
          document.querySelector(
            `[data-service-sort="${i}"]`
          )?.value
        ) || i + 1
    }))
    .filter(x => x.title);
}

async function saveServices() {
  if (!sb || !user) return;

  const services = collectServices();

  const { error } = await sb
    .from('services')
    .delete()
    .neq('id', 0);

  if (error) {
    setStatus(
      'servicesEditor',
      error.message,
      false
    );
    return;
  }

  if (services.length) {
    const { error: insertError } =
      await sb
        .from('services')
        .insert(services);

    if (insertError) {
      setStatus(
        'servicesEditor',
        insertError.message,
        false
      );
      return;
    }
  }

  setStatus(
    'servicesEditor',
    'Services saved.',
    true
  );

  await loadAll();
}

/* -----------------------------
   GALLERY
----------------------------- */

function renderGallery(items) {
  const box = $('galleryEditor');

  if (!box) return;

  box.innerHTML = items.map((item, i) => `
    <div class="list-item">
      <div class="admin-grid">

        <div class="field">
          <label>Title</label>
          <input
            data-gallery-title="${i}"
            value="${esc(item.title || '')}">
        </div>

        <div class="field">
          <label>Sort order</label>
          <input
            type="number"
            data-gallery-sort="${i}"
            value="${Number(item.sort_order || i + 1)}">
        </div>

        <div class="field full">
          <label>Image URL</label>
          <input
            data-gallery-url="${i}"
            type="url"
            value="${esc(item.image_url || item.url || '')}">
        </div>

      </div>
    </div>
  `).join('');
}

async function saveGallery() {
  if (!sb || !user) return;

  const items = [...document.querySelectorAll('[data-gallery-title]')]
    .map((input, i) => ({
      title: input.value.trim(),
      image_url:
        document.querySelector(
          `[data-gallery-url="${i}"]`
        )?.value.trim() || '',
      sort_order:
        Number(
          document.querySelector(
            `[data-gallery-sort="${i}"]`
          )?.value
        ) || i + 1
    }))
    .filter(x => x.image_url);

  const { error } = await sb
    .from('gallery')
    .delete()
    .neq('id', 0);

  if (error) {
    setStatus(
      'galleryEditor',
      error.message,
      false
    );
    return;
  }

  if (items.length) {
    const { error: insertError } =
      await sb
        .from('gallery')
        .insert(items);

    if (insertError) {
      setStatus(
        'galleryEditor',
        insertError.message,
        false
      );
      return;
    }
  }

  setStatus(
    'galleryEditor',
    'Gallery saved.',
    true
  );

  await loadAll();
}

/* -----------------------------
   REVIEWS
----------------------------- */

function renderReviews(items) {
  const box = $('reviewsEditor');

  if (!box) return;

  box.innerHTML = items.map((item, i) => `
    <div class="list-item">
      <div class="admin-grid">

        <div class="field">
          <label>Customer name</label>
          <input
            data-review-name="${i}"
            value="${esc(item.name || '')}">
        </div>

        <div class="field">
          <label>Rating</label>
          <select data-review-rating="${i}">
            ${[1,2,3,4,5].map(n => `
              <option
                value="${n}"
                ${Number(item.rating) === n ? 'selected' : ''}>
                ${n}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="field full">
          <label>Review</label>
          <textarea data-review-text="${i}">${esc(item.text || '')}</textarea>
        </div>

        <div class="field">
          <label>Sort order</label>
          <input
            type="number"
            data-review-sort="${i}"
            value="${Number(item.sort_order || i + 1)}">
        </div>

        <div class="field">
          <label>Published</label>
          <select data-review-published="${i}">
            <option value="true" ${item.published !== false ? 'selected' : ''}>Yes</option>
            <option value="false" ${item.published === false ? 'selected' : ''}>No</option>
          </select>
        </div>

      </div>
    </div>
  `).join('');
}

async function saveReviews() {
  if (!sb || !user) return;

  const items = [...document.querySelectorAll('[data-review-name]')]
    .map((input, i) => ({
      name: input.value.trim(),
      rating:
        Number(
          document.querySelector(
            `[data-review-rating="${i}"]`
          )?.value
        ) || 5,
      text:
        document.querySelector(
          `[data-review-text="${i}"]`
        )?.value.trim() || '',
      sort_order:
        Number(
          document.querySelector(
            `[data-review-sort="${i}"]`
          )?.value
        ) || i + 1,
      published:
        document.querySelector(
          `[data-review-published="${i}"]`
        )?.value === 'true'
    }))
    .filter(x => x.text);

  const { error } = await sb
    .from('reviews')
    .delete()
    .neq('id', 0);

  if (error) {
    setStatus(
      'reviewsEditor',
      error.message,
      false
    );
    return;
  }

  if (items.length) {
    const { error: insertError } =
      await sb
        .from('reviews')
        .insert(items);

    if (insertError) {
      setStatus(
        'reviewsEditor',
        insertError.message,
        false
      );
      return;
    }
  }

  setStatus(
    'reviewsEditor',
    'Reviews saved.',
    true
  );

  await loadAll();
}

/* -----------------------------
   SITE SETTINGS
----------------------------- */

async function saveSettings() {
  if (!sb || !user) return;

  const googleUrl =
    $('googleUrl').value.trim();

  const leaveReviewUrl =
    $('leaveReviewUrl').value.trim();

  const areaText =
    $('areaText').value.trim();

  const { error } = await sb
    .from('site_settings')
    .upsert({
      id: 1,
      google_review_url: googleUrl,
      leave_review_url: leaveReviewUrl,
      service_area_text: areaText
    });

  if (error) {
    setStatus(
      'settingsStatus',
      error.message,
      false
    );
    return;
  }

  setStatus(
    'settingsStatus',
    'Settings saved.',
    true
  );
}

/* -----------------------------
   BUTTONS
----------------------------- */

$('signInBtn')?.addEventListener(
  'click',
  signIn
);

$('signOut')?.addEventListener(
  'click',
  signOut
);

$('saveSettings')?.addEventListener(
  'click',
  saveSettings
);

$('saveServices')?.addEventListener(
  'click',
  saveServices
);

$('saveGallery')?.addEventListener(
  'click',
  saveGallery
);

$('saveReviews')?.addEventListener(
  'click',
  saveReviews
);

$('addService')?.addEventListener(
  'click',
  () => {
    const current = collectServices();

    current.push({
      title: '',
      description: '',
      sort_order: current.length + 1
    });

    renderServices(current);
  }
);

$('addGallery')?.addEventListener(
  'click',
  () => {
    const current = [...document.querySelectorAll('[data-gallery-title]')]
      .map((input, i) => ({
        title: input.value,
        image_url:
          document.querySelector(
            `[data-gallery-url="${i}"]`
          )?.value || '',
        sort_order:
          Number(
            document.querySelector(
              `[data-gallery-sort="${i}"]`
            )?.value
          ) || i + 1
      }));

    current.push({
      title: '',
      image_url: '',
      sort_order: current.length + 1
    });

    renderGallery(current);
  }
);

/* -----------------------------
   START
----------------------------- */

check();
