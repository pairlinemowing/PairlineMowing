=const C = window.PAIRLINE_CONFIG || {};

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

/* =========================================================
   DEFAULT DATA
========================================================= */

const defaultServices = [
  {
    title: 'Lawn Mowing',
    description: 'Professional lawn mowing to keep your property looking clean and maintained.'
  },
  {
    title: 'Edging',
    description: 'Clean, sharp edging around sidewalks, driveways, and lawn borders.'
  },
  {
    title: 'Weed Whacking',
    description: 'Trim hard-to-reach grass and weeds for a neat finished look.'
  },
  {
    title: 'Gutter Cleaning',
    description: 'Remove leaves, dirt, and debris from your gutters to help keep water flowing properly.'
  },
  {
    title: 'Equipment Repairs',
    description: 'Lawn-mower, whipper, and other outdoor equipment repair services.'
  }
];

const defaultReviews = [];


/* =========================================================
   SCREEN CONTROL
========================================================= */

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
  el.className = 'status';

  if (type) {
    el.classList.add(type);
  }
}


/* =========================================================
   SUPABASE
========================================================= */

function initializeSupabase() {
  if (!window.supabase) {
    setStatus('Supabase library could not be loaded.', 'error');
    return false;
  }

  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) {
    setStatus(
      'Supabase is not configured. Check your public site configuration.',
      'error'
    );
    return false;
  }

  try {
    sb = window.supabase.createClient(
      C.SUPABASE_URL,
      C.SUPABASE_ANON_KEY
    );

    return true;
  } catch (err) {
    console.error(err);
    setStatus('Could not connect to Supabase.', 'error');
    return false;
  }
}


/* =========================================================
   OWNER SECURITY
========================================================= */

function isOwner(u) {
  if (!u || !u.email || !C.OWNER_EMAIL) {
    return false;
  }

  return u.email.toLowerCase() === C.OWNER_EMAIL.toLowerCase();
}


/* =========================================================
   AUTH
========================================================= */

async function signIn() {
  if (!sb) {
    if (!initializeSupabase()) return;
  }

  const email = $('email')?.value.trim();
  const password = $('password')?.value;

  if (!email || !password) {
    setStatus('Enter your email and password.', 'error');
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
      setStatus(error.message || 'Sign in failed.', 'error');
      return;
    }

    if (!data.user || !isOwner(data.user)) {
      await sb.auth.signOut();
      setStatus('This account is not authorized to access the owner dashboard.', 'error');
      return;
    }

    user = data.user;

    setStatus('Signed in successfully.', 'success');

    showDashboard();

    await loadAll();

  } catch (err) {
    console.error(err);
    setStatus('Something went wrong while signing in.', 'error');
  }
}

async function signOut() {
  if (!sb) return;

  try {
    await sb.auth.signOut();
  } catch (err) {
    console.error(err);
  }

  user = null;

  showLogin();

  if ($('password')) {
    $('password').value = '';
  }

  setStatus('Signed out.');
}


/* =========================================================
   SERVICES
========================================================= */

function renderServices(items = []) {
  const container = $('servicesList');

  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        No services have been added yet.
      </div>
    `;
    return;
  }

  container.innerHTML = items.map((item, index) => `
    <div class="admin-card service-card" data-service-index="${index}">
      <div class="admin-card-header">
        <strong>Service ${index + 1}</strong>

        <button
          type="button"
          class="danger remove-service"
          data-index="${index}">
          Delete
        </button>
      </div>

      <label>
        Service Name
        <input
          type="text"
          class="service-title"
          value="${esc(item.title || '')}"
          placeholder="Service name">
      </label>

      <label>
        Description
        <textarea
          class="service-description"
          rows="3"
          placeholder="Describe this service">${esc(item.description || '')}</textarea>
      </label>
    </div>
  `).join('');

  container.querySelectorAll('.remove-service').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);

      const cards = [...container.querySelectorAll('.service-card')];

      if (cards[index]) {
        cards[index].remove();
      }

      if (!container.querySelector('.service-card')) {
        container.innerHTML = `
          <div class="empty-state">
            No services have been added yet.
          </div>
        `;
      }
    });
  });
}

function collectServices() {
  const container = $('servicesList');

  if (!container) return [];

  return [...container.querySelectorAll('.service-card')]
    .map(card => ({
      title: card.querySelector('.service-title')?.value.trim() || '',
      description: card.querySelector('.service-description')?.value.trim() || ''
    }))
    .filter(item => item.title);
}

async function saveServices() {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You are not authorized to do that.', 'error');
    return;
  }

  const services = collectServices();

  setStatus('Saving services...');

  try {
    const { error: deleteError } = await sb
      .from('services')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      throw deleteError;
    }

    if (services.length) {
      const { error: insertError } = await sb
        .from('services')
        .insert(services);

      if (insertError) {
        throw insertError;
      }
    }

    setStatus('Services saved successfully.', 'success');

  } catch (err) {
    console.error(err);
    setStatus(
      err.message || 'Could not save services.',
      'error'
    );
  }
}

function addService() {
  const container = $('servicesList');

  if (!container) return;

  const empty = container.querySelector('.empty-state');

  if (empty) {
    empty.remove();
  }

  const index = container.querySelectorAll('.service-card').length;

  const card = document.createElement('div');

  card.className = 'admin-card service-card';

  card.innerHTML = `
    <div class="admin-card-header">
      <strong>Service ${index + 1}</strong>

      <button
        type="button"
        class="danger remove-service">
        Delete
      </button>
    </div>

    <label>
      Service Name
      <input
        type="text"
        class="service-title"
        placeholder="Service name">
    </label>

    <label>
      Description
      <textarea
        class="service-description"
        rows="3"
        placeholder="Describe this service"></textarea>
    </label>
  `;

  card.querySelector('.remove-service').addEventListener('click', () => {
    card.remove();

    if (!container.querySelector('.service-card')) {
      container.innerHTML = `
        <div class="empty-state">
          No services have been added yet.
        </div>
      `;
    }
  });

  container.appendChild(card);
}


/* =========================================================
   GALLERY
========================================================= */

function createGalleryFileName(file) {
  const original = file.name || 'photo';

  const extension = original.includes('.')
    ? original.split('.').pop().toLowerCase()
    : 'jpg';

  const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'jpg';

  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `gallery/${id}.${safeExtension}`;
}

function renderGallery(items = []) {
  const container = $('galleryList');

  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state gallery-empty">
        <p>No Our Work photos have been added yet.</p>

        <button
          type="button"
          id="addFirstGallery">
          Add Photo
        </button>
      </div>
    `;

    $('addFirstGallery')?.addEventListener('click', addGallery);

    return;
  }

  container.innerHTML = items.map((item, index) => `
    <div
      class="admin-card gallery-card"
      data-gallery-index="${index}">

      <div class="admin-card-header">
        <strong>Photo ${index + 1}</strong>

        <button
          type="button"
          class="danger delete-gallery"
          data-index="${index}">
          Delete Photo
        </button>
      </div>

      <label>
        Photo Title
        <input
          type="text"
          class="gallery-title"
          value="${esc(item.title || '')}"
          placeholder="Example: Front yard cleanup">
      </label>

      <label>
        Sort Order
        <input
          type="number"
          class="gallery-order"
          value="${Number(item.sort_order) || index + 1}"
          min="0">
      </label>

      <div class="gallery-preview">
        <img
          class="gallery-image-preview"
          src="${esc(item.image_url || '')}"
          alt="${esc(item.title || 'Our Work photo')}">
      </div>

      <label>
        Choose Photo
        <input
          type="file"
          class="gallery-file"
          accept="image/*">
      </label>

      <input
        type="hidden"
        class="gallery-url"
        value="${esc(item.image_url || '')}">

      <div class="gallery-actions">
        <button
          type="button"
          class="upload-gallery"
          data-index="${index}">
          Upload / Replace Photo
        </button>

        <button
          type="button"
          class="danger delete-gallery"
          data-index="${index}">
          Delete Photo
        </button>
      </div>

      <div class="gallery-status"></div>
    </div>
  `).join('');

  container.querySelectorAll('.upload-gallery').forEach(button => {
    button.addEventListener('click', () => {
      uploadGalleryImage(Number(button.dataset.index));
    });
  });

  container.querySelectorAll('.delete-gallery').forEach(button => {
    button.addEventListener('click', () => {
      deleteGalleryImage(Number(button.dataset.index));
    });
  });

  container.querySelectorAll('.gallery-file').forEach(input => {
    input.addEventListener('change', () => {
      const file = input.files?.[0];

      if (!file) return;

      const card = input.closest('.gallery-card');

      if (!card) return;

      const preview = card.querySelector('.gallery-image-preview');

      if (preview) {
        preview.src = URL.createObjectURL(file);
      }
    });
  });
}

function addGallery() {
  const container = $('galleryList');

  if (!container) return;

  const empty = container.querySelector('.gallery-empty');

  if (empty) {
    empty.remove();
  }

  const index = container.querySelectorAll('.gallery-card').length;

  const card = document.createElement('div');

  card.className = 'admin-card gallery-card';

  card.dataset.galleryIndex = index;

  card.innerHTML = `
    <div class="admin-card-header">
      <strong>Photo ${index + 1}</strong>

      <button
        type="button"
        class="danger remove-unsaved-gallery">
        Remove
      </button>
    </div>

    <label>
      Photo Title
      <input
        type="text"
        class="gallery-title"
        placeholder="Example: Front yard cleanup">
    </label>

    <label>
      Sort Order
      <input
        type="number"
        class="gallery-order"
        value="${index + 1}"
        min="0">
    </label>

    <div class="gallery-preview">
      <div class="gallery-placeholder">
        Choose a photo below
      </div>

      <img
        class="gallery-image-preview"
        style="display:none"
        alt="Our Work photo preview">
    </div>

    <label>
      Choose Photo
      <input
        type="file"
        class="gallery-file"
        accept="image/*">
    </label>

    <input
      type="hidden"
      class="gallery-url"
      value="">

    <div class="gallery-actions">
      <button
        type="button"
        class="upload-gallery">
        Upload / Replace Photo
      </button>
    </div>

    <div class="gallery-status"></div>
  `;

  const fileInput = card.querySelector('.gallery-file');

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];

    if (!file) return;

    const preview = card.querySelector('.gallery-image-preview');
    const placeholder = card.querySelector('.gallery-placeholder');

    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = '';
    }

    if (placeholder) {
      placeholder.style.display = 'none';
    }
  });

  card.querySelector('.upload-gallery').addEventListener('click', () => {
    const cards = [...container.querySelectorAll('.gallery-card')];
    const currentIndex = cards.indexOf(card);

    if (currentIndex >= 0) {
      uploadGalleryImage(currentIndex);
    }
  });

  card.querySelector('.remove-unsaved-gallery').addEventListener('click', () => {
    card.remove();

    if (!container.querySelector('.gallery-card')) {
      renderGallery([]);
    }
  });

  container.appendChild(card);
}

function collectGallery() {
  const container = $('galleryList');

  if (!container) return [];

  return [...container.querySelectorAll('.gallery-card')]
    .map(card => ({
      title: card.querySelector('.gallery-title')?.value.trim() || '',
      image_url: card.querySelector('.gallery-url')?.value.trim() || '',
      sort_order:
        Number(card.querySelector('.gallery-order')?.value) || 0
    }))
    .filter(item => item.image_url);
}


/* =========================================================
   GALLERY STORAGE HELPERS
========================================================= */

function getStoragePathFromPublicUrl(url) {
  if (!url) return null;

  try {
    const marker = `/storage/v1/object/public/${GALLERY_BUCKET}/`;

    const index = url.indexOf(marker);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(
      url.slice(index + marker.length)
    );
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function uploadGalleryImage(index) {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You are not authorized to upload photos.', 'error');
    return;
  }

  const container = $('galleryList');

  if (!container) return;

  const cards = [...container.querySelectorAll('.gallery-card')];

  const card = cards[index];

  if (!card) {
    setStatus('Could not find that photo.', 'error');
    return;
  }

  const fileInput = card.querySelector('.gallery-file');
  const file = fileInput?.files?.[0];

  const status = card.querySelector('.gallery-status');
  const urlInput = card.querySelector('.gallery-url');
  const preview = card.querySelector('.gallery-image-preview');

  if (!file) {
    if (status) {
      status.textContent = 'Choose a photo first.';
    }

    return;
  }

  if (!file.type.startsWith('image/')) {
    if (status) {
      status.textContent = 'Please choose an image file.';
    }

    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    if (status) {
      status.textContent = 'Photo must be 10 MB or smaller.';
    }

    return;
  }

  if (status) {
    status.textContent = 'Uploading photo...';
  }

  try {
    const oldUrl = urlInput?.value || '';

    const filePath = createGalleryFileName(file);

    const { error: uploadError } = await sb.storage
      .from(GALLERY_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = sb.storage
      .from(GALLERY_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = data?.publicUrl;

    if (!publicUrl) {
      throw new Error('Supabase did not return a public image URL.');
    }

    if (urlInput) {
      urlInput.value = publicUrl;
    }

    if (preview) {
      preview.src = publicUrl;
      preview.style.display = '';
    }

    const placeholder = card.querySelector('.gallery-placeholder');

    if (placeholder) {
      placeholder.style.display = 'none';
    }

    /*
      Delete the previous storage file after the new one
      has successfully uploaded.
    */
    if (oldUrl && oldUrl !== publicUrl) {
      const oldPath = getStoragePathFromPublicUrl(oldUrl);

      if (oldPath) {
        const { error: removeError } = await sb.storage
          .from(GALLERY_BUCKET)
          .remove([oldPath]);

        if (removeError) {
          console.warn(
            'Old photo could not be removed:',
            removeError
          );
        }
      }
    }

    if (status) {
      status.textContent =
        'Photo uploaded. Click "Save Gallery" to publish it.';
    }

    setStatus('Photo uploaded successfully.', 'success');

  } catch (err) {
    console.error(err);

    if (status) {
      status.textContent =
        err.message || 'Photo upload failed.';
    }

    setStatus(
      err.message || 'Photo upload failed.',
      'error'
    );
  }
}

async function deleteGalleryImage(index) {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You are not authorized to delete photos.', 'error');
    return;
  }

  const container = $('galleryList');

  if (!container) return;

  const cards = [...container.querySelectorAll('.gallery-card')];

  const card = cards[index];

  if (!card) return;

  const url =
    card.querySelector('.gallery-url')?.value.trim() || '';

  const title =
    card.querySelector('.gallery-title')?.value.trim() ||
    'this photo';

  const confirmed = confirm(
    `Delete "${title}"?\n\nThis will remove the photo from the Our Work gallery.`
  );

  if (!confirmed) return;

  setStatus('Deleting photo...');

  try {
    /*
      Remove the actual Storage file.
    */
    if (url) {
      const path = getStoragePathFromPublicUrl(url);

      if (path) {
        const { error: storageError } = await sb.storage
          .from(GALLERY_BUCKET)
          .remove([path]);

        if (storageError) {
          console.warn(
            'Storage file could not be removed:',
            storageError
          );
        }
      }

      /*
        Remove the database record.
      */
      const { error: dbError } = await sb
        .from('gallery')
        .delete()
        .eq('image_url', url);

      if (dbError) {
        throw dbError;
      }
    }

    card.remove();

    if (!container.querySelector('.gallery-card')) {
      renderGallery([]);
    }

    setStatus('Photo deleted.', 'success');

  } catch (err) {
    console.error(err);

    setStatus(
      err.message || 'Could not delete the photo.',
      'error'
    );
  }
}

async function saveGallery() {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You are not authorized to save the gallery.', 'error');
    return;
  }

  const gallery = collectGallery();

  setStatus('Saving gallery...');

  try {
    /*
      Save the gallery records.
      The actual image files are stored separately
      inside Supabase Storage.
    */
    const { error: deleteError } = await sb
      .from('gallery')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      throw deleteError;
    }

    if (gallery.length) {
      const { error: insertError } = await sb
        .from('gallery')
        .insert(gallery);

      if (insertError) {
        throw insertError;
      }
    }

    setStatus('Our Work gallery saved successfully.', 'success');

  } catch (err) {
    console.error(err);

    setStatus(
      err.message || 'Could not save the gallery.',
      'error'
    );
  }
}


/* =========================================================
   REVIEWS
========================================================= */

function renderReviews(items = []) {
  const container = $('reviewsList');

  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        No reviews have been added yet.
      </div>
    `;
    return;
  }

  container.innerHTML = items.map((item, index) => `
    <div class="admin-card review-card">
      <div class="admin-card-header">
        <strong>Review ${index + 1}</strong>

        <button
          type="button"
          class="danger remove-review">
          Delete
        </button>
      </div>

      <label>
        Customer Name
        <input
          type="text"
          class="review-name"
          value="${esc(item.name || '')}"
          placeholder="Customer name">
      </label>

      <label>
        Review
        <textarea
          class="review-text"
          rows="4"
          placeholder="Customer review">${esc(item.text || '')}</textarea>
      </label>

      <label>
        Rating
        <input
          type="number"
          class="review-rating"
          min="1"
          max="5"
          value="${Number(item.rating) || 5}">
      </label>
    </div>
  `).join('');

  container.querySelectorAll('.remove-review').forEach(button => {
    button.addEventListener('click', () => {
      button.closest('.review-card')?.remove();
    });
  });
}

function collectReviews() {
  const container = $('reviewsList');

  if (!container) return [];

  return [...container.querySelectorAll('.review-card')]
    .map(card => ({
      name: card.querySelector('.review-name')?.value.trim() || '',
      text: card.querySelector('.review-text')?.value.trim() || '',
      rating:
        Number(card.querySelector('.review-rating')?.value) || 5
    }))
    .filter(item => item.name && item.text);
}

async function saveReviews() {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You are not authorized to save reviews.', 'error');
    return;
  }

  const reviews = collectReviews();

  setStatus('Saving reviews...');

  try {
    const { error: deleteError } = await sb
      .from('reviews')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      throw deleteError;
    }

    if (reviews.length) {
      const { error: insertError } = await sb
        .from('reviews')
        .insert(reviews);

      if (insertError) {
        throw insertError;
      }
    }

    setStatus('Reviews saved successfully.', 'success');

  } catch (err) {
    console.error(err);

    setStatus(
      err.message || 'Could not save reviews.',
      'error'
    );
  }
}

function addReview() {
  const container = $('reviewsList');

  if (!container) return;

  const empty = container.querySelector('.empty-state');

  if (empty) {
    empty.remove();
  }

  const card = document.createElement('div');

  card.className = 'admin-card review-card';

  card.innerHTML = `
    <div class="admin-card-header">
      <strong>New Review</strong>

      <button
        type="button"
        class="danger remove-review">
        Delete
      </button>
    </div>

    <label>
      Customer Name
      <input
        type="text"
        class="review-name"
        placeholder="Customer name">
    </label>

    <label>
      Review
      <textarea
        class="review-text"
        rows="4"
        placeholder="Customer review"></textarea>
    </label>

    <label>
      Rating
      <input
        type="number"
        class="review-rating"
        min="1"
        max="5"
        value="5">
    </label>
  `;

  card.querySelector('.remove-review').addEventListener('click', () => {
    card.remove();
  });

  container.appendChild(card);
}


/* =========================================================
   SITE SETTINGS
========================================================= */

function renderSettings(settings = {}) {
  if ($('googleReviewUrl')) {
    $('googleReviewUrl').value =
      settings.google_review_url || '';
  }

  if ($('leaveReviewUrl')) {
    $('leaveReviewUrl').value =
      settings.leave_review_url || '';
  }

  if ($('serviceAreaText')) {
    $('serviceAreaText').value =
      settings.service_area_text || '';
  }
}

async function saveSettings() {
  if (!sb || !user || !isOwner(user)) {
    setStatus('You are not authorized to save settings.', 'error');
    return;
  }

  const settings = {
    id: 1,
    google_review_url:
      $('googleReviewUrl')?.value.trim() || '',
    leave_review_url:
      $('leaveReviewUrl')?.value.trim() || '',
    service_area_text:
      $('serviceAreaText')?.value.trim() || ''
  };

  setStatus('Saving site settings...');

  try {
    const { error } = await sb
      .from('site_settings')
      .upsert(settings);

    if (error) {
      throw error;
    }

    setStatus('Site settings saved successfully.', 'success');

  } catch (err) {
    console.error(err);

    setStatus(
      err.message || 'Could not save site settings.',
      'error'
    );
  }
}


/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadAll() {
  if (!sb || !user || !isOwner(user)) {
    return;
  }

  setStatus('Loading dashboard...');

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
        .order('id', { ascending: true }),

      sb
        .from('gallery')
        .select('*')
        .order('sort_order', { ascending: true }),

      sb
        .from('reviews')
        .select('*')
        .order('id', { ascending: true }),

      sb
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()
    ]);

    if (servicesResult.error) {
      throw servicesResult.error;
    }

    if (galleryResult.error) {
      throw galleryResult.error;
    }

    if (reviewsResult.error) {
      throw reviewsResult.error;
    }

    if (settingsResult.error) {
      throw settingsResult.error;
    }

    let services = servicesResult.data || [];

    /*
      If no services exist yet, show the standard
      Pairline Mowing services.
    */
    if (!services.length) {
      services = defaultServices;
    }

    renderServices(services);
    renderGallery(galleryResult.data || []);
    renderReviews(reviewsResult.data || defaultReviews);
    renderSettings(settingsResult.data || {});

    setStatus('Dashboard loaded.', 'success');

  } catch (err) {
    console.error(err);

    setStatus(
      err.message || 'Could not load the dashboard.',
      'error'
    );
  }
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEventListeners() {

  $('signInBtn')?.addEventListener('click', signIn);

  $('loginForm')?.addEventListener('submit', event => {
    event.preventDefault();
    signIn();
  });

  $('signOutBtn')?.addEventListener('click', signOut);

  $('saveServices')?.addEventListener(
    'click',
    saveServices
  );

  $('addService')?.addEventListener(
    'click',
    addService
  );

  $('saveGallery')?.addEventListener(
    'click',
    saveGallery
  );

  $('addGallery')?.addEventListener(
    'click',
    addGallery
  );

  $('saveReviews')?.addEventListener(
    'click',
    saveReviews
  );

  $('addReview')?.addEventListener(
    'click',
    addReview
  );

  $('saveSettings')?.addEventListener(
    'click',
    saveSettings
  );

  $('password')?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      signIn();
    }
  });
}


/* =========================================================
   AUTH CHECK
========================================================= */

async function check() {
  if (!initializeSupabase()) {
    showSetup();
    return;
  }

  try {
    /*
      IMPORTANT:
      Do NOT sign out on page load.
      This allows Supabase to remember the owner
      when the page is refreshed.
    */
    const {
      data,
      error
    } = await sb.auth.getSession();

    if (error) {
      throw error;
    }

    const session = data?.session;

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
      err.message || 'Could not check your login session.',
      'error'
    );
  }
}


/* =========================================================
   AUTH STATE CHANGES
========================================================= */

async function setupAuthListener() {
  if (!sb) return;

  sb.auth.onAuthStateChange((event, session) => {

    if (event === 'SIGNED_OUT') {
      user = null;
      showLogin();
      return;
    }

    if (
      session?.user &&
      isOwner(session.user)
    ) {
      user = session.user;
      showDashboard();
    }
  });
}


/* =========================================================
   START
========================================================= */

document.addEventListener('DOMContentLoaded', async () => {

  setupEventListeners();

  if (!initializeSupabase()) {
    showSetup();
    return;
  }

  await setupAuthListener();

  await check();
});
