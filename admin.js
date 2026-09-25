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


/* =========================================================
   DEFAULT WEBSITE DATA
   These are ONLY used if Supabase has no services yet.
   Existing Supabase/site data always takes priority.
========================================================= */

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
   SUPABASE CONNECTION
========================================================= */

function initializeSupabase() {
  if (!window.supabase) {
    setStatus(
      'Supabase could not be loaded.',
      'error'
    );

    return false;
  }

  if (!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY) {
    setStatus(
      'Supabase is not configured. Check your public configuration.',
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

    setStatus(
      'Could not connect to Supabase.',
      'error'
    );

    return false;
  }
}


/* =========================================================
   OWNER AUTHORIZATION
========================================================= */

function isOwner(u) {
  if (!u || !u.email || !C.OWNER_EMAIL) {
    return false;
  }

  return (
    u.email.trim().toLowerCase() ===
    C.OWNER_EMAIL.trim().toLowerCase()
  );
}


/* =========================================================
   SIGN IN
========================================================= */

async function signIn() {
  if (!sb) {
    if (!initializeSupabase()) {
      return;
    }
  }

  const email = $('email')?.value.trim() || '';
  const password = $('password')?.value || '';

  if (!email || !password) {
    setStatus(
      'Enter your owner email and password.',
      'error'
    );

    return;
  }

  setStatus('Signing in...');

  try {
    const { data, error } =
      await sb.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      console.error(error);

      setStatus(
        'Incorrect email or password.',
        'error'
      );

      return;
    }

    const signedInUser = data?.user;

    /*
      Authentication succeeded, but authentication alone
      is NOT enough.

      The account must also match OWNER_EMAIL.
    */
    if (!signedInUser || !isOwner(signedInUser)) {

      await sb.auth.signOut();

      user = null;

      showLogin();

      setStatus(
        'This account is not authorized to access the owner dashboard.',
        'error'
      );

      return;
    }

    /*
      Only after BOTH authentication and owner verification
      do we allow the dashboard to appear.
    */
    user = signedInUser;

    showDashboard();

    setStatus(
      'Signed in successfully.',
      'success'
    );

    await loadAll();

  } catch (err) {
    console.error(err);

    user = null;

    showLogin();

    setStatus(
      'Something went wrong while signing in.',
      'error'
    );
  }
}


/* =========================================================
   SIGN OUT
========================================================= */

async function signOut() {
  if (!sb) {
    return;
  }

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

  if (!container) {
    return;
  }

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        No services have been added yet.
      </div>
    `;

    return;
  }

  container.innerHTML = items.map((item, index) => `
    <div
      class="admin-card service-card"
      data-service-index="${index}">

      <div class="admin-card-header">
        <strong>
          Service ${index + 1}
        </strong>

        <button
          type="button"
          class="danger remove-service">
          Delete Service
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
          rows="4"
          placeholder="Service description">${esc(item.description || '')}</textarea>
      </label>
    </div>
  `).join('');

  attachServiceDeleteButtons();
}

function attachServiceDeleteButtons() {
  const container = $('servicesList');

  if (!container) {
    return;
  }

  container
    .querySelectorAll('.remove-service')
    .forEach(button => {

      button.addEventListener('click', () => {

        const card =
          button.closest('.service-card');

        if (!card) {
          return;
        }

        const title =
          card.querySelector('.service-title')
            ?.value.trim() ||
          'this service';

        const confirmed = confirm(
          `Delete "${title}"?\n\nThis will remove it from the services you manage.`
        );

        if (!confirmed) {
          return;
        }

        card.remove();

        if (!container.querySelector('.service-card')) {
          container.innerHTML = `
            <div class="empty-state">
              No services have been added yet.
            </div>
          `;
        }

        setStatus(
          'Service removed from the dashboard. Click "Save Services" to apply the change.',
          'success'
        );
      });
    });
}

function collectServices() {
  const container = $('servicesList');

  if (!container) {
    return [];
  }

  return [...container.querySelectorAll('.service-card')]
    .map(card => ({
      title:
        card.querySelector('.service-title')
          ?.value.trim() || '',

      description:
        card.querySelector('.service-description')
          ?.value.trim() || ''
    }))
    .filter(service => service.title);
}

async function saveServices() {
  if (!sb || !user || !isOwner(user)) {
    setStatus(
      'You are not authorized to save services.',
      'error'
    );

    return;
  }

  const services = collectServices();

  setStatus('Saving services...');

  try {

    /*
      Replace the service list with the current
      dashboard contents.
    */

    const { error: deleteError } =
      await sb
        .from('services')
        .delete()
        .neq('id', 0);

    if (deleteError) {
      throw deleteError;
    }

    if (services.length) {

      const { error: insertError } =
        await sb
          .from('services')
          .insert(services);

      if (insertError) {
        throw insertError;
      }
    }

    setStatus(
      'Services saved successfully.',
      'success'
    );

  } catch (err) {
    console.error(err);

    setStatus(
      err.message ||
      'Could not save services.',
      'error'
    );
  }
}

function addService() {
  const container = $('servicesList');

  if (!container) {
    return;
  }

  const empty =
    container.querySelector('.empty-state');

  if (empty) {
    empty.remove();
  }

  const number =
    container.querySelectorAll('.service-card').length + 1;

  const card =
    document.createElement('div');

  card.className =
    'admin-card service-card';

  card.innerHTML = `
    <div class="admin-card-header">

      <strong>
        New Service
      </strong>

      <button
        type="button"
        class="danger remove-service">
        Delete Service
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
        rows="4"
        placeholder="Service description"></textarea>
    </label>
  `;

  card
    .querySelector('.remove-service')
    .addEventListener('click', () => {

      const title =
        card.querySelector('.service-title')
          ?.value.trim() ||
        'this service';

      const confirmed = confirm(
        `Delete "${title}"?`
      );

      if (!confirmed) {
        return;
      }

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

  card.querySelector('.service-title')?.focus();

  setStatus(
    'New service added. Fill it out and save your services.',
    'success'
  );
}


/* =========================================================
   GALLERY
========================================================= */

function createGalleryFileName(file) {
  const original =
    file.name || 'photo';

  const extension =
    original.includes('.')
      ? original.split('.').pop().toLowerCase()
      : 'jpg';

  const safeExtension =
    extension.replace(
      /[^a-z0-9]/g,
      ''
    ) || 'jpg';

  const id =
    typeof crypto !== 'undefined' &&
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  return `gallery/${id}.${safeExtension}`;
}

function renderGallery(items = []) {
  const container = $('galleryList');

  if (!container) {
    return;
  }

  if (!items.length) {

    container.innerHTML = `
      <div class="empty-state gallery-empty">

        <p>
          No Our Work photos have been added yet.
        </p>

        <button
          type="button"
          id="addFirstGallery">
          Add Photo
        </button>

      </div>
    `;

    $('addFirstGallery')
      ?.addEventListener(
        'click',
        addGallery
      );

    return;
  }

  container.innerHTML = items.map((item, index) => `
    <div
      class="admin-card gallery-card"
      data-gallery-index="${index}">

      <div class="admin-card-header">

        <strong>
          Photo ${index + 1}
        </strong>

        <button
          type="button"
          class="danger delete-gallery">
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
          class="upload-gallery">
          Upload / Replace Photo
        </button>

        <button
          type="button"
          class="danger delete-gallery">
          Delete Photo
        </button>

      </div>

      <div class="gallery-status"></div>

    </div>
  `).join('');

  attachGalleryButtons();
}

function attachGalleryButtons() {
  const container = $('galleryList');

  if (!container) {
    return;
  }

  container
    .querySelectorAll('.upload-gallery')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const card =
            button.closest('.gallery-card');

          if (!card) {
            return;
          }

          const cards =
            [...container.querySelectorAll(
              '.gallery-card'
            )];

          const index =
            cards.indexOf(card);

          if (index >= 0) {
            uploadGalleryImage(index);
          }
        }
      );
    });

  container
    .querySelectorAll('.delete-gallery')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const card =
            button.closest('.gallery-card');

          if (!card) {
            return;
          }

          const cards =
            [...container.querySelectorAll(
              '.gallery-card'
            )];

          const index =
            cards.indexOf(card);

          if (index >= 0) {
            deleteGalleryImage(index);
          }
        }
      );
    });

  container
    .querySelectorAll('.gallery-file')
    .forEach(input => {

      input.addEventListener(
        'change',
        () => {

          const file =
            input.files?.[0];

          if (!file) {
            return;
          }

          const card =
            input.closest('.gallery-card');

          if (!card) {
            return;
          }

          const preview =
            card.querySelector(
              '.gallery-image-preview'
            );

          if (preview) {
            preview.src =
              URL.createObjectURL(file);

            preview.style.display = '';
          }

          const placeholder =
            card.querySelector(
              '.gallery-placeholder'
            );

          if (placeholder) {
            placeholder.style.display =
              'none';
          }
        }
      );
    });
}

function addGallery() {
  const container = $('galleryList');

  if (!container) {
    return;
  }

  const empty =
    container.querySelector('.gallery-empty');

  if (empty) {
    empty.remove();
  }

  const card =
    document.createElement('div');

  card.className =
    'admin-card gallery-card';

  card.innerHTML = `
    <div class="admin-card-header">

      <strong>
        New Photo
      </strong>

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
        value="1"
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

  card
    .querySelector('.gallery-file')
    .addEventListener(
      'change',
      () => {

        const file =
          card.querySelector(
            '.gallery-file'
          )?.files?.[0];

        if (!file) {
          return;
        }

        const preview =
          card.querySelector(
            '.gallery-image-preview'
          );

        const placeholder =
          card.querySelector(
            '.gallery-placeholder'
          );

        if (preview) {
          preview.src =
            URL.createObjectURL(file);

          preview.style.display = '';
        }

        if (placeholder) {
          placeholder.style.display =
            'none';
        }
      }
    );

  card
    .querySelector('.upload-gallery')
    .addEventListener(
      'click',
      () => {

        const cards =
          [...container.querySelectorAll(
            '.gallery-card'
          )];

        const index =
          cards.indexOf(card);

        if (index >= 0) {
          uploadGalleryImage(index);
        }
      }
    );

  card
    .querySelector('.remove-unsaved-gallery')
    .addEventListener(
      'click',
      () => {

        card.remove();

        if (!container.querySelector(
          '.gallery-card'
        )) {
          renderGallery([]);
        }
      }
    );

  container.appendChild(card);
}

function collectGallery() {
  const container = $('galleryList');

  if (!container) {
    return [];
  }

  return [...container.querySelectorAll(
    '.gallery-card'
  )]
    .map(card => ({
      title:
        card.querySelector('.gallery-title')
          ?.value.trim() || '',

      image_url:
        card.querySelector('.gallery-url')
          ?.value.trim() || '',

      sort_order:
        Number(
          card.querySelector('.gallery-order')
            ?.value
        ) || 0
    }))
    .filter(item => item.image_url);
}


/* =========================================================
   STORAGE HELPERS
========================================================= */

function getStoragePathFromPublicUrl(url) {
  if (!url) {
    return null;
  }

  try {

    const marker =
      `/storage/v1/object/public/${GALLERY_BUCKET}/`;

    const index =
      url.indexOf(marker);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(
      url.slice(
        index + marker.length
      )
    );

  } catch (err) {
    console.error(err);
    return null;
  }
}


/* =========================================================
   UPLOAD PHOTO
========================================================= */

async function uploadGalleryImage(index) {
  if (!sb || !user || !isOwner(user)) {
    setStatus(
      'You are not authorized to upload photos.',
      'error'
    );

    return;
  }

  const container = $('galleryList');

  if (!container) {
    return;
  }

  const cards =
    [...container.querySelectorAll(
      '.gallery-card'
    )];

  const card = cards[index];

  if (!card) {
    return;
  }

  const file =
    card.querySelector(
      '.gallery-file'
    )?.files?.[0];

  const status =
    card.querySelector(
      '.gallery-status'
    );

  const urlInput =
    card.querySelector(
      '.gallery-url'
    );

  const preview =
    card.querySelector(
      '.gallery-image-preview'
    );

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
        'Please choose an image file.';
    }

    return;
  }

  if (file.size > 10 * 1024 * 1024) {

    if (status) {
      status.textContent =
        'Photo must be 10 MB or smaller.';
    }

    return;
  }

  if (status) {
    status.textContent =
      'Uploading photo...';
  }

  try {

    const oldUrl =
      urlInput?.value || '';

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
          upsert: false,
          contentType: file.type
        }
      );

    if (uploadError) {
      throw uploadError;
    }

    const { data } =
      sb.storage
        .from(GALLERY_BUCKET)
        .getPublicUrl(filePath);

    const publicUrl =
      data?.publicUrl;

    if (!publicUrl) {
      throw new Error(
        'Supabase did not return a public image URL.'
      );
    }

    if (urlInput) {
      urlInput.value =
        publicUrl;
    }

    if (preview) {
      preview.src =
        publicUrl;

      preview.style.display =
        '';
    }

    /*
      Remove the old image after the
      replacement successfully uploads.
    */

    if (
      oldUrl &&
      oldUrl !== publicUrl
    ) {

      const oldPath =
        getStoragePathFromPublicUrl(
          oldUrl
        );

      if (oldPath) {

        const {
          error: removeError
        } = await sb.storage
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

    setStatus(
      'Photo uploaded successfully.',
      'success'
    );

  } catch (err) {

    console.error(err);

    if (status) {
      status.textContent =
        err.message ||
        'Photo upload failed.';
    }

    setStatus(
      err.message ||
      'Photo upload failed.',
      'error'
    );
  }
}


/* =========================================================
   DELETE PHOTO
========================================================= */

async function deleteGalleryImage(index) {
  if (!sb || !user || !isOwner(user)) {
    setStatus(
      'You are not authorized to delete photos.',
      'error'
    );

    return;
  }

  const container = $('galleryList');

  if (!container) {
    return;
  }

  const cards =
    [...container.querySelectorAll(
      '.gallery-card'
    )];

  const card = cards[index];

  if (!card) {
    return;
  }

  const url =
    card.querySelector(
      '.gallery-url'
    )?.value.trim() || '';

  const title =
    card.querySelector(
      '.gallery-title'
    )?.value.trim() ||
    'this photo';

  const confirmed = confirm(
    `Delete "${title}"?\n\nThis will remove the photo from the Our Work gallery.`
  );

  if (!confirmed) {
    return;
  }

  setStatus(
    'Deleting photo...'
  );

  try {

    if (url) {

      const path =
        getStoragePathFromPublicUrl(
          url
        );

      if (path) {

        const {
          error: storageError
        } = await sb.storage
          .from(GALLERY_BUCKET)
          .remove([path]);

        if (storageError) {
          console.warn(
            'Storage file could not be removed:',
            storageError
          );
        }
      }

      const {
        error: dbError
      } = await sb
        .from('gallery')
        .delete()
        .eq('image_url', url);

      if (dbError) {
        throw dbError;
      }
    }

    card.remove();

    if (!container.querySelector(
      '.gallery-card'
    )) {
      renderGallery([]);
    }

    setStatus(
      'Photo deleted.',
      'success'
    );

  } catch (err) {

    console.error(err);

    setStatus(
      err.message ||
      'Could not delete the photo.',
      'error'
    );
  }
}


/* =========================================================
   SAVE GALLERY
========================================================= */

async function saveGallery() {
  if (!sb || !user || !isOwner(user)) {
    setStatus(
      'You are not authorized to save the gallery.',
      'error'
    );

    return;
  }

  const gallery =
    collectGallery();

  setStatus(
    'Saving gallery...'
  );

  try {

    const {
      error: deleteError
    } = await sb
      .from('gallery')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      throw deleteError;
    }

    if (gallery.length) {

      const {
        error: insertError
      } = await sb
        .from('gallery')
        .insert(gallery);

      if (insertError) {
        throw insertError;
      }
    }

    setStatus(
      'Our Work gallery saved successfully.',
      'success'
    );

  } catch (err) {

    console.error(err);

    setStatus(
      err.message ||
      'Could not save the gallery.',
      'error'
    );
  }
}


/* =========================================================
   REVIEWS
========================================================= */

function renderReviews(items = []) {
  const container = $('reviewsList');

  if (!container) {
    return;
  }

  if (!items.length) {

    container.innerHTML = `
      <div class="empty-state">
        No reviews have been added yet.
      </div>
    `;

    return;
  }

  container.innerHTML =
    items.map((item, index) => `

      <div
        class="admin-card review-card">

        <div class="admin-card-header">

          <strong>
            Review ${index + 1}
          </strong>

          <button
            type="button"
            class="danger remove-review">
            Delete Review
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

  attachReviewDeleteButtons();
}

function attachReviewDeleteButtons() {
  const container =
    $('reviewsList');

  if (!container) {
    return;
  }

  container
    .querySelectorAll('.remove-review')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const card =
            button.closest(
              '.review-card'
            );

          if (!card) {
            return;
          }

          const name =
            card.querySelector(
              '.review-name'
            )?.value.trim() ||
            'this review';

          const confirmed =
            confirm(
              `Delete "${name}"'s review?\n\nThis will remove it from the reviews you manage.`
            );

          if (!confirmed) {
            return;
          }

          card.remove();

          if (!container.querySelector(
            '.review-card'
          )) {
            container.innerHTML = `
              <div class="empty-state">
                No reviews have been added yet.
              </div>
            `;
          }

          setStatus(
            'Review removed from the dashboard. Click "Save Reviews" to apply the change.',
            'success'
          );
        }
      );
    });
}

function collectReviews() {
  const container =
    $('reviewsList');

  if (!container) {
    return [];
  }

  return [...container.querySelectorAll(
    '.review-card'
  )]
    .map(card => ({
      name:
        card.querySelector(
          '.review-name'
        )?.value.trim() || '',

      text:
        card.querySelector(
          '.review-text'
        )?.value.trim() || '',

      rating:
        Number(
          card.querySelector(
            '.review-rating'
          )?.value
        ) || 5
    }))
    .filter(review =>
      review.name &&
      review.text
    );
}

async function saveReviews() {
  if (!sb || !user || !isOwner(user)) {
    setStatus(
      'You are not authorized to save reviews.',
      'error'
    );

    return;
  }

  const reviews =
    collectReviews();

  setStatus(
    'Saving reviews...'
  );

  try {

    const {
      error: deleteError
    } = await sb
      .from('reviews')
      .delete()
      .neq('id', 0);

    if (deleteError) {
      throw deleteError;
    }

    if (reviews.length) {

      const {
        error: insertError
      } = await sb
        .from('reviews')
        .insert(reviews);

      if (insertError) {
        throw insertError;
      }
    }

    setStatus(
      'Reviews saved successfully.',
      'success'
    );

  } catch (err) {

    console.error(err);

    setStatus(
      err.message ||
      'Could not save reviews.',
      'error'
    );
  }
}

function addReview() {
  const container =
    $('reviewsList');

  if (!container) {
    return;
  }

  const empty =
    container.querySelector(
      '.empty-state'
    );

  if (empty) {
    empty.remove();
  }

  const card =
    document.createElement('div');

  card.className =
    'admin-card review-card';

  card.innerHTML = `

    <div class="admin-card-header">

      <strong>
        New Review
      </strong>

      <button
        type="button"
        class="danger remove-review">
        Delete Review
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

  card
    .querySelector('.remove-review')
    .addEventListener(
      'click',
      () => {

        const confirmed =
          confirm(
            'Remove this review?'
          );

        if (confirmed) {
          card.remove();
        }
      }
    );

  container.appendChild(card);

  card.querySelector(
    '.review-name'
  )?.focus();

  setStatus(
    'New review added. Fill it out and save your reviews.',
    'success'
  );
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
    setStatus(
      'You are not authorized to save settings.',
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

  try {

    const {
      error
    } = await sb
      .from('site_settings')
      .upsert(settings);

    if (error) {
      throw error;
    }

    setStatus(
      'Site settings saved successfully.',
      'success'
    );

  } catch (err) {

    console.error(err);

    setStatus(
      err.message ||
      'Could not save site settings.',
      'error'
    );
  }
}


/* =========================================================
   LOAD EXISTING WEBSITE DATA
========================================================= */

async function loadAll() {
  if (!sb || !user || !isOwner(user)) {
    return;
  }

  setStatus(
    'Loading your website data...'
  );

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

    /*
      IMPORTANT:

      Existing Supabase data is always used first.

      The default services are ONLY displayed when
      there are no services in the database yet.
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

    setStatus(
      'Website data loaded.',
      'success'
    );

  } catch (err) {

    console.error(err);

    setStatus(
      err.message ||
      'Could not load your website data.',
      'error'
    );
  }
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEventListeners() {

  /*
    Login
  */

  $('signInBtn')
    ?.addEventListener(
      'click',
      signIn
    );

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


  /*
    Logout
  */

  $('signOutBtn')
    ?.addEventListener(
      'click',
      signOut
    );


  /*
    Services
  */

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


  /*
    Gallery
  */

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


  /*
    Reviews
  */

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


  /*
    Site settings
  */

  $('saveSettings')
    ?.addEventListener(
      'click',
      saveSettings
    );
}


/* =========================================================
   AUTH STATE LISTENER
========================================================= */

function setupAuthListener() {

  if (!sb) {
    return;
  }

  sb.auth.onAuthStateChange(
    (event, session) => {

      /*
        If signed out, immediately hide the dashboard.
      */

      if (event === 'SIGNED_OUT') {

        user = null;

        showLogin();

        return;
      }

      /*
        If there is a session, ONLY an owner account
        is allowed to remain on the dashboard.
      */

      if (session?.user) {

        if (!isOwner(session.user)) {

          sb.auth.signOut();

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
      }
    }
  );
}


/* =========================================================
   CHECK EXISTING SESSION
========================================================= */

async function check() {

  if (!initializeSupabase()) {

    showSetup();

    return;
  }

  try {

    /*
      IMPORTANT:

      We check the existing Supabase session.
      We do NOT sign the user out when the page loads.

      This is what allows your owner login to remain
      active after refreshing the admin page.
    */

    const {
      data,
      error
    } = await sb.auth.getSession();

    if (error) {
      throw error;
    }

    const session =
      data?.session;

    /*
      No session = show the login page.
    */

    if (!session?.user) {

      user = null;

      showLogin();

      return;
    }

    /*
      Session exists, but the account must still
      be your configured owner account.
    */

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

    /*
      Correct authenticated owner.
    */

    user = session.user;

    showDashboard();

    await loadAll();

  } catch (err) {

    console.error(err);

    user = null;

    showLogin();

    setStatus(
      'Please sign in again.',
      'error'
    );
  }
}


/* =========================================================
   START ADMIN
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    /*
      Start with the login screen hidden/controlled
      until authentication has been checked.
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
