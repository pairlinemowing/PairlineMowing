const C = window.PAIRLINE_CONFIG || {};

let sb = null;
let user = null;

const GALLERY_BUCKET = 'SITE-IMAGES';

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
   DEFAULT SERVICES
----------------------------- */

const defaultServices = [
  {
    title: 'Lawn Mowing',
    description:
      'Professional lawn mowing to keep your property looking clean and maintained.'
  },
  {
    title: 'Edging',
    description:
      'Clean, sharp edging around sidewalks, driveways, and lawn borders.'
  },
  {
    title: 'Weed Whacking',
    description:
      'Trim hard-to-reach grass and weeds for a neat finished look.'
  },
  {
    title: 'Gutter Cleaning',
    description:
      'Remove leaves, dirt, and debris from your gutters to help keep water flowing properly.'
  },
  {
    title: 'Equipment Repairs',
    description:
      'Lawn-mower, whipper, and other outdoor equipment repair services.'
  }
];

const defaultReviews = [];

/* -----------------------------
   SCREEN CONTROL
----------------------------- */

function showLogin() {
  const login = $('loginScreen');
  const setup = $('setupScreen');
  const dashboard = $('dashboardScreen');

  if (login) login.style.display = '';
  if (setup) setup.style.display = 'none';
  if (dashboard) dashboard.style.display = 'none';
}

function showSetup() {
  const login = $('loginScreen');
  const setup = $('setupScreen');
  const dashboard = $('dashboardScreen');

  if (login) login.style.display = 'none';
  if (setup) setup.style.display = '';
  if (dashboard) dashboard.style.display = 'none';
}

function showDashboard() {
  const login = $('loginScreen');
  const setup = $('setupScreen');
  const dashboard = $('dashboardScreen');

  if (login) login.style.display = 'none';
  if (setup) setup.style.display = 'none';
  if (dashboard) dashboard.style.display = '';
}

function setStatus(message = '', type = '') {
  const el = $('status');

  if (!el) return;

  el.textContent = message;
  el.className = type ? `status ${type}` : 'status';
}

/* -----------------------------
   SUPABASE
----------------------------- */

function initializeSupabase() {
  if (!window.supabase) {
    setStatus(
      'Supabase library could not be loaded.',
      'error'
    );
    return false;
  }

  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) {
    setStatus(
      'Supabase is not configured.',
      'error'
    );
    return false;
  }

  sb = window.supabase.createClient(
    C.SUPABASE_URL,
    C.SUPABASE_ANON_KEY
  );

  return true;
}

/* -----------------------------
   OWNER CHECK
----------------------------- */

function isOwner(u) {
  if (!u?.email || !C.OWNER_EMAIL) {
    return false;
  }

  return (
    u.email.trim().toLowerCase() ===
    C.OWNER_EMAIL.trim().toLowerCase()
  );
}

/* =========================================================
   LOGIN
   =========================================================
   
   CORRECT ADMIN CREDENTIALS:
   SIGN IN -> DASHBOARD

   WRONG CREDENTIALS:
   "Incorrect admin login."
========================================================= */

async function signIn() {
  if (!sb) {
    if (!initializeSupabase()) {
      return;
    }
  }

  const emailInput = $('email');
  const passwordInput = $('password');

  const email =
    emailInput?.value.trim() || '';

  const password =
    passwordInput?.value || '';

  if (!email || !password) {
    setStatus(
      'Incorrect admin login.',
      'error'
    );
    return;
  }

  setStatus('Signing in...');

  try {
    /*
      Supabase checks the actual email/password.
    */
    const { data, error } =
      await sb.auth.signInWithPassword({
        email,
        password
      });

    /*
      Wrong Supabase credentials.
    */
    if (error || !data?.user) {
      console.error(
        'Admin login failed:',
        error
      );

      setStatus(
        'Incorrect admin login.',
        'error'
      );

      return;
    }

    const signedInUser = data.user;

    /*
      Credentials were valid, but make sure
      this is the configured admin account.
    */
    if (!isOwner(signedInUser)) {
      await sb.auth.signOut();

      user = null;

      showLogin();

      setStatus(
        'Incorrect admin login.',
        'error'
      );

      return;
    }

    /*
      SUCCESS.
      This is the important part:
      authenticated owner -> dashboard.
    */
    user = signedInUser;

    showDashboard();

    setStatus('');

    await loadAll();

  } catch (err) {
    console.error(
      'Unexpected login error:',
      err
    );

    setStatus(
      'Incorrect admin login.',
      'error'
    );
  }
}

/* -----------------------------
   SIGN OUT
----------------------------- */

async function signOut() {
  if (sb) {
    await sb.auth.signOut();
  }

  user = null;

  showLogin();

  const passwordInput =
    $('password');

  if (passwordInput) {
    passwordInput.value = '';
  }

  setStatus('');
}

/* -----------------------------
   SERVICES
----------------------------- */

function renderServices(items = []) {
  const container =
    $('servicesList');

  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        No services have been added yet.
      </div>
    `;

    return;
  }

  container.innerHTML = items
    .map(
      (item, index) => `
        <div
          class="admin-card service-card"
          data-index="${index}"
        >

          <label>
            Service Title
            <input
              class="service-title"
              type="text"
              value="${esc(item.title || '')}"
            >
          </label>

          <label>
            Description
            <textarea
              class="service-description"
            >${esc(item.description || '')}</textarea>
          </label>

          <button
            type="button"
            class="danger delete-service"
          >
            Delete Service
          </button>

        </div>
      `
    )
    .join('');

  attachServiceDeleteButtons();
}

function attachServiceDeleteButtons() {
  document
    .querySelectorAll('.delete-service')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          const card =
            button.closest('.service-card');

          if (card) {
            card.remove();
          }
        }
      );
    });
}

function collectServices() {
  return [
    ...document.querySelectorAll(
      '.service-card'
    )
  ]
    .map(card => ({
      title:
        card
          .querySelector('.service-title')
          ?.value.trim() || '',

      description:
        card
          .querySelector('.service-description')
          ?.value.trim() || ''
    }))
    .filter(item => item.title);
}

async function saveServices() {
  if (!user || !isOwner(user)) {
    setStatus(
      'Incorrect admin login.',
      'error'
    );
    return;
  }

  const services =
    collectServices();

  setStatus(
    'Saving services...'
  );

  const {
    error: deleteError
  } = await sb
    .from('services')
    .delete()
    .neq('id', 0);

  if (deleteError) {
    console.error(deleteError);

    setStatus(
      `Could not save services: ${deleteError.message}`,
      'error'
    );

    return;
  }

  if (services.length) {
    const { error } =
      await sb
        .from('services')
        .insert(services);

    if (error) {
      console.error(error);

      setStatus(
        `Could not save services: ${error.message}`,
        'error'
      );

      return;
    }
  }

  setStatus(
    'Services saved successfully.',
    'success'
  );

  await loadAll();
}

function addService() {
  const container =
    $('servicesList');

  if (!container) return;

  const card =
    document.createElement('div');

  card.className =
    'admin-card service-card';

  card.innerHTML = `
    <label>
      Service Title
      <input
        class="service-title"
        type="text"
        placeholder="Service name"
      >
    </label>

    <label>
      Description
      <textarea
        class="service-description"
        placeholder="Service description"
      ></textarea>
    </label>

    <button
      type="button"
      class="danger delete-service"
    >
      Delete Service
    </button>
  `;

  container.appendChild(card);

  card
    .querySelector('.delete-service')
    ?.addEventListener(
      'click',
      () => card.remove()
    );
}

/* -----------------------------
   GALLERY
----------------------------- */

function createGalleryFileName(file) {
  const originalName =
    file?.name || 'image';

  const extension =
    originalName.includes('.')
      ? originalName
          .split('.')
          .pop()
          .toLowerCase()
      : 'jpg';

  return `gallery/${crypto.randomUUID()}.${extension}`;
}

function renderGallery(items = []) {
  const container =
    $('galleryList');

  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        No Our Work photos have been added yet.
      </div>

      <button
        type="button"
        id="emptyAddGallery"
      >
        Add Photo
      </button>
    `;

    $('emptyAddGallery')
      ?.addEventListener(
        'click',
        addGallery
      );

    return;
  }

  container.innerHTML = items
    .map(
      (item, index) => `
        <div
          class="admin-card gallery-card"
          data-index="${index}"
        >

          <label>
            Photo Title
            <input
              class="gallery-title"
              type="text"
              value="${esc(item.title || '')}"
              placeholder="Example: Front Yard Mowing"
            >
          </label>

          <label>
            Sort Order
            <input
              class="gallery-sort"
              type="number"
              value="${Number(
                item.sort_order || index + 1
              )}"
            >
          </label>

          <div class="gallery-preview">
            ${
              item.image_url
                ? `
                  <img
                    src="${esc(item.image_url)}"
                    alt="${esc(
                      item.title || 'Our Work'
                    )}"
                  >
                `
                : `
                  <div class="empty-preview">
                    No photo selected
                  </div>
                `
            }
          </div>

          <input
            class="gallery-file"
            type="file"
            accept="image/*"
          >

          <input
            class="gallery-url"
            type="hidden"
            value="${esc(
              item.image_url || ''
            )}"
          >

          <div class="gallery-actions">

            <button
              type="button"
              class="upload-gallery"
              data-index="${index}"
            >
              ${
                item.image_url
                  ? 'Replace Photo'
                  : 'Upload Photo'
              }
            </button>

            <button
              type="button"
              class="danger delete-gallery"
              data-index="${index}"
            >
              Delete Photo
            </button>

          </div>

          <div class="gallery-status"></div>

        </div>
      `
    )
    .join('');

  attachGalleryButtons();
}

function attachGalleryButtons() {
  document
    .querySelectorAll('.upload-gallery')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          uploadGalleryImage(
            Number(button.dataset.index)
          );
        }
      );
    });

  document
    .querySelectorAll('.delete-gallery')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          deleteGalleryImage(
            Number(button.dataset.index)
          );
        }
      );
    });
}

function addGallery() {
  const container =
    $('galleryList');

  if (!container) return;

  const card =
    document.createElement('div');

  card.className =
    'admin-card gallery-card';

  card.innerHTML = `
    <label>
      Photo Title
      <input
        class="gallery-title"
        type="text"
        placeholder="Example: Front Yard Mowing"
      >
    </label>

    <label>
      Sort Order
      <input
        class="gallery-sort"
        type="number"
        value="1"
      >
    </label>

    <div class="gallery-preview">
      <div class="empty-preview">
        No photo selected
      </div>
    </div>

    <input
      class="gallery-file"
      type="file"
      accept="image/*"
    >

    <input
      class="gallery-url"
      type="hidden"
      value=""
    >

    <div class="gallery-actions">

      <button
        type="button"
        class="upload-gallery"
      >
        Upload Photo
      </button>

      <button
        type="button"
        class="danger delete-gallery"
      >
        Delete Photo
      </button>

    </div>

    <div class="gallery-status"></div>
  `;

  container.appendChild(card);

  card
    .querySelector('.upload-gallery')
    ?.addEventListener(
      'click',
      () => {
        const cards = [
          ...document.querySelectorAll(
            '.gallery-card'
          )
        ];

        uploadGalleryImage(
          cards.indexOf(card)
        );
      }
    );

  card
    .querySelector('.delete-gallery')
    ?.addEventListener(
      'click',
      () => card.remove()
    );
}

function collectGallery() {
  return [
    ...document.querySelectorAll(
      '.gallery-card'
    )
  ]
    .map((card, index) => ({
      title:
        card
          .querySelector('.gallery-title')
          ?.value.trim() || '',

      image_url:
        card
          .querySelector('.gallery-url')
          ?.value.trim() || '',

      sort_order:
        Number(
          card
            .querySelector('.gallery-sort')
            ?.value
        ) || index + 1
    }))
    .filter(item => item.image_url);
}

function getStoragePathFromPublicUrl(url) {
  if (!url) return null;

  const marker =
    `/storage/v1/object/public/${GALLERY_BUCKET}/`;

  const index =
    url.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(
    url.substring(
      index + marker.length
    )
  );
}

async function uploadGalleryImage(index) {
  if (!user || !isOwner(user)) {
    setStatus(
      'Incorrect admin login.',
      'error'
    );
    return;
  }

  const cards = [
    ...document.querySelectorAll(
      '.gallery-card'
    )
  ];

  const card = cards[index];

  if (!card) return;

  const fileInput =
    card.querySelector(
      '.gallery-file'
    );

  const urlInput =
    card.querySelector(
      '.gallery-url'
    );

  const preview =
    card.querySelector(
      '.gallery-preview'
    );

  const status =
    card.querySelector(
      '.gallery-status'
    );

  const file =
    fileInput?.files?.[0];

  if (!file) {
    if (status) {
      status.textContent =
        'Choose a photo first.';
    }

    return;
  }

  if (!file.type.startsWith('image/')) {
    if (status) {
      status.textContent =
        'Please select an image file.';
    }

    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    if (status) {
      status.textContent =
        'Image must be 10 MB or smaller.';
    }

    return;
  }

  if (status) {
    status.textContent =
      'Uploading photo...';
  }

  const oldUrl =
    urlInput?.value.trim() || '';

  const filePath =
    createGalleryFileName(file);

  const {
    error: uploadError
  } = await sb.storage
    .from(GALLERY_BUCKET)
    .upload(
      filePath,
      file,
      {
        cacheControl: '3600',
        upsert: false
      }
    );

  if (uploadError) {
    console.error(
      uploadError
    );

    if (status) {
      status.textContent =
        `Upload failed: ${uploadError.message}`;
    }

    return;
  }

  const {
    data: publicData
  } = sb.storage
    .from(GALLERY_BUCKET)
    .getPublicUrl(filePath);

  const publicUrl =
    publicData?.publicUrl || '';

  if (!publicUrl) {
    if (status) {
      status.textContent =
        'Photo uploaded, but its public URL could not be created.';
    }

    return;
  }

  if (urlInput) {
    urlInput.value =
      publicUrl;
  }

  if (preview) {
    preview.innerHTML = `
      <img
        src="${esc(publicUrl)}"
        alt="Our Work photo"
      >
    `;
  }

  if (oldUrl) {
    const oldPath =
      getStoragePathFromPublicUrl(
        oldUrl
      );

    if (oldPath) {
      await sb.storage
        .from(GALLERY_BUCKET)
        .remove([oldPath]);
    }
  }

  if (status) {
    status.textContent =
      'Photo uploaded. Click Save Gallery to publish the change.';
  }
}

async function deleteGalleryImage(index) {
  if (!user || !isOwner(user)) {
    setStatus(
      'Incorrect admin login.',
      'error'
    );
    return;
  }

  const cards = [
    ...document.querySelectorAll(
      '.gallery-card'
    )
  ];

  const card = cards[index];

  if (!card) return;

  const title =
    card
      .querySelector('.gallery-title')
      ?.value.trim() ||
    'this photo';

  if (
    !confirm(
      `Delete "${title}"? This cannot be undone.`
    )
  ) {
    return;
  }

  const imageUrl =
    card
      .querySelector('.gallery-url')
      ?.value.trim() || '';

  const storagePath =
    getStoragePathFromPublicUrl(
      imageUrl
    );

  if (storagePath) {
    const { error } =
      await sb.storage
        .from(GALLERY_BUCKET)
        .remove([
          storagePath
        ]);

    if (error) {
      console.error(
        'Storage delete error:',
        error
      );
    }
  }

  if (imageUrl) {
    const { error } =
      await sb
        .from('gallery')
        .delete()
        .eq(
          'image_url',
          imageUrl
        );

    if (error) {
      console.error(error);

      setStatus(
        `Photo file deleted, but database removal failed: ${error.message}`,
        'error'
      );

      return;
    }
  }

  card.remove();

  setStatus(
    'Photo deleted.',
    'success'
  );
}

async function saveGallery() {
  if (!user || !isOwner(user)) {
    setStatus(
      'Incorrect admin login.',
      'error'
    );
    return;
  }

  const gallery =
    collectGallery();

  setStatus(
    'Saving gallery...'
  );

  const {
    error: deleteError
  } = await sb
    .from('gallery')
    .delete()
    .neq('id', 0);

  if (deleteError) {
    console.error(
      deleteError
    );

    setStatus(
      `Could not save gallery: ${deleteError.message}`,
      'error'
    );

    return;
  }

  if (gallery.length) {
    const { error } =
      await sb
        .from('gallery')
        .insert(gallery);

    if (error) {
      console.error(error);

      setStatus(
        `Could not save gallery: ${error.message}`,
        'error'
      );

      return;
    }
  }

  setStatus(
    'Gallery saved successfully.',
    'success'
  );

  await loadAll();
}

/* -----------------------------
   REVIEWS
----------------------------- */

function renderReviews(items = []) {
  const container =
    $('reviewsList');

  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        No reviews have been added yet.
      </div>
    `;

    return;
  }

  container.innerHTML = items
    .map(
      item => `
        <div
          class="admin-card review-card"
        >

          <label>
            Customer Name
            <input
              class="review-name"
              type="text"
              value="${esc(item.name || '')}"
            >
          </label>

          <label>
            Review
            <textarea
              class="review-text"
            >${esc(item.review || '')}</textarea>
          </label>

          <label>
            Rating
            <input
              class="review-rating"
              type="number"
              min="1"
              max="5"
              value="${Number(
                item.rating || 5
              )}"
            >
          </label>

          <button
            type="button"
            class="danger delete-review"
          >
            Delete Review
          </button>

        </div>
      `
    )
    .join('');

  attachReviewDeleteButtons();
}

function attachReviewDeleteButtons() {
  document
    .querySelectorAll('.delete-review')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          const card =
            button.closest(
              '.review-card'
            );

          if (card) {
            card.remove();
          }
        }
      );
    });
}

function collectReviews() {
  return [
    ...document.querySelectorAll(
      '.review-card'
    )
  ]
    .map(card => ({
      name:
        card
          .querySelector('.review-name')
          ?.value.trim() || '',

      review:
        card
          .querySelector('.review-text')
          ?.value.trim() || '',

      rating:
        Number(
          card
            .querySelector('.review-rating')
            ?.value
        ) || 5
    }))
    .filter(
      item =>
        item.name &&
        item.review
    );
}

async function saveReviews() {
  if (!user || !isOwner(user)) {
    setStatus(
      'Incorrect admin login.',
      'error'
    );
    return;
  }

  const reviews =
    collectReviews();

  setStatus(
    'Saving reviews...'
  );

  const {
    error: deleteError
  } = await sb
    .from('reviews')
    .delete()
    .neq('id', 0);

  if (deleteError) {
    console.error(
      deleteError
    );

    setStatus(
      `Could not save reviews: ${deleteError.message}`,
      'error'
    );

    return;
  }

  if (reviews.length) {
    const { error } =
      await sb
        .from('reviews')
        .insert(reviews);

    if (error) {
      console.error(error);

      setStatus(
        `Could not save reviews: ${error.message}`,
        'error'
      );

      return;
    }
  }

  setStatus(
    'Reviews saved successfully.',
    'success'
  );

  await loadAll();
}

function addReview() {
  const container =
    $('reviewsList');

  if (!container) return;

  const card =
    document.createElement('div');

  card.className =
    'admin-card review-card';

  card.innerHTML = `
    <label>
      Customer Name
      <input
        class="review-name"
        type="text"
        placeholder="Customer name"
      >
    </label>

    <label>
      Review
      <textarea
        class="review-text"
        placeholder="Customer review"
      ></textarea>
    </label>

    <label>
      Rating
      <input
        class="review-rating"
        type="number"
        min="1"
        max="5"
        value="5"
      >
    </label>

    <button
      type="button"
      class="danger delete-review"
    >
      Delete Review
    </button>
  `;

  container.appendChild(card);

  card
    .querySelector('.delete-review')
    ?.addEventListener(
      'click',
      () => card.remove()
    );
}

/* -----------------------------
   SITE SETTINGS
----------------------------- */

function renderSettings(settings = {}) {
  const googleReviewUrl =
    $('googleReviewUrl');

  const leaveReviewUrl =
    $('leaveReviewUrl');

  const serviceAreaText =
    $('serviceAreaText');

  if (googleReviewUrl) {
    googleReviewUrl.value =
      settings.google_review_url || '';
  }

  if (leaveReviewUrl) {
    leaveReviewUrl.value =
      settings.leave_review_url || '';
  }

  if (serviceAreaText) {
    serviceAreaText.value =
      settings.service_area_text || '';
  }
}

async function saveSettings() {
  if (!user || !isOwner(user)) {
    setStatus(
      'Incorrect admin login.',
      'error'
    );
    return;
  }

  const settings = {
    id: 1,

    google_review_url:
      $('googleReviewUrl')
        ?.value.trim() || '',

    leave_review_url:
      $('leaveReviewUrl')
        ?.value.trim() || '',

    service_area_text:
      $('serviceAreaText')
        ?.value.trim() || ''
  };

  setStatus(
    'Saving site settings...'
  );

  const { error } =
    await sb
      .from('site_settings')
      .upsert(settings);

  if (error) {
    console.error(error);

    setStatus(
      `Could not save settings: ${error.message}`,
      'error'
    );

    return;
  }

  setStatus(
    'Site settings saved successfully.',
    'success'
  );
}

/* -----------------------------
   LOAD EVERYTHING
----------------------------- */

async function loadAll() {
  if (!sb || !user || !isOwner(user)) {
    return;
  }

  const [
    servicesResult,
    galleryResult,
    reviewsResult,
    settingsResult
  ] = await Promise.all([
    sb
      .from('services')
      .select('*')
      .order('id', {
        ascending: true
      }),

    sb
      .from('gallery')
      .select('*')
      .order('sort_order', {
        ascending: true
      }),

    sb
      .from('reviews')
      .select('*')
      .order('id', {
        ascending: true
      }),

    sb
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
  ]);

  if (servicesResult.error) {
    console.error(
      'Services:',
      servicesResult.error
    );
  }

  if (galleryResult.error) {
    console.error(
      'Gallery:',
      galleryResult.error
    );
  }

  if (reviewsResult.error) {
    console.error(
      'Reviews:',
      reviewsResult.error
    );
  }

  if (settingsResult.error) {
    console.error(
      'Settings:',
      settingsResult.error
    );
  }

  /*
    Existing Supabase information is loaded first.
    Defaults are only used if there are no services.
  */

  const services =
    servicesResult.data?.length
      ? servicesResult.data
      : defaultServices;

  const gallery =
    galleryResult.data || [];

  const reviews =
    reviewsResult.data || [];

  const settings =
    settingsResult.data || {};

  renderServices(
    services
  );

  renderGallery(
    gallery
  );

  renderReviews(
    reviews
  );

  renderSettings(
    settings
  );
}

/* -----------------------------
   EVENT LISTENERS
----------------------------- */

function setupEventListeners() {

  /*
    Login button.
  */
  $('signInBtn')
    ?.addEventListener(
      'click',
      event => {
        event.preventDefault();
        signIn();
      }
    );

  /*
    Login form.
    This also makes pressing Enter work.
  */
  $('loginForm')
    ?.addEventListener(
      'submit',
      event => {
        event.preventDefault();
        signIn();
      }
    );

  $('password')
    ?.addEventListener(
      'keydown',
      event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          signIn();
        }
      }
    );

  $('signOutBtn')
    ?.addEventListener(
      'click',
      signOut
    );

  $('saveServices')
    ?.addEventListener(
      'click',
      saveServices
    );

  $('addService')
    ?.addEventListener(
      'click',
      addService
    );

  $('saveGallery')
    ?.addEventListener(
      'click',
      saveGallery
    );

  $('addGallery')
    ?.addEventListener(
      'click',
      addGallery
    );

  $('saveReviews')
    ?.addEventListener(
      'click',
      saveReviews
    );

  $('addReview')
    ?.addEventListener(
      'click',
      addReview
    );

  $('saveSettings')
    ?.addEventListener(
      'click',
      saveSettings
    );
}

/* -----------------------------
   AUTH STATE
----------------------------- */

function setupAuthListener() {
  if (!sb) return;

  sb.auth.onAuthStateChange(
    (event, session) => {

      if (event === 'SIGNED_OUT') {
        user = null;
        showLogin();
        return;
      }

      if (!session?.user) {
        return;
      }

      /*
        Valid owner session.
      */
      if (isOwner(session.user)) {
        user = session.user;
        showDashboard();
        return;
      }

      /*
        Not the owner.
      */
      sb.auth.signOut();

      user = null;

      showLogin();

      setStatus(
        'Incorrect admin login.',
        'error'
      );
    }
  );
}

/* -----------------------------
   CHECK EXISTING LOGIN
----------------------------- */

async function check() {
  if (!sb) {
    if (!initializeSupabase()) {
      return;
    }
  }

  const {
    data,
    error
  } = await sb.auth.getSession();

  if (error) {
    console.error(
      'Session error:',
      error
    );

    showLogin();

    return;
  }

  const session =
    data?.session;

  /*
    No existing login.
    Show login page.
  */
  if (!session?.user) {
    user = null;
    showLogin();
    return;
  }

  /*
    Existing authenticated owner.
    Go directly to dashboard.
  */
  if (isOwner(session.user)) {
    user = session.user;

    showDashboard();

    await loadAll();

    return;
  }

  /*
    Logged into Supabase but not
    the configured admin account.
  */
  await sb.auth.signOut();

  user = null;

  showLogin();

  setStatus(
    'Incorrect admin login.',
    'error'
  );
}

/* -----------------------------
   START ADMIN PAGE
----------------------------- */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    /*
      Always begin on login screen
      until an existing owner session
      is confirmed.
    */
    showLogin();

    setupEventListeners();

    if (!initializeSupabase()) {
      showSetup();
      return;
    }

    setupAuthListener();

    await check();
  }
);
