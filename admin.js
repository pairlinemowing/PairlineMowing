const C = window.PAIRLINE_CONFIG || {};

let sb = null;
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

function showLogin(message = '', ok = true) {
  const login = $('login');
  const dashboard = $('dashboard');
  const setup = $('setupNotice');

  if (login) {
    login.hidden = false;
    login.style.display = 'block';
  }

  if (dashboard) {
    dashboard.hidden = true;
    dashboard.style.display = 'none';
  }

  if (setup) {
    setup.hidden = true;
  }

  if (message) {
    setStatus('loginStatus', message, ok);
  }
}

function showSetup(
  message = 'Supabase is not connected. Check config.js and make sure the Supabase library loaded.'
) {
  const login = $('login');
  const dashboard = $('dashboard');
  const setup = $('setupNotice');

  if (login) {
    login.hidden = false;
    login.style.display = 'block';
  }

  if (dashboard) {
    dashboard.hidden = true;
    dashboard.style.display = 'none';
  }

  if (setup) {
    setup.hidden = false;
    setup.innerHTML = `
      <strong>Connection setup needed.</strong>
      <p>${esc(message)}</p>
    `;
  }
}

function showDashboard() {
  /*
    The dashboard is only shown when a verified,
    authorized Supabase user exists.
  */

  if (!user) {
    showLogin();
    return;
  }

  const login = $('login');
  const dashboard = $('dashboard');
  const setup = $('setupNotice');

  if (login) {
    login.hidden = true;
    login.style.display = 'none';
  }

  if (setup) {
    setup.hidden = true;
  }

  if (dashboard) {
    dashboard.hidden = false;
    dashboard.style.display = 'block';
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
    description:
      'Reliable lawn mowing to keep your property looking clean and maintained.',
    sort_order: 1
  },
  {
    title: 'Edging',
    description:
      'Clean, sharp edges along sidewalks, driveways, and lawn borders.',
    sort_order: 2
  },
  {
    title: 'Weed Whacking',
    description:
      'Grass and weed trimming around areas a mower cannot reach.',
    sort_order: 3
  },
  {
    title: 'Gutter Cleaning',
    description:
      'Removal of leaves and debris from residential gutters.',
    sort_order: 4
  },
  {
    title: 'Equipment Repairs',
    description:
      'Equipment repair and maintenance services.',
    sort_order: 5
  }
];

/*
  No fake/default reviews.
  If there are no real reviews in Supabase,
  the admin editor will simply be empty.
*/

const defaultReviews = [];

/* -----------------------------
   SUPABASE SETUP
----------------------------- */

function initializeSupabase() {
  if (
    !C.SUPABASE_URL ||
    !C.SUPABASE_ANON_KEY ||
    !C.OWNER_EMAIL
  ) {
    showSetup(
      'config.js is missing the Supabase URL, Supabase publishable/anon key, or OWNER_EMAIL.'
    );

    return false;
  }

  if (!window.supabase) {
    showSetup(
      'The Supabase library did not load. Check your internet connection and make sure the Supabase script is above admin.js in admin.html.'
    );

    return false;
  }

  try {
    sb = window.supabase.createClient(
      C.SUPABASE_URL,
      C.SUPABASE_ANON_KEY
    );

    return true;
  } catch (error) {
    console.error(
      'Supabase initialization error:',
      error
    );

    showSetup(
      'Supabase could not be initialized: ' +
      (error.message || 'Unknown error')
    );

    return false;
  }
}

/* -----------------------------
   OWNER CHECK
----------------------------- */

function isOwner(u) {
  if (!u || !u.email) {
    return false;
  }

  const signedInEmail =
    u.email.trim().toLowerCase();

  const ownerEmail =
    (C.OWNER_EMAIL || '').trim().toLowerCase();

  return (
    ownerEmail &&
    signedInEmail === ownerEmail
  );
}

/* -----------------------------
   AUTHENTICATION
----------------------------- */

async function signIn() {
  try {
    if (!sb) {
      showSetup(
        'Supabase is not connected. Check config.js and make sure the Supabase library loaded.'
      );

      return;
    }

    const email =
      $('emailInput')?.value.trim() || '';

    const password =
      $('passwordInput')?.value || '';

    if (!email || !password) {
      showLogin();

      setStatus(
        'loginStatus',
        'Enter your email and password.',
        false
      );

      return;
    }

    const ownerEmail =
      (C.OWNER_EMAIL || '').trim().toLowerCase();

    if (
      !ownerEmail ||
      email.toLowerCase() !== ownerEmail
    ) {
      showLogin();

      setStatus(
        'loginStatus',
        'That email is not authorized for the owner dashboard.',
        false
      );

      return;
    }

    setStatus(
      'loginStatus',
      'Signing in...',
      true
    );

    const {
      data,
      error
    } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error(
        'Supabase sign-in error:',
        error
      );

      showLogin();

      setStatus(
        'loginStatus',
        'Sign-in failed: ' + error.message,
        false
      );

      return;
    }

    if (!data?.user) {
      showLogin();

      setStatus(
        'loginStatus',
        'Sign-in did not return an authenticated user.',
        false
      );

      return;
    }

    await handleUser(data.user);

  } catch (error) {
    console.error(
      'Unexpected sign-in error:',
      error
    );

    showLogin();

    setStatus(
      'loginStatus',
      'Login error: ' +
      (error.message || 'Unknown error'),
      false
    );
  }
}

async function signOut() {
  user = null;

  /*
    Hide the dashboard immediately.
  */
  showLogin();

  if (!sb) {
    setStatus(
      'loginStatus',
      'You have been signed out.',
      true
    );

    return;
  }

  try {
    const { error } =
      await sb.auth.signOut();

    if (error) {
      console.error(
        'Sign-out error:',
        error
      );
    }

    setStatus(
      'loginStatus',
      'You have been signed out.',
      true
    );

  } catch (error) {
    console.error(
      'Unexpected sign-out error:',
      error
    );

    setStatus(
      'loginStatus',
      'You have been signed out.',
      true
    );
  }
}

async function handleUser(u) {
  if (!u) {
    user = null;
    showLogin();
    return;
  }

  /*
    Check the authenticated Supabase user
    against the owner email.
  */
  if (!isOwner(u)) {
    user = null;

    try {
      await sb.auth.signOut();
    } catch (error) {
      console.error(
        'Could not sign out unauthorized user:',
        error
      );
    }

    showLogin();

    setStatus(
      'loginStatus',
      'That email is not authorized for the owner dashboard.',
      false
    );

    return;
  }

  /*
    Only now do we consider the user authorized.
  */
  user = u;

  showDashboard();

  await loadAll();
}

/* -----------------------------
   START / SESSION CONTROL
----------------------------- */

async function check() {
  /*
    ALWAYS hide the dashboard while
    the authentication state is checked.
  */
  user = null;
  showLogin();

  if (!initializeSupabase()) {
    return;
  }

  /*
    Listen for future authentication changes.
  */
  sb.auth.onAuthStateChange(
    (event, session) => {

      if (
        event === 'SIGNED_IN' &&
        session?.user
      ) {
        /*
          Use a timeout so Supabase can finish
          updating its internal session state.
        */
        setTimeout(() => {
          handleUser(session.user);
        }, 0);

        return;
      }

      if (event === 'SIGNED_OUT') {
        user = null;
        showLogin();
      }
    }
  );

  /*
    IMPORTANT:
    We do NOT sign out here.

    Supabase can keep the authenticated session
    after a page refresh. We retrieve that session
    and verify the user before showing the dashboard.
  */
  try {
    const {
      data,
      error
    } = await sb.auth.getSession();

    if (error) {
      console.error(
        'Could not retrieve Supabase session:',
        error
      );

      user = null;
      showLogin();

      setStatus(
        'loginStatus',
        'Could not check your login session.',
        false
      );

      return;
    }

    const sessionUser =
      data?.session?.user || null;

    if (!sessionUser) {
      user = null;
      showLogin();
      return;
    }

    await handleUser(sessionUser);

  } catch (error) {
    console.error(
      'Unexpected session check error:',
      error
    );

    user = null;
    showLogin();

    setStatus(
      'loginStatus',
      'Could not check your login session.',
      false
    );
  }
}

/* -----------------------------
   LOAD DATA
----------------------------- */

async function loadAll() {
  if (!sb || !user) {
    showLogin();
    return;
  }

  try {
    const [
      servicesResult,
      galleryResult,
      reviewsResult,
      settingsResult
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

    /*
      If the session disappeared while loading,
      immediately hide the dashboard.
    */
    if (!user) {
      showLogin();
      return;
    }

    if (servicesResult.error) {
      console.error(
        'Services load error:',
        servicesResult.error
      );
    }

    if (galleryResult.error) {
      console.error(
        'Gallery load error:',
        galleryResult.error
      );
    }

    if (reviewsResult.error) {
      console.error(
        'Reviews load error:',
        reviewsResult.error
      );
    }

    if (settingsResult.error) {
      console.error(
        'Settings load error:',
        settingsResult.error
      );
    }

    const services =
      servicesResult.data || [];

    const gallery =
      galleryResult.data || [];

    const reviews =
      reviewsResult.data || [];

    const settings =
      settingsResult.data || null;

    renderServices(
      services.length
        ? services
        : defaultServices
    );

    renderGallery(gallery);

    renderReviews(
      reviews.length
        ? reviews
        : defaultReviews
    );

    const googleUrl =
      $('googleUrl');

    if (googleUrl) {
      googleUrl.value =
        settings?.google_review_url ||
        C.GOOGLE_REVIEW_URL ||
        '';
    }

    const leaveReviewUrl =
      $('leaveReviewUrl');

    if (leaveReviewUrl) {
      leaveReviewUrl.value =
        settings?.leave_review_url ||
        C.LEAVE_REVIEW_URL ||
        '';
    }

    const areaText =
      $('areaText');

    if (areaText) {
      areaText.value =
        settings?.service_area_text ||
        'Pairline Mowing serves Port Huron, Michigan and surrounding areas. Contact us to ask whether your address is within our service area.';
    }

  } catch (error) {
    console.error(
      'Unexpected load error:',
      error
    );

    if (user) {
      setStatus(
        'settingsStatus',
        'Could not load all dashboard data: ' +
        (error.message || 'Unknown error'),
        false
      );
    }
  }
}

/* -----------------------------
   SERVICES
----------------------------- */

function renderServices(items) {
  const box =
    $('servicesEditor');

  if (!box) return;

  box.innerHTML =
    items.map((item, i) => `
      <div class="admin-card">

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
              value="${Number(
                item.sort_order || i + 1
              )}">
          </div>

          <div class="field full">
            <label>Description</label>

            <textarea
              data-service-description="${i}">${esc(
                item.description || ''
              )}</textarea>
          </div>

        </div>

      </div>
    `).join('');
}

function collectServices() {
  return [
    ...document.querySelectorAll(
      '[data-service-title]'
    )
  ]
    .map((input, i) => ({
      title:
        input.value.trim(),

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
  if (!sb || !user) {
    showLogin();
    return;
  }

  const services =
    collectServices();

  try {
    const {
      error: deleteError
    } = await sb
      .from('services')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      console.error(
        'Services delete error:',
        deleteError
      );

      setStatus(
        'servicesEditor',
        deleteError.message,
        false
      );

      return;
    }

    if (services.length) {
      const {
        error: insertError
      } = await sb
        .from('services')
        .insert(services);

      if (insertError) {
        console.error(
          'Services insert error:',
          insertError
        );

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

  } catch (error) {
    console.error(
      'Unexpected services save error:',
      error
    );

    setStatus(
      'servicesEditor',
      error.message || 'Could not save services.',
      false
    );
  }
}

/* -----------------------------
   GALLERY
----------------------------- */

const GALLERY_BUCKET =
  'SITE-IMAGES';

function renderGallery(items) {
  const box =
    $('galleryEditor');

  if (!box) return;

  box.innerHTML =
    items.map((item, i) => {

      const imageUrl =
        item.image_url ||
        item.url ||
        '';

      return `
        <div class="admin-card">

          <div class="admin-grid">

            <div class="field">
              <label>Title</label>

              <input
                data-gallery-title="${i}"
                value="${esc(
                  item.title || ''
                )}">
            </div>

            <div class="field">
              <label>Sort order</label>

              <input
                type="number"
                data-gallery-sort="${i}"
                value="${Number(
                  item.sort_order || i + 1
                )}">
            </div>

            <div class="field full">
              <label>Image</label>

              ${
                imageUrl
                  ? `
                    <div style="margin-bottom:10px;">
                      <img
                        src="${esc(imageUrl)}"
                        alt="${esc(
                          item.title ||
                          'Gallery image'
                        )}"
                        style="
                          display:block;
                          width:100%;
                          max-width:320px;
                          max-height:220px;
                          object-fit:cover;
                          border-radius:10px;
                        ">
                    </div>
                  `
                  : ''
              }

              <input
                type="file"
                accept="image/*"
                data-gallery-file="${i}">

              <input
                type="hidden"
                data-gallery-url="${i}"
                value="${esc(imageUrl)}">

              <button
                type="button"
                data-gallery-upload="${i}"
                style="margin-top:8px;">
                Upload Image
              </button>

              <div
                data-gallery-status="${i}"
                style="margin-top:6px;">
              </div>

            </div>

          </div>

        </div>
      `;
    }).join('');

  items.forEach((item, i) => {
    $(`galleryEditor`)
      ?.querySelector(
        `[data-gallery-upload="${i}"]`
      )
      ?.addEventListener(
        'click',
        () => uploadGalleryImage(i)
      );
  });
}

function collectGallery() {
  return [
    ...document.querySelectorAll(
      '[data-gallery-title]'
    )
  ]
    .map((input, i) => ({
      title:
        input.value.trim(),

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
}

async function uploadGalleryImage(index) {
  if (!sb || !user) {
    showLogin();
    return;
  }

  const fileInput =
    document.querySelector(
      `[data-gallery-file="${index}"]`
    );

  const status =
    document.querySelector(
      `[data-gallery-status="${index}"]`
    );

  if (!fileInput?.files?.length) {
    if (status) {
      status.textContent =
        'Choose an image first.';

      status.style.color =
        '#9d2c2c';
    }

    return;
  }

  const file =
    fileInput.files[0];

  if (!file.type.startsWith('image/')) {
    if (status) {
      status.textContent =
        'Please choose an image file.';

      status.style.color =
        '#9d2c2c';
    }

    return;
  }

  /*
    Basic file-size protection.
    10 MB maximum.
  */
  const MAX_FILE_SIZE =
    10 * 1024 * 1024;

  if (file.size > MAX_FILE_SIZE) {
    if (status) {
      status.textContent =
        'Image is too large. Maximum size is 10 MB.';

      status.style.color =
        '#9d2c2c';
    }

    return;
  }

  if (status) {
    status.textContent =
      'Uploading...';

    status.style.color = '';
  }

  try {
    const extension =
      file.name.includes('.')
        ? file.name
            .split('.')
            .pop()
            .toLowerCase()
        : 'jpg';

    const fileName =
      `gallery/${crypto.randomUUID()}.${extension}`;

    const {
      error: uploadError
    } = await sb.storage
      .from(GALLERY_BUCKET)
      .upload(
        fileName,
        file,
        {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        }
      );

    if (uploadError) {
      console.error(
        'Gallery upload error:',
        uploadError
      );

      if (status) {
        status.textContent =
          'Upload failed: ' +
          uploadError.message;

        status.style.color =
          '#9d2c2c';
      }

      return;
    }

    const {
      data
    } = sb.storage
      .from(GALLERY_BUCKET)
      .getPublicUrl(fileName);

    const publicUrl =
      data?.publicUrl || '';

    if (!publicUrl) {
      if (status) {
        status.textContent =
          'Upload worked, but the image URL could not be created.';

        status.style.color =
          '#9d2c2c';
      }

      return;
    }

    const urlInput =
      document.querySelector(
        `[data-gallery-url="${index}"]`
      );

    if (urlInput) {
      urlInput.value =
        publicUrl;
    }

    if (status) {
      status.textContent =
        'Image uploaded successfully.';

      status.style.color = '';
    }

    /*
      Update the preview without rebuilding
      the entire gallery editor.
    */
    const card =
      document.querySelector(
        `[data-gallery-file="${index}"]`
      )?.closest(
        '.admin-card'
      );

    if (card) {
      const oldPreview =
        card.querySelector('img');

      if (oldPreview) {
        oldPreview.src =
          publicUrl;

      } else {
        const preview =
          document.createElement('img');

        preview.src =
          publicUrl;

        preview.alt =
          'Gallery image';

        preview.style.display =
          'block';

        preview.style.width =
          '100%';

        preview.style.maxWidth =
          '320px';

        preview.style.maxHeight =
          '220px';

        preview.style.objectFit =
          'cover';

        preview.style.borderRadius =
          '10px';

        preview.style.marginBottom =
          '10px';

        const fileField =
          card.querySelector(
            `[data-gallery-file="${index}"]`
          );

        fileField?.parentElement
          ?.insertBefore(
            preview,
            fileField
          );
      }
    }

  } catch (error) {
    console.error(
      'Unexpected gallery upload error:',
      error
    );

    if (status) {
      status.textContent =
        'Upload error: ' +
        (error.message ||
          'Unknown error');

      status.style.color =
        '#9d2c2c';
    }
  }
}

async function saveGallery() {
  if (!sb || !user) {
    showLogin();
    return;
  }

  const items =
    collectGallery();

  try {
    const {
      error: deleteError
    } = await sb
      .from('gallery')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      console.error(
        'Gallery delete error:',
        deleteError
      );

      setStatus(
        'galleryEditor',
        deleteError.message,
        false
      );

      return;
    }

    if (items.length) {
      const {
        error: insertError
      } = await sb
        .from('gallery')
        .insert(items);

      if (insertError) {
        console.error(
          'Gallery insert error:',
          insertError
        );

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

  } catch (error) {
    console.error(
      'Unexpected gallery save error:',
      error
    );

    setStatus(
      'galleryEditor',
      error.message ||
      'Could not save gallery.',
      false
    );
  }
}

/* -----------------------------
   REVIEWS
----------------------------- */

function renderReviews(items) {
  const box =
    $('reviewsEditor');

  if (!box) return;

  if (!items.length) {
    box.innerHTML = `
      <div class="admin-card">
        <p>
          No reviews have been added yet.
        </p>
      </div>
    `;

    return;
  }

  box.innerHTML =
    items.map((item, i) => `
      <div class="admin-card">

        <div class="admin-grid">

          <div class="field">
            <label>Customer name</label>

            <input
              data-review-name="${i}"
              value="${esc(
                item.name || ''
              )}">
          </div>

          <div class="field">
            <label>Rating</label>

            <select
              data-review-rating="${i}">

              ${[1, 2, 3, 4, 5]
                .map(n => `
                  <option
                    value="${n}"
                    ${
                      Number(item.rating) === n
                        ? 'selected'
                        : ''
                    }>
                    ${n}
                  </option>
                `)
                .join('')}

            </select>
          </div>

          <div class="field full">
            <label>Review</label>

            <textarea
              data-review-text="${i}">${esc(
                item.text || ''
              )}</textarea>
          </div>

          <div class="field">
            <label>Sort order</label>

            <input
              type="number"
              data-review-sort="${i}"
              value="${Number(
                item.sort_order || i + 1
              )}">
          </div>

          <div class="field">
            <label>Published</label>

            <select
              data-review-published="${i}">

              <option
                value="true"
                ${
                  item.published !== false
                    ? 'selected'
                    : ''
                }>
                Yes
              </option>

              <option
                value="false"
                ${
                  item.published === false
                    ? 'selected'
                    : ''
                }>
                No
              </option>

            </select>
          </div>

        </div>

      </div>
    `).join('');
}

async function saveReviews() {
  if (!sb || !user) {
    showLogin();
    return;
  }

  const items = [
    ...document.querySelectorAll(
      '[data-review-name]'
    )
  ]
    .map((input, i) => ({
      name:
        input.value.trim(),

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

  try {
    const {
      error: deleteError
    } = await sb
      .from('reviews')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      console.error(
        'Reviews delete error:',
        deleteError
      );

      setStatus(
        'reviewsEditor',
        deleteError.message,
        false
      );

      return;
    }

    if (items.length) {
      const {
        error: insertError
      } = await sb
        .from('reviews')
        .insert(items);

      if (insertError) {
        console.error(
          'Reviews insert error:',
          insertError
        );

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

  } catch (error) {
    console.error(
      'Unexpected reviews save error:',
      error
    );

    setStatus(
      'reviewsEditor',
      error.message ||
      'Could not save reviews.',
      false
    );
  }
}

/* -----------------------------
   SITE SETTINGS
----------------------------- */

async function saveSettings() {
  if (!sb || !user) {
    showLogin();
    return;
  }

  const googleUrl =
    $('googleUrl')?.value.trim() || '';

  const leaveReviewUrl =
    $('leaveReviewUrl')?.value.trim() || '';

  const areaText =
    $('areaText')?.value.trim() || '';

  try {
    const {
      error
    } = await sb
      .from('site_settings')
      .upsert({
        id: 1,
        google_review_url:
          googleUrl,

        leave_review_url:
          leaveReviewUrl,

        service_area_text:
          areaText
      });

    if (error) {
      console.error(
        'Settings save error:',
        error
      );

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

  } catch (error) {
    console.error(
      'Unexpected settings save error:',
      error
    );

    setStatus(
      'settingsStatus',
      error.message ||
      'Could not save settings.',
      false
    );
  }
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
    if (!user) {
      showLogin();
      return;
    }

    const current =
      collectServices();

    current.push({
      title: '',
      description: '',
      sort_order:
        current.length + 1
    });

    renderServices(current);
  }
);

$('addGallery')?.addEventListener(
  'click',
  () => {
    if (!user) {
      showLogin();
      return;
    }

    const current = [
      ...document.querySelectorAll(
        '[data-gallery-title]'
      )
    ].map((input, i) => ({
      title:
        input.value,

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
      sort_order:
        current.length + 1
    });

    renderGallery(current);
  }
);

/* -----------------------------
   START
----------------------------- */

check();
