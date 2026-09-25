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
   BEST SIGN IN FEATURE - DO NOT CHANGE
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
      setStatus(
        'This account is not authorized to access the owner dashboard.',
        'error'
      );
      return;
    }

    user = signedInUser;

    setStatus('');
    showDashboard();

    await loadAll();

  } catch (err) {
    console.error(err);
    setStatus(
      'Unable to sign in. Please try again.',
      'error'
    );
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
    <div
      class="list-item service-item"
      data-index="${index}"
      data-existing-id="${esc(item.id || '')}">

      <div class="admin-grid">

        <div class="field">
          <label>Service name</label>
          <input
            class="service-title"
            type="text"
            value="${esc(item.title || item.name || '')}"
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

  document.querySelectorAll('.service-item').forEach((item, index) => {
    const title =
      item.querySelector('.service-title')?.value.trim() || '';

    const description =
      item.querySelector('.service-description')?.value.trim() || '';

    if (!title) return;

    items.push({
      title,
      description,
      sort_order: index,
      published: true
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
    description: '',
    sort_order: current.length,
    published: true
  });

  renderServices(current);

  const inputs = editor.querySelectorAll('.service-title');

  if (inputs.length) {
    inputs[inputs.length - 1].focus();
  }
}

async function saveServices() {
  if (!sb || !user || !isOwner(user)) {
    setStatus(
      'You must be signed in as the owner.',
      'error'
    );
    return;
  }

  const services = collectServices();

  try {
    setStatus('Saving services...');

    const { data: existing, error: existingError } = await sb
      .from('services')
      .select('id');

    if (existingError) throw existingError;

    if (existing?.length) {
      const { error: deleteError } = await sb
        .from('services')
        .delete()
        .in(
          'id',
          existing.map(row => row.id)
        );

      if (deleteError) throw deleteError;
    }

    if (services.length) {
      const { error: insertError } = await sb
        .from('services')
        .insert(services);

      if (insertError) throw insertError;
    }

    setStatus(
      'Services saved. Customers can now see the changes.',
      'success'
    );

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
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error(error);
    renderServices(defaultServices);
    return;
  }

  renderServices(data || []);
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

  const marker =
    `/storage/v1/object/public/${GALLERY_BUCKET}/`;

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
            value="${esc(
              item.title ||
              item.caption ||
              ''
            )}"
            placeholder="Example: Backyard cleanup">
        </div>

        <div class="field">
          <label>Sort order</label>
          <input
            class="gallery-sort"
            type="number"
            value="${esc(
              item.sort_order ?? index
            )}"
            min="0">
        </div>

        <div class="field full">
          <label>Current photo</label>

          <div class="current-photo-area">

            ${
              item.image_url
                ? `
                  <img
                    class="gallery-preview"
                    src="${esc(item.image_url)}"
                    alt="${esc(
                      item.title ||
                      item.caption ||
                      'Our Work photo'
                    )}"
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

      <div
        class="gallery-status muted"
        style="margin-top:10px">
      </div>

    </div>
  `).join('');

  editor.querySelectorAll('.upload-gallery')
    .forEach(button => {

      button.addEventListener('click', () => {

        const item =
          button.closest('.gallery-item');

        if (!item) return;

        const index =
          [...editor.querySelectorAll('.gallery-item')]
            .indexOf(item);

        uploadGalleryImage(index);
      });
    });

  editor.querySelectorAll('.delete-gallery')
    .forEach(button => {

      button.addEventListener('click', () => {

        const item =
          button.closest('.gallery-item');

        if (!item) return;

        const index =
          [...editor.querySelectorAll('.gallery-item')]
            .indexOf(item);

        deleteGalleryImage(index);
      });
    });
}

function collectGallery() {
  const items = [];

  document.querySelectorAll('.gallery-item')
    .forEach(item => {

      const title =
        item.querySelector('.gallery-title')
          ?.value.trim() || '';

      const image_url =
        item.querySelector('.gallery-url')
          ?.value.trim() || '';

      const sort_order =
        Number(
          item.querySelector('.gallery-sort')
            ?.value || 0
        );

      /*
        A gallery slot without an image is allowed
        while the admin is editing, but it will not
        be published until an image exists.
      */
      if (!image_url) return;

      items.push({
        title,
        caption: title,
        image_url,
        sort_order,
        published: true
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
    caption: '',
    image_url: '',
    sort_order: current.length,
    published: true
  });

  /*
    renderGallery normally removes an empty slot because
    collectGallery ignores empty image URLs. Therefore,
    create the slot directly here when adding a new photo.
  */

  const newItem = document.createElement('div');

  newItem.className =
    'list-item gallery-item';

  newItem.innerHTML = `
    <div class="admin-grid">

      <div class="field">
        <label>Photo title</label>
        <input
          class="gallery-title"
          type="text"
          placeholder="Example: Backyard cleanup">
      </div>

      <div class="field">
        <label>Sort order</label>
        <input
          class="gallery-sort"
          type="number"
          value="${current.length - 1}"
          min="0">
      </div>

      <div class="field full">
        <label>Current photo</label>

        <div class="current-photo-area">
          <div class="muted">
            No photo uploaded yet.
          </div>
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
          value="">
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

    <div
      class="gallery-status muted"
      style="margin-top:10px">
    </div>
  `;

  editor.appendChild(newItem);

  newItem
    .querySelector('.upload-gallery')
    .addEventListener('click', () => {

      const items =
        [...editor.querySelectorAll('.gallery-item')];

      uploadGalleryImage(items.indexOf(newItem));
    });

  newItem
    .querySelector('.delete-gallery')
    .addEventListener('click', () => {

      const confirmed = confirm(
        'Delete this new photo slot?'
      );

      if (confirmed) {
        newItem.remove();
      }
    });

  newItem.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });

  newItem
    .querySelector('.gallery-title')
    ?.focus();
}

async function uploadGalleryImage(index) {
  if (!sb || !user || !isOwner(user)) {
    setStatus(
      'You must be signed in as the owner.',
      'error'
    );
    return;
  }

  const items =
    document.querySelectorAll('.gallery-item');

  const item = items[index];

  if (!item) return;

  const fileInput =
    item.querySelector('.gallery-file');

  const urlInput =
    item.querySelector('.gallery-url');

  const status =
    item.querySelector('.gallery-status');

  const file =
    fileInput?.files?.[0];

  if (!file) {

    if (status) {
      status.textContent =
        'Choose a photo first.';

      status.style.color = '#9d2c2c';
    }

    return;
  }

  if (!file.type.startsWith('image/')) {

    if (status) {
      status.textContent =
        'Please choose an image file.';

      status.style.color = '#9d2c2c';
    }

    return;
  }

  if (file.size > 10 * 1024 * 1024) {

    if (status) {
      status.textContent =
        'Photo must be 10 MB or smaller.';

      status.style.color = '#9d2c2c';
    }

    return;
  }

  try {

    if (status) {
      status.textContent =
        'Uploading photo...';

      status.style.color = '';
      status.style.fontWeight = '';
    }

    const oldUrl =
      urlInput?.value || '';

    const path =
      createGalleryFileName(file);

    const {
      error: uploadError
    } = await sb.storage
      .from(GALLERY_BUCKET)
      .upload(
        path,
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

    const {
      data: publicData
    } = sb.storage
      .from(GALLERY_BUCKET)
      .getPublicUrl(path);

    const publicUrl =
      publicData?.publicUrl;

    if (!publicUrl) {
      throw new Error(
        'Could not create the public image URL.'
      );
    }

    if (urlInput) {
      urlInput.value =
        publicUrl;
    }

    let previewEl =
      item.querySelector('.gallery-preview');

    if (!previewEl) {

      const currentPhotoArea =
        item.querySelector(
          '.current-photo-area'
        );

      if (currentPhotoArea) {

        currentPhotoArea.innerHTML = '';

        const image =
          document.createElement('img');

        image.className =
          'gallery-preview';

        image.style.display =
          'block';

        image.style.width =
          '100%';

        image.style.maxWidth =
          '500px';

        image.style.maxHeight =
          '300px';

        image.style.objectFit =
          'cover';

        image.style.borderRadius =
          '6px';

        image.style.marginBottom =
          '10px';

        image.style.border =
          '1px solid #d6ddd4';

        currentPhotoArea.appendChild(
          image
        );

        previewEl = image;
      }
    }

    if (previewEl) {

      previewEl.src =
        publicUrl;

      previewEl.alt =
        item.querySelector(
          '.gallery-title'
        )?.value.trim() ||
        'Our Work photo';
    }

    /*
      IMPORTANT:
      The old storage image is NOT deleted here.

      That means if the admin uploads a replacement
      but decides not to save the gallery, the old
      saved image is still safe.

      The new image becomes the slot's current draft.
    */

    if (status) {

      status.textContent =
        'Photo uploaded. Click "Save gallery" to publish this change.';

      status.style.color =
        '#287719';

      status.style.fontWeight =
        '800';
    }

  } catch (err) {

    console.error(err);

    if (status) {

      status.textContent =
        `Upload failed: ${
          err.message ||
          'Unknown error'
        }`;

      status.style.color =
        '#9d2c2c';

      status.style.fontWeight =
        '800';
    }
  }
}

async function deleteGalleryImage(index) {
  if (!sb || !user || !isOwner(user)) {
    setStatus(
      'You must be signed in as the owner.',
      'error'
    );
    return;
  }

  const items =
    document.querySelectorAll('.gallery-item');

  const item =
    items[index];

  if (!item) return;

  const title =
    item.querySelector(
      '.gallery-title'
    )?.value.trim() ||
    'this photo';

  const url =
    item.querySelector(
      '.gallery-url'
    )?.value.trim() ||
    '';

  const confirmed =
    confirm(
      `Delete "${title}"?\n\nThis will remove the photo from the gallery.`
    );

  if (!confirmed) return;

  try {

    /*
      Delete the database record first.
    */

    if (url) {

      const {
        error: dbError
      } = await sb
        .from('gallery')
        .delete()
        .eq(
          'image_url',
          url
        );

      if (dbError) {
        throw dbError;
      }
    }

    /*
      Remove the storage file too.
    */

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
          'Storage delete failed:',
          storageError
        );
      }
    }

    await loadGallery();

    setStatus(
      'Photo deleted.',
      'success'
    );

  } catch (err) {

    console.error(err);

    setStatus(
      `Could not delete photo: ${
        err.message ||
        'Unknown error'
      }`,
      'error'
    );
  }
}

async function saveGallery() {
  if (!sb || !user || !isOwner(user)) {
    setStatus(
      'You must be signed in as the owner.',
      'error'
    );
    return;
  }

  const gallery =
    collectGallery();

  try {

    setStatus(
      'Saving gallery...'
    );

    const {
      data: existing,
      error: existingError
    } = await sb
      .from('gallery')
      .select('*');

    if (existingError) {
      throw existingError;
    }

    /*
      Save the new database version first.
    */

    if (existing?.length) {

      const {
        error: deleteError
      } = await sb
        .from('gallery')
        .delete()
        .in(
          'id',
          existing.map(
            row => row.id
          )
        );

      if (deleteError) {
        throw deleteError;
      }
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

    /*
      Remove storage files that are no longer
      referenced by the saved gallery.
    */

    const oldUrls =
      (existing || [])
        .map(row => row.image_url)
        .filter(Boolean);

    const newUrls =
      gallery
        .map(row => row.image_url)
        .filter(Boolean);

    const removedUrls =
      oldUrls.filter(
        url => !newUrls.includes(url)
      );

    for (const oldUrl of removedUrls) {

      const oldPath =
        getStoragePathFromPublicUrl(
          oldUrl
        );

      if (oldPath) {

        await sb.storage
          .from(GALLERY_BUCKET)
          .remove([oldPath])
          .catch(err => {
            console.warn(
              'Old image cleanup failed:',
              err
            );
          });
      }
    }

    setStatus(
      'Gallery saved. Customers can now see the changes.',
      'success'
    );

    await loadGallery();

  } catch (err) {

    console.error(err);

    setStatus(
      `Could not save gallery: ${
        err.message ||
        'Unknown error'
      }`,
      'error'
    );
  }
}

async function loadGallery() {

  const {
    data,
    error
  } = await sb
    .from('gallery')
    .select('*')
    .order(
      'sort_order',
      {
        ascending: true
      }
    )
    .order(
      'id',
      {
        ascending: true
      }
    );

  if (error) {

    console.error(error);

    renderGallery([]);

    return;
  }

  renderGallery(
    data || []
  );
}


/* -------------------------------------------------
   REVIEWS
------------------------------------------------- */

function ensureAddReviewButton() {

  const editor =
    $('reviewsEditor');

  if (!editor) return;

  if ($('addReview')) return;

  const button =
    document.createElement('button');

  button.type =
    'button';

  button.id =
    'addReview';

  button.className =
    'admin-btn';

  button.textContent =
    'Add Review';

  button.addEventListener(
    'click',
    event => {

      event.preventDefault();

      addReview();
    }
  );

  editor.parentElement?.insertBefore(
    button,
    editor
  );
}

function renderReviews(items) {

  const editor =
    $('reviewsEditor');

  if (!editor) return;

  ensureAddReviewButton();

  if (!items.length) {

    editor.innerHTML = `
      <div class="muted">
        No reviews have been added yet.
      </div>
    `;

    return;
  }

  editor.innerHTML =
    items.map(
      (item, index) => `

      <div
        class="list-item review-item"
        data-index="${index}"
        data-existing-id="${esc(item.id || '')}">

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
            <label>Review title</label>

            <input
              class="review-title"
              type="text"
              value="${esc(item.title || '')}"
              placeholder="Example: Great service">
          </div>

          <div class="field">
            <label>Rating</label>

            <select
              class="review-rating">

              ${[5,4,3,2,1]
                .map(
                  rating => `

                  <option
                    value="${rating}"
                    ${
                      Number(
                        item.rating || 5
                      ) === rating
                        ? 'selected'
                        : ''
                    }>
                    ${rating} stars
                  </option>

                `
                )
                .join('')}

            </select>
          </div>

          <div class="field full">
            <label>Review</label>

            <textarea
              class="review-text"
              placeholder="Customer's actual review">${esc(
                item.text ||
                item.review ||
                ''
              )}</textarea>
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
    `
    ).join('');

  editor
    .querySelectorAll(
      '.delete-review'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const item =
            button.closest(
              '.review-item'
            );

          if (!item) return;

          const name =
            item.querySelector(
              '.review-name'
            )?.value.trim() ||
            'this review';

          const confirmed =
            confirm(
              `Delete "${name}"?\n\nThis review will be removed when you save the reviews.`
            );

          if (!confirmed) return;

          item.remove();

          if (
            !editor.querySelector(
              '.review-item'
            )
          ) {
            renderReviews([]);
          }
        }
      );
    });
}

function collectReviews() {

  const reviews = [];

  document
    .querySelectorAll(
      '.review-item'
    )
    .forEach(item => {

      const name =
        item.querySelector(
          '.review-name'
        )?.value.trim() ||
        '';

      const title =
        item.querySelector(
          '.review-title'
        )?.value.trim() ||
        '';

      const rating =
        Number(
          item.querySelector(
            '.review-rating'
          )?.value ||
          5
        );

      const text =
        item.querySelector(
          '.review-text'
        )?.value.trim() ||
        '';

      if (!text) return;

      reviews.push({
        name,
        title,
        text,
        rating,
        sort_order: reviews.length,
        published: true
      });
    });

  return reviews;
}

function addReview() {

  const editor =
    $('reviewsEditor');

  if (!editor) return;

  const current =
    collectReviews();

  current.push({
    name: '',
    title: '',
    rating: 5,
    text: '',
    sort_order: current.length,
    published: true
  });

  renderReviews(
    current
  );

  const textareas =
    editor.querySelectorAll(
      '.review-text'
    );

  if (textareas.length) {

    textareas[
      textareas.length - 1
    ].focus();
  }
}

async function saveReviews() {

  if (!sb || !user || !isOwner(user)) {

    setStatus(
      'You must be signed in as the owner.',
      'error'
    );

    return;
  }

  const reviews =
    collectReviews();

  try {

    setStatus(
      'Saving reviews...'
    );

    const {
      data: existing,
      error: existingError
    } = await sb
      .from('reviews')
      .select('id');

    if (existingError) {
      throw existingError;
    }

    if (existing?.length) {

      const {
        error: deleteError
      } = await sb
        .from('reviews')
        .delete()
        .in(
          'id',
          existing.map(
            row => row.id
          )
        );

      if (deleteError) {
        throw deleteError;
      }
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
      'Reviews saved. Customers can now see the changes.',
      'success'
    );

    await loadReviews();

  } catch (err) {

    console.error(err);

    setStatus(
      `Could not save reviews: ${
        err.message ||
        'Unknown error'
      }`,
      'error'
    );
  }
}

async function loadReviews() {

  const {
    data,
    error
  } = await sb
    .from('reviews')
    .select('*')
    .order(
      'sort_order',
      {
        ascending: true
      }
    )
    .order(
      'id',
      {
        ascending: true
      }
    );

  if (error) {

    console.error(error);

    renderReviews(
      defaultReviews
    );

    return;
  }

  renderReviews(
    data || []
  );
}


/* -------------------------------------------------
   SITE SETTINGS
------------------------------------------------- */

function renderSettings(settings) {

  if (!settings) return;

  if ($('googleUrl')) {

    $('googleUrl').value =
      settings.google_review_url ||
      '';
  }

  if ($('leaveReviewUrl')) {

    $('leaveReviewUrl').value =
      settings.leave_review_url ||
      '';
  }

  if ($('areaText')) {

    $('areaText').value =
      settings.service_area_text ||
      '';
  }
}

async function saveSettings() {

  if (!sb || !user || !isOwner(user)) {

    setStatus(
      'You must be signed in as the owner.',
      'error'
    );

    return;
  }

  const values = {

    id: 1,

    google_review_url:
      $('googleUrl')
        ?.value.trim() ||
      '',

    leave_review_url:
      $('leaveReviewUrl')
        ?.value.trim() ||
      '',

    service_area_text:
      $('areaText')
        ?.value.trim() ||
      ''
  };

  try {

    setSectionStatus(
      'settingsStatus',
      'Saving settings...'
    );

    const {
      error
    } = await sb
      .from('site_settings')
      .upsert(
        values,
        {
          onConflict: 'id'
        }
      );

    if (error) {
      throw error;
    }

    setSectionStatus(
      'settingsStatus',
      'Settings saved. Customers can now see the changes.',
      'success'
    );

  } catch (err) {

    console.error(err);

    setSectionStatus(
      'settingsStatus',
      `Could not save settings: ${
        err.message ||
        'Unknown error'
      }`,
      'error'
    );
  }
}

async function loadSettings() {

  const {
    data,
    error
  } = await sb
    .from('site_settings')
    .select('*')
    .eq(
      'id',
      1
    )
    .maybeSingle();

  if (error) {

    console.error(error);

    return;
  }

  renderSettings(
    data || {}
  );
}


/* -------------------------------------------------
   LOAD EVERYTHING
------------------------------------------------- */

async function loadAll() {

  if (
    !sb ||
    !user ||
    !isOwner(user)
  ) {
    return;
  }

  try {

    await Promise.all([
      loadServices(),
      loadGallery(),
      loadReviews(),
      loadSettings()
    ]);

  } catch (err) {

    console.error(
      'Dashboard loading error:',
      err
    );

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

  const signInBtn =
    $('signInBtn');

  if (signInBtn) {

    signInBtn.addEventListener(
      'click',
      event => {

        event.preventDefault();

        signIn();
      }
    );
  }

  const passwordInput =
    $('passwordInput');

  if (passwordInput) {

    passwordInput.addEventListener(
      'keydown',
      event => {

        if (
          event.key === 'Enter'
        ) {

          event.preventDefault();

          signIn();
        }
      }
    );
  }

  const emailInput =
    $('emailInput');

  if (emailInput) {

    emailInput.addEventListener(
      'keydown',
      event => {

        if (
          event.key === 'Enter'
        ) {

          event.preventDefault();

          signIn();
        }
      }
    );
  }

  const signOutBtn =
    $('signOut');

  if (signOutBtn) {

    signOutBtn.addEventListener(
      'click',
      event => {

        event.preventDefault();

        signOut();
      }
    );
  }

  const saveSettingsBtn =
    $('saveSettings');

  if (saveSettingsBtn) {

    saveSettingsBtn.addEventListener(
      'click',
      event => {

        event.preventDefault();

        saveSettings();
      }
    );
  }

  const addServiceBtn =
    $('addService');

  if (addServiceBtn) {

    addServiceBtn.addEventListener(
      'click',
      event => {

        event.preventDefault();

        addService();
      }
    );
  }

  const saveServicesBtn =
    $('saveServices');

  if (saveServicesBtn) {

    saveServicesBtn.addEventListener(
      'click',
      event => {

        event.preventDefault();

        saveServices();
      }
    );
  }

  const addGalleryBtn =
    $('addGallery');

  if (addGalleryBtn) {

    addGalleryBtn.addEventListener(
      'click',
      event => {

        event.preventDefault();

        addGallery();
      }
    );
  }

  const saveGalleryBtn =
    $('saveGallery');

  if (saveGalleryBtn) {

    saveGalleryBtn.addEventListener(
      'click',
      event => {

        event.preventDefault();

        saveGallery();
      }
    );
  }

  /*
    Your current admin.html does not have an
    Add Review button.

    renderReviews() creates one automatically,
    so you do NOT need to change admin.html.
  */

  const saveReviewsBtn =
    $('saveReviews');

  if (saveReviewsBtn) {

    saveReviewsBtn.addEventListener(
      'click',
      event => {

        event.preventDefault();

        saveReviews();
      }
    );
  }
}


/* -------------------------------------------------
   INITIAL CHECK
------------------------------------------------- */

async function check() {

  if (
    !C.SUPABASE_URL ||
    !C.SUPABASE_ANON_KEY ||
    !C.OWNER_EMAIL
  ) {

    showSetup();

    return;
  }

  if (!initializeSupabase()) {

    showSetup();

    return;
  }

  /*
    IMPORTANT:

    The admin page must require the password every
    time it is opened or refreshed.

    This is intentionally kept exactly as the
    working "best sign in feature" behavior.
  */

  try {

    await sb.auth.signOut();

  } catch (err) {

    console.error(
      'Could not clear previous session:',
      err
    );
  }

  user = null;

  showLogin();

  if ($('passwordInput')) {

    $('passwordInput').value =
      '';
  }

  setStatus('');
}


/* -------------------------------------------------
   START
------------------------------------------------- */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    showLogin();

    setupEventListeners();

    if (
      !C.SUPABASE_URL ||
      !C.SUPABASE_ANON_KEY ||
      !C.OWNER_EMAIL
    ) {

      showSetup();

      return;
    }

    if (!initializeSupabase()) {

      showSetup();

      return;
    }

    await check();
  }
);
