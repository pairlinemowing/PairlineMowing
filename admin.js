alert("ADMIN JS LOADED");

const C = window.PAIRLINE_CONFIG || {};

let sb = null;
let user = null;

const $ = id => document.getElementById(id);

const GALLERY_BUCKET = 'SITE-IMAGES';

const defaultServices = [
  {
    title: 'Lawn Mowing',
    description: 'Professional lawn mowing to keep your property clean, healthy, and looking its best.'
  },
  {
    title: 'Edging',
    description: 'Clean, defined edges around sidewalks, driveways, and lawn borders.'
  },
  {
    title: 'Weed Whacking',
    description: 'Detailed trimming around fences, buildings, landscaping, and hard-to-reach areas.'
  },
  {
    title: 'Gutter Cleaning',
    description: 'Removal of leaves, dirt, and debris from residential gutters.'
  },
  {
    title: 'Equipment Repairs',
    description: 'Lawn-mower, whipper, and small equipment repair services.'
  }
];

const defaultReviews = [];


/* -------------------------------------------------
   HELPERS
------------------------------------------------- */

function esc(v = '') {
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(message = '', type = '') {
  const el = $('loginStatus');

  if (!el) return;

  el.textContent = message;

  if (type === 'error') {
    el.style.color = '#9d2c2c';
    el.style.fontWeight = '800';
  } else if (type === 'success') {
    el.style.color = '#287719';
    el.style.fontWeight = '800';
  } else {
    el.style.color = '';
    el.style.fontWeight = '';
  }
}

function setSectionStatus(id, message = '', type = '') {
  const el = $(id);

  if (!el) return;

  el.textContent = message;

  if (type === 'error') {
    el.style.color = '#9d2c2c';
    el.style.fontWeight = '800';
  } else if (type === 'success') {
    el.style.color = '#287719';
    el.style.fontWeight = '800';
  } else {
    el.style.color = '';
    el.style.fontWeight = '';
  }
}


/* -------------------------------------------------
   SCREEN CONTROL
------------------------------------------------- */

function showLogin() {
  if ($('login')) $('login').hidden = false;
  if ($('setupNotice')) $('setupNotice').hidden = true;
  if ($('dashboard')) $('dashboard').hidden = true;
}

function showSetup() {
  if ($('login')) $('login').hidden = true;
  if ($('setupNotice')) $('setupNotice').hidden = false;
  if ($('dashboard')) $('dashboard').hidden = true;
}

function showDashboard() {
  if ($('login')) $('login').hidden = true;
  if ($('setupNotice')) $('setupNotice').hidden = true;
  if ($('dashboard')) $('dashboard').hidden = false;
}


/* -------------------------------------------------
   OWNER CHECK
------------------------------------------------- */

function isOwner(currentUser) {
  if (!currentUser) return false;

  const ownerEmail = String(C.OWNER_EMAIL || '')
    .trim()
    .toLowerCase();

  const userEmail = String(currentUser.email || '')
    .trim()
    .toLowerCase();

  return !!ownerEmail && !!userEmail && ownerEmail === userEmail;
}


/* -------------------------------------------------
   SUPABASE
------------------------------------------------- */

function initializeSupabase() {
  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) {
    return false;
  }

  if (!window.supabase || !window.supabase.createClient) {
    return false;
  }

  sb = window.supabase.createClient(
    C.SUPABASE_URL,
    C.SUPABASE_ANON_KEY
  );

  return true;
}


/* -------------------------------------------------
   LOGIN
------------------------------------------------- */

async function signIn() {
  if (!sb) {
    setStatus('Supabase is not configured.', 'error');
    return;
  }

  const emailEl = $('emailInput');
  const passwordEl = $('passwordInput');

  if (!emailEl || !passwordEl) {
    setStatus('Login fields could not be found.', 'error');
    return;
  }

  const email = emailEl.value.trim();
  const password = passwordEl.value;

  if (!email || !password) {
    setStatus('Enter your owner email and password.', 'error');
    return;
  }

  setStatus('Signing in...');

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error(error);
      setStatus('Incorrect admin login.', 'error');
      return;
    }

    const signedInUser = data?.user;

    if (!signedInUser) {
      setStatus('Sign-in failed.', 'error');
      return;
    }

    if (!isOwner(signedInUser)) {
      await sb.auth.signOut();
      user = null;
      setStatus('This account is not authorized to access the owner dashboard.', 'error');
      return;
    }

    user = signedInUser;

    setStatus('');
    showDashboard();

    await loadAll();

  } catch (err) {
    console.error(err);
    setStatus('Unable to sign in. Please try again.', 'error');
  }
}


/* -------------------------------------------------
   SIGN OUT
------------------------------------------------- */

async function signOut() {
  if (!sb) return;

  try {
    await sb.auth.signOut();
  } catch (err) {
    console.error(err);
  }

  user = null;
  showLogin();

  if ($('passwordInput')) {
    $('passwordInput').value = '';
  }

  setStatus('');
}


/* -------------------------------------------------
   SERVICES
------------------------------------------------- */

function renderServices(items) {
  const editor = $('servicesEditor');

  if (!editor) return;

  if (!items.length) {
    editor.innerHTML = `
      <div class="muted">
        No services have been added yet.
      </div>
    `;
    return;
  }

  editor.innerHTML = items.map((item, index) => `
    <div class="list-item service-item" data-index="${index}">

      <div class="admin-grid">

        <div class="field">
          <label>Service name</label>
          <input
            class="service-title"
            type="text"
            value="${esc(item.title || '')}"
            placeholder="Service name">
        </div>

        <div class="field">
          <label>Description</label>
          <input
            class="service-description"
            type="text"
            value="${esc(item.description || '')}"
            placeholder="Service description">
        </div>

      </div>

      <div class="admin-actions">
        <button
          type="button"
          class="admin-btn danger delete-service">
          Delete service
        </button>
      </div>

    </div>
  `).join('');

  editor.querySelectorAll('.delete-service').forEach(button => {
    button.addEventListener('click', () => {
      const item = button.closest('.service-item');

      if (!item) return;

      item.remove();

      if (!editor.querySelector('.service-item')) {
        renderServices([]);
      }
    });
  });
}

function collectServices() {
  const items = [];

  document.querySelectorAll('.service-item').forEach(item => {
    const title = item.querySelector('.service-title')?.value.trim() || '';
    const description = item.querySelector('.service-description')?.value.trim() || '';

    if (!title) return;

    items.push({
      title,
      description
    });
  });

  return items;
}

function addService() {
  const editor = $('servicesEditor');

  if (!editor) return;

  const current = collectServices();

  current.push({
    title: '',
    description: ''
  });

  renderServices(current);

  const inputs = editor.querySelectorAll('.service-title');

  if (inputs.length) {
    inputs[inputs.length - 1].focus();
  }
}

async function saveServices() {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You must be signed in as the owner.', 'error');
    return;
  }

  const services = collectServices();

  try {
    setStatus('Saving services...');

    const { error: deleteError } = await sb
      .from('services')
      .delete()
      .neq('id', 0);

    if (deleteError) throw deleteError;

    if (services.length) {
      const { error: insertError } = await sb
        .from('services')
        .insert(services);

      if (insertError) throw insertError;
    }

    setStatus('Services saved.', 'success');

    await loadServices();

  } catch (err) {
    console.error(err);
    setStatus(
      `Could not save services: ${err.message || 'Unknown error'}`,
      'error'
    );
  }
}

async function loadServices() {
  const { data, error } = await sb
    .from('services')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error(error);
    renderServices(defaultServices);
    return;
  }

  if (data && data.length) {
    renderServices(data);
  } else {
    renderServices(defaultServices);
  }
}


/* -------------------------------------------------
   GALLERY
------------------------------------------------- */

function createGalleryFileName(file) {
  const original = file.name || 'photo';
  const extension = original.includes('.')
    ? original.split('.').pop().toLowerCase()
    : 'jpg';

  return `gallery/${crypto.randomUUID()}.${extension}`;
}

function getStoragePathFromPublicUrl(url) {
  if (!url) return null;

  const marker = `/storage/v1/object/public/${GALLERY_BUCKET}/`;

  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(
    url.substring(index + marker.length)
  );
}

function renderGallery(items) {
  const editor = $('galleryEditor');

  if (!editor) return;

  if (!items.length) {
    editor.innerHTML = `
      <div class="muted">
        No Our Work photos have been added yet.
      </div>
    `;
    return;
  }

  editor.innerHTML = items.map((item, index) => `
    <div
      class="list-item gallery-item"
      data-index="${index}"
      data-existing-id="${esc(item.id || '')}">

      <div class="admin-grid">

        <div class="field">
          <label>Photo title</label>
          <input
            class="gallery-title"
            type="text"
            value="${esc(item.title || '')}"
            placeholder="Example: Backyard cleanup">
        </div>

        <div class="field">
          <label>Sort order</label>
          <input
            class="gallery-sort"
            type="number"
            value="${esc(item.sort_order ?? index)}"
            min="0">
        </div>

        <div class="field full">
          <label>Current photo</label>

          <div>
            ${
              item.image_url
                ? `
                  <img
                    class="gallery-preview"
                    src="${esc(item.image_url)}"
                    alt="${esc(item.title || 'Our Work photo')}"
                    style="
                      display:block;
                      width:100%;
                      max-width:500px;
                      max-height:300px;
                      object-fit:cover;
                      border-radius:6px;
                      margin-bottom:10px;
                      border:1px solid #d6ddd4;
                    ">
                `
                : `
                  <div class="muted">
                    No photo uploaded yet.
                  </div>
                `
            }
          </div>
        </div>

        <div class="field full">
          <label>Upload photo</label>

          <input
            class="gallery-file"
            type="file"
            accept="image/*">

          <input
            class="gallery-url"
            type="hidden"
            value="${esc(item.image_url || '')}">
        </div>

      </div>

      <div class="admin-actions">

        <button
          type="button"
          class="admin-btn upload-gallery">
          Upload / Replace Photo
        </button>

        <button
          type="button"
          class="admin-btn danger delete-gallery">
          Delete Photo
        </button>

      </div>

      <div class="gallery-status muted" style="margin-top:10px"></div>

    </div>
  `).join('');

  editor.querySelectorAll('.upload-gallery').forEach(button => {
    button.addEventListener('click', () => {
      const item = button.closest('.gallery-item');

      if (!item) return;

      const index = [...editor.querySelectorAll('.gallery-item')]
        .indexOf(item);

      uploadGalleryImage(index);
    });
  });

  editor.querySelectorAll('.delete-gallery').forEach(button => {
    button.addEventListener('click', () => {
      const item = button.closest('.gallery-item');

      if (!item) return;

      const index = [...editor.querySelectorAll('.gallery-item')]
        .indexOf(item);

      deleteGalleryImage(index);
    });
  });
}

function collectGallery() {
  const items = [];

  document.querySelectorAll('.gallery-item').forEach(item => {
    const title = item.querySelector('.gallery-title')?.value.trim() || '';
    const image_url = item.querySelector('.gallery-url')?.value.trim() || '';
    const sort_order = Number(
      item.querySelector('.gallery-sort')?.value || 0
    );

    if (!image_url) return;

    items.push({
      title,
      image_url,
      sort_order
    });
  });

  return items;
}

function addGallery() {
  const editor = $('galleryEditor');

  if (!editor) return;

  const current = collectGallery();

  current.push({
    title: '',
    image_url: '',
    sort_order: current.length
  });

  renderGallery(current);

  const items = editor.querySelectorAll('.gallery-item');

  if (items.length) {
    items[items.length - 1].scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}

async function uploadGalleryImage(index) {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You must be signed in as the owner.', 'error');
    return;
  }

  const items = document.querySelectorAll('.gallery-item');
  const item = items[index];

  if (!item) return;

  const fileInput = item.querySelector('.gallery-file');
  const urlInput = item.querySelector('.gallery-url');
  const status = item.querySelector('.gallery-status');
  const preview = item.querySelector('.gallery-preview');

  const file = fileInput?.files?.[0];

  if (!file) {
    if (status) {
      status.textContent = 'Choose a photo first.';
      status.style.color = '#9d2c2c';
    }
    return;
  }

  if (!file.type.startsWith('image/')) {
    if (status) {
      status.textContent = 'Please choose an image file.';
      status.style.color = '#9d2c2c';
    }
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    if (status) {
      status.textContent = 'Photo must be 10 MB or smaller.';
      status.style.color = '#9d2c2c';
    }
    return;
  }

  try {
    if (status) {
      status.textContent = 'Uploading photo...';
      status.style.color = '';
    }

    const oldUrl = urlInput?.value || '';
    const path = createGalleryFileName(file);

    const { error: uploadError } = await sb.storage
      .from(GALLERY_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: publicData
    } = sb.storage
      .from(GALLERY_BUCKET)
      .getPublicUrl(path);

    const publicUrl = publicData?.publicUrl;

    if (!publicUrl) {
      throw new Error('Could not create the public image URL.');
    }

    if (urlInput) {
      urlInput.value = publicUrl;
    }

    let previewEl = item.querySelector('.gallery-preview');

    if (!previewEl) {
      const currentPhotoArea = item.querySelector('.field.full');

      if (currentPhotoArea) {
        const image = document.createElement('img');

        image.className = 'gallery-preview';

        image.style.display = 'block';
        image.style.width = '100%';
        image.style.maxWidth = '500px';
        image.style.maxHeight = '300px';
        image.style.objectFit = 'cover';
        image.style.borderRadius = '6px';
        image.style.marginBottom = '10px';
        image.style.border = '1px solid #d6ddd4';

        currentPhotoArea.insertBefore(
          image,
          currentPhotoArea.children[1]
        );

        previewEl = image;
      }
    }

    if (previewEl) {
      previewEl.src = publicUrl;
      previewEl.alt =
        item.querySelector('.gallery-title')?.value.trim() ||
        'Our Work photo';
    }

    /*
      If replacing an older photo, remove the old
      storage object after the new upload succeeds.
    */
    if (oldUrl && oldUrl !== publicUrl) {
      const oldPath = getStoragePathFromPublicUrl(oldUrl);

      if (oldPath) {
        await sb.storage
          .from(GALLERY_BUCKET)
          .remove([oldPath])
          .catch(err => console.warn('Old image cleanup failed:', err));
      }
    }

    if (status) {
      status.textContent =
        'Photo uploaded. Click "Save gallery" to publish it.';
      status.style.color = '#287719';
      status.style.fontWeight = '800';
    }

  } catch (err) {
    console.error(err);

    if (status) {
      status.textContent =
        `Upload failed: ${err.message || 'Unknown error'}`;
      status.style.color = '#9d2c2c';
      status.style.fontWeight = '800';
    }
  }
}

async function deleteGalleryImage(index) {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You must be signed in as the owner.', 'error');
    return;
  }

  const items = document.querySelectorAll('.gallery-item');
  const item = items[index];

  if (!item) return;

  const title =
    item.querySelector('.gallery-title')?.value.trim() ||
    'this photo';

  const url =
    item.querySelector('.gallery-url')?.value.trim() ||
    '';

  const confirmed = confirm(
    `Delete "${title}"?\n\nThis will remove the photo from the gallery.`
  );

  if (!confirmed) return;

  try {
    const path = getStoragePathFromPublicUrl(url);

    if (path) {
      const { error: storageError } = await sb.storage
        .from(GALLERY_BUCKET)
        .remove([path]);

      if (storageError) {
        console.warn('Storage delete failed:', storageError);
      }
    }

    if (url) {
      const { error: dbError } = await sb
        .from('gallery')
        .delete()
        .eq('image_url', url);

      if (dbError) throw dbError;
    }

    await loadGallery();

  } catch (err) {
    console.error(err);

    setStatus(
      `Could not delete photo: ${err.message || 'Unknown error'}`,
      'error'
    );
  }
}

async function saveGallery() {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You must be signed in as the owner.', 'error');
    return;
  }

  const gallery = collectGallery();

  try {
    setStatus('Saving gallery...');

    const { error: deleteError } = await sb
      .from('gallery')
      .delete()
      .neq('id', 0);

    if (deleteError) throw deleteError;

    if (gallery.length) {
      const { error: insertError } = await sb
        .from('gallery')
        .insert(gallery);

      if (insertError) throw insertError;
    }

    setStatus('Gallery saved.', 'success');

    await loadGallery();

  } catch (err) {
    console.error(err);

    setStatus(
      `Could not save gallery: ${err.message || 'Unknown error'}`,
      'error'
    );
  }
}

async function loadGallery() {
  const { data, error } = await sb
    .from('gallery')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error(error);
    renderGallery([]);
    return;
  }

  renderGallery(data || []);
}


/* -------------------------------------------------
   REVIEWS
------------------------------------------------- */

function renderReviews(items) {
  const editor = $('reviewsEditor');

  if (!editor) return;

  if (!items.length) {
    editor.innerHTML = `
      <div class="muted">
        No reviews have been added yet.
      </div>
    `;
    return;
  }

  editor.innerHTML = items.map((item, index) => `
    <div class="list-item review-item" data-index="${index}">

      <div class="admin-grid">

        <div class="field">
          <label>Customer name</label>
          <input
            class="review-name"
            type="text"
            value="${esc(item.name || '')}"
            placeholder="Customer name">
        </div>

        <div class="field">
          <label>Rating</label>
          <select class="review-rating">
            ${[5,4,3,2,1].map(rating => `
              <option
                value="${rating}"
                ${Number(item.rating || 5) === rating ? 'selected' : ''}>
                ${rating} stars
              </option>
            `).join('')}
          </select>
        </div>

        <div class="field full">
          <label>Review</label>
          <textarea
            class="review-text"
            placeholder="Customer's actual review">${esc(item.text || item.review || '')}</textarea>
        </div>

      </div>

      <div class="admin-actions">
        <button
          type="button"
          class="admin-btn danger delete-review">
          Delete review
        </button>
      </div>

    </div>
  `).join('');

  editor.querySelectorAll('.delete-review').forEach(button => {
    button.addEventListener('click', () => {
      const item = button.closest('.review-item');

      if (!item) return;

      item.remove();

      if (!editor.querySelector('.review-item')) {
        renderReviews([]);
      }
    });
  });
}

function collectReviews() {
  const reviews = [];

  document.querySelectorAll('.review-item').forEach(item => {
    const name =
      item.querySelector('.review-name')?.value.trim() || '';

    const rating =
      Number(item.querySelector('.review-rating')?.value || 5);

    const text =
      item.querySelector('.review-text')?.value.trim() || '';

    if (!text) return;

    reviews.push({
      name,
      rating,
      text
    });
  });

  return reviews;
}

function addReview() {
  const editor = $('reviewsEditor');

  if (!editor) return;

  const current = collectReviews();

  current.push({
    name: '',
    rating: 5,
    text: ''
  });

  renderReviews(current);

  const textareas = editor.querySelectorAll('.review-text');

  if (textareas.length) {
    textareas[textareas.length - 1].focus();
  }
}

async function saveReviews() {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You must be signed in as the owner.', 'error');
    return;
  }

  const reviews = collectReviews();

  try {
    setStatus('Saving reviews...');

    const { error: deleteError } = await sb
      .from('reviews')
      .delete()
      .neq('id', 0);

    if (deleteError) throw deleteError;

    if (reviews.length) {
      const { error: insertError } = await sb
        .from('reviews')
        .insert(reviews);

      if (insertError) throw insertError;
    }

    setStatus('Reviews saved.', 'success');

    await loadReviews();

  } catch (err) {
    console.error(err);

    setStatus(
      `Could not save reviews: ${err.message || 'Unknown error'}`,
      'error'
    );
  }
}

async function loadReviews() {
  const { data, error } = await sb
    .from('reviews')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error(error);
    renderReviews(defaultReviews);
    return;
  }

  renderReviews(data || []);
}


/* -------------------------------------------------
   SITE SETTINGS
------------------------------------------------- */

function renderSettings(settings) {
  if (!settings) return;

  if ($('googleUrl')) {
    $('googleUrl').value =
      settings.google_review_url || '';
  }

  if ($('leaveReviewUrl')) {
    $('leaveReviewUrl').value =
      settings.leave_review_url || '';
  }

  if ($('areaText')) {
    $('areaText').value =
      settings.service_area_text || '';
  }
}

async function saveSettings() {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You must be signed in as the owner.', 'error');
    return;
  }

  const values = {
    id: 1,
    google_review_url:
      $('googleUrl')?.value.trim() || '',
    leave_review_url:
      $('leaveReviewUrl')?.value.trim() || '',
    service_area_text:
      $('areaText')?.value.trim() || ''
  };

  try {
    setSectionStatus(
      'settingsStatus',
      'Saving settings...'
    );

    const { error } = await sb
      .from('site_settings')
      .upsert(values, {
        onConflict: 'id'
      });

    if (error) throw error;

    setSectionStatus(
      'settingsStatus',
      'Settings saved.',
      'success'
    );

  } catch (err) {
    console.error(err);

    setSectionStatus(
      'settingsStatus',
      `Could not save settings: ${err.message || 'Unknown error'}`,
      'error'
    );
  }
}

async function loadSettings() {
  const { data, error } = await sb
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  renderSettings(data || {});
}


/* -------------------------------------------------
   LOAD EVERYTHING
------------------------------------------------- */

async function loadAll() {
  if (!sb || !user || !isOwner(user)) return;

  try {
    await Promise.all([
      loadServices(),
      loadGallery(),
      loadReviews(),
      loadSettings()
    ]);

  } catch (err) {
    console.error('Dashboard loading error:', err);

    setStatus(
      'Some dashboard information could not be loaded.',
      'error'
    );
  }
}


/* -------------------------------------------------
   EVENT LISTENERS
------------------------------------------------- */

function setupEventListeners() {

  const signInBtn = $('signInBtn');

  if (signInBtn) {
    signInBtn.addEventListener('click', event => {
      event.preventDefault();
      signIn();
    });
  }

  const passwordInput = $('passwordInput');

  if (passwordInput) {
    passwordInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        signIn();
      }
    });
  }

  const emailInput = $('emailInput');

  if (emailInput) {
    emailInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        signIn();
      }
    });
  }

  const signOutBtn = $('signOut');

  if (signOutBtn) {
    signOutBtn.addEventListener('click', event => {
      event.preventDefault();
      signOut();
    });
  }

  const saveSettingsBtn = $('saveSettings');

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', event => {
      event.preventDefault();
      saveSettings();
    });
  }

  const addServiceBtn = $('addService');

  if (addServiceBtn) {
    addServiceBtn.addEventListener('click', event => {
      event.preventDefault();
      addService();
    });
  }

  const saveServicesBtn = $('saveServices');

  if (saveServicesBtn) {
    saveServicesBtn.addEventListener('click', event => {
      event.preventDefault();
      saveServices();
    });
  }

  const addGalleryBtn = $('addGallery');

  if (addGalleryBtn) {
    addGalleryBtn.addEventListener('click', event => {
      event.preventDefault();
      addGallery();
    });
  }

  const saveGalleryBtn = $('saveGallery');

  if (saveGalleryBtn) {
    saveGalleryBtn.addEventListener('click', event => {
      event.preventDefault();
      saveGallery();
    });
  }

  const addReviewBtn = $('addReview');

  if (addReviewBtn) {
    addReviewBtn.addEventListener('click', event => {
      event.preventDefault();
      addReview();
    });
  }

  const saveReviewsBtn = $('saveReviews');

  if (saveReviewsBtn) {
    saveReviewsBtn.addEventListener('click', event => {
      event.preventDefault();
      saveReviews();
    });
  }
}


/* -------------------------------------------------
   AUTH SESSION
------------------------------------------------- */

function setupAuthListener() {
  if (!sb) return;

  sb.auth.onAuthStateChange(async (_event, session) => {

    const currentUser = session?.user || null;

    if (!currentUser) {
      user = null;
      showLogin();
      return;
    }

    if (!isOwner(currentUser)) {
      await sb.auth.signOut();
      user = null;
      showLogin();
      setStatus(
        'This account is not authorized to access the owner dashboard.',
        'error'
      );
      return;
    }

    user = currentUser;

    showDashboard();

    await loadAll();
  });
}


/* -------------------------------------------------
   INITIAL CHECK
------------------------------------------------- */

async function check() {

  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY || !C.OWNER_EMAIL) {
    showSetup();

    return;
  }

  if (!initializeSupabase()) {
    showSetup();

    return;
  }

  try {

    const {
      data: { session }
    } = await sb.auth.getSession();

    if (!session?.user) {
      user = null;
      showLogin();
      return;
    }

    if (!isOwner(session.user)) {
      await sb.auth.signOut();
      user = null;
      showLogin();

      setStatus(
        'This account is not authorized to access the owner dashboard.',
        'error'
      );

      return;
    }

    user = session.user;

    showDashboard();

    await loadAll();

  } catch (err) {
    console.error(err);

    user = null;
    showLogin();

    setStatus(
      'Unable to check your login session.',
      'error'
    );
  }
}


/* -------------------------------------------------
   START
------------------------------------------------- */

document.addEventListener('DOMContentLoaded', async () => {

  showLogin();

  setupEventListeners();

  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY || !C.OWNER_EMAIL) {
    showSetup();
    return;
  }

  if (!initializeSupabase()) {
    showSetup();
    return;
  }

  setupAuthListener();

  await check();
});
