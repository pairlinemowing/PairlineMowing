alert("ADMIN JS LOADED");

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

/* -------------------------------------------------
   SCREEN CONTROL
------------------------------------------------- */

function showLogin() {
  if ($('login')) {
    $('login').hidden = false;
    $('login').style.display = '';
  }

  if ($('dashboard')) {
    $('dashboard').hidden = true;
    $('dashboard').style.display = 'none';
  }

  if ($('setupNotice')) {
    $('setupNotice').hidden = true;
    $('setupNotice').style.display = 'none';
  }
}

function showDashboard() {
  if ($('login')) {
    $('login').hidden = true;
    $('login').style.display = 'none';
  }

  if ($('dashboard')) {
    $('dashboard').hidden = false;
    $('dashboard').style.display = '';
  }

  if ($('setupNotice')) {
    $('setupNotice').hidden = true;
    $('setupNotice').style.display = 'none';
  }
}

function showSetup() {
  if ($('login')) {
    $('login').hidden = true;
    $('login').style.display = 'none';
  }

  if ($('dashboard')) {
    $('dashboard').hidden = true;
    $('dashboard').style.display = 'none';
  }

  if ($('setupNotice')) {
    $('setupNotice').hidden = false;
    $('setupNotice').style.display = '';
  }
}

function setStatus(message = '', type = '') {
  const el = $('loginStatus');

  if (!el) return;

  el.textContent = message;
  el.className = type ? `status ${type}` : 'status';
}

/* -------------------------------------------------
   SUPABASE
------------------------------------------------- */

function initializeSupabase() {

  if (
    !C.SUPABASE_URL ||
    !C.SUPABASE_ANON_KEY ||
    !window.supabase
  ) {
    return false;
  }

  if (!sb) {
    sb = window.supabase.createClient(
      C.SUPABASE_URL,
      C.SUPABASE_ANON_KEY
    );
  }

  return true;
}

function isOwner(signedInUser) {

  if (!signedInUser) {
    return false;
  }

  const ownerEmail =
    String(C.OWNER_EMAIL || '')
      .trim()
      .toLowerCase();

  const signedInEmail =
    String(signedInUser.email || '')
      .trim()
      .toLowerCase();

  return (
    ownerEmail &&
    signedInEmail === ownerEmail
  );
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
   SESSION CHECK
   BEST SIGN IN FEATURE - DO NOT CHANGE
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
   SIGN OUT
------------------------------------------------- */

async function signOut() {

  try {

    if (sb) {
      await sb.auth.signOut();
    }

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
   STATUS HELPERS
------------------------------------------------- */

function setEditorStatus(id, message, type = '') {

  const el = $(id);

  if (!el) return;

  el.textContent = message;

  el.className =
    type
      ? `status ${type}`
      : 'status';
}

/* -------------------------------------------------
   SERVICES
------------------------------------------------- */

const defaultServices = [
  {
    title: 'Lawn Mowing',
    description:
      'Consistent mowing to keep your lawn clean, even, and well maintained.',
    sort_order: 1
  },
  {
    title: 'Edging',
    description:
      'Crisp edges along sidewalks, driveways, and lawn borders for a finished look.',
    sort_order: 2
  },
  {
    title: 'Weed Whacking',
    description:
      'Detailed trimming around areas a mower cannot reach for a cleaner property.',
    sort_order: 3
  },
  {
    title: 'Gutter Cleaning',
    description:
      'Help keep gutters clear of leaves and debris so water can flow properly.',
    sort_order: 4
  },
  {
    title: 'Lawn Mower Repairs',
    description:
      'Repair help for lawn mowers and related equipment. Contact us with the issue.',
    sort_order: 5
  },
  {
    title: 'Whipper & Equipment Repairs',
    description:
      'Repair help for whippers and other lawn equipment. Contact us to discuss your equipment.',
    sort_order: 6
  }
];

function renderServicesEditor(items = []) {

  const editor = $('servicesEditor');

  if (!editor) return;

  editor.innerHTML = '';

  items.forEach((item, index) => {

    const row = document.createElement('div');

    row.className = 'admin-item service-editor-item';

    row.dataset.id =
      item.id || '';

    row.innerHTML = `
      <div class="admin-item-header">
        <strong>Service ${index + 1}</strong>

        <button
          type="button"
          class="delete-service"
        >
          Delete
        </button>
      </div>

      <label>
        Service Name
        <input
          type="text"
          class="service-title"
          value="${esc(item.title || item.name || '')}"
        >
      </label>

      <label>
        Description
        <textarea
          class="service-description"
          rows="4"
        >${esc(item.description || '')}</textarea>
      </label>

      <label>
        Display Order
        <input
          type="number"
          class="service-order"
          value="${Number(item.sort_order) || index + 1}"
          min="1"
        >
      </label>
    `;

    editor.appendChild(row);
  });

  editor
    .querySelectorAll('.delete-service')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const row =
            button.closest('.service-editor-item');

          if (row) {
            row.remove();
          }
        }
      );

    });
}

function addService() {

  const editor =
    $('servicesEditor');

  if (!editor) return;

  const count =
    editor.querySelectorAll(
      '.service-editor-item'
    ).length;

  const row =
    document.createElement('div');

  row.className =
    'admin-item service-editor-item';

  row.innerHTML = `
    <div class="admin-item-header">
      <strong>New Service</strong>

      <button
        type="button"
        class="delete-service"
      >
        Delete
      </button>
    </div>

    <label>
      Service Name
      <input
        type="text"
        class="service-title"
        value=""
      >
    </label>

    <label>
      Description
      <textarea
        class="service-description"
        rows="4"
      ></textarea>
    </label>

    <label>
      Display Order
      <input
        type="number"
        class="service-order"
        value="${count + 1}"
        min="1"
      >
    </label>
  `;

  editor.appendChild(row);

  row
    .querySelector('.delete-service')
    .addEventListener(
      'click',
      () => row.remove()
    );
}

function collectServices() {

  const editor =
    $('servicesEditor');

  if (!editor) return [];

  return [
    ...editor.querySelectorAll(
      '.service-editor-item'
    )
  ]
    .map((row, index) => {

      const title =
        row
          .querySelector('.service-title')
          ?.value
          .trim() || '';

      const description =
        row
          .querySelector('.service-description')
          ?.value
          .trim() || '';

      const sortOrder =
        Number(
          row
            .querySelector('.service-order')
            ?.value
        ) || index + 1;

      return {
        id:
          row.dataset.id || null,

        title,

        description,

        sort_order:
          sortOrder,

        published:
          true
      };

    })
    .filter(item => item.title);
}

/* -------------------------------------------------
   SAVE SERVICES
------------------------------------------------- */

async function saveServices() {

  if (!sb || !user) {
    setEditorStatus(
      'settingsStatus',
      'You must be signed in.',
      'error'
    );
    return;
  }

  const items =
    collectServices();

  const button =
    $('saveServices');

  if (button) {
    button.disabled = true;
    button.textContent = 'Saving...';
  }

  try {

    const savedIds = [];

    for (const item of items) {

      const payload = {
        name: item.title,
        description: item.description,
        sort_order: item.sort_order,
        published: true
      };

      let result;

      if (item.id) {

        result = await sb
          .from('services')
          .update(payload)
          .eq('id', item.id)
          .select()
          .single();

      } else {

        result = await sb
          .from('services')
          .insert(payload)
          .select()
          .single();

      }

      if (result.error) {
        throw result.error;
      }

      if (result.data?.id) {
        savedIds.push(result.data.id);
      }
    }

    const {
      data: existingRows,
      error: existingError
    } = await sb
      .from('services')
      .select('id');

    if (existingError) {
      throw existingError;
    }

    const idsToDelete =
      (existingRows || [])
        .map(row => row.id)
        .filter(
          id =>
            !savedIds.includes(id)
        );

    if (idsToDelete.length) {

      const {
        error: deleteError
      } = await sb
        .from('services')
        .delete()
        .in(
          'id',
          idsToDelete
        );

      if (deleteError) {
        throw deleteError;
      }
    }

    await loadServices();

    setEditorStatus(
      'settingsStatus',
      'Services saved successfully.',
      'success'
    );

  } catch (err) {

    console.error(
      'Could not save services:',
      err
    );

    setEditorStatus(
      'settingsStatus',
      `Services could not be saved: ${err.message || err}`,
      'error'
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = 'Save Services';
    }
  }
}

async function loadServices() {

  if (!sb) return;

  const {
    data,
    error
  } = await sb
    .from('services')
    .select('*')
    .order('sort_order');

  if (error) {

    console.error(
      'Could not load services:',
      error
    );

    renderServicesEditor(
      defaultServices
    );

    return;
  }

  if (data?.length) {

    renderServicesEditor(
      data
    );

  } else {

    renderServicesEditor(
      defaultServices
    );
  }
}

/* -------------------------------------------------
   GALLERY
------------------------------------------------- */

let removedGalleryIds = [];
let replacedGalleryOldUrls = [];

function renderGalleryEditor(items = []) {

  const editor =
    $('galleryEditor');

  if (!editor) return;

  editor.innerHTML = '';

  removedGalleryIds = [];
  replacedGalleryOldUrls = [];

  items.forEach((item, index) => {

    createGallerySlot(
      item,
      index
    );

  });
}

function createGallerySlot(
  item = {},
  index = 0
) {

  const editor =
    $('galleryEditor');

  if (!editor) return;

  const row =
    document.createElement('div');

  row.className =
    'admin-item gallery-editor-item';

  row.dataset.id =
    item.id || '';

  row.dataset.originalUrl =
    item.image_url || '';

  row.innerHTML = `
    <div class="admin-item-header">
      <strong>Photo ${index + 1}</strong>

      <button
        type="button"
        class="delete-gallery"
      >
        Delete
      </button>
    </div>

    <label>
      Picture Title
      <input
        type="text"
        class="gallery-title"
        value="${esc(
          item.title ||
          item.caption ||
          ''
        )}"
      >
    </label>

    <label>
      Choose Image
      <input
        type="file"
        class="gallery-file"
        accept="image/*"
      >
    </label>

    <input
      type="hidden"
      class="gallery-url"
      value="${esc(
        item.image_url || ''
      )}"
    >

    <label>
      Display Order
      <input
        type="number"
        class="gallery-order"
        value="${Number(item.sort_order) || index + 1}"
        min="1"
      >
    </label>

    <div class="gallery-preview-wrap">
      ${
        item.image_url
          ? `
            <img
              class="gallery-preview"
              src="${esc(item.image_url)}"
              alt="${esc(
                item.title ||
                item.caption ||
                'Gallery preview'
              )}"
            >
          `
          : `
            <div class="gallery-no-image">
              No image selected
            </div>
          `
      }
    </div>
  `;

  editor.appendChild(row);

  const fileInput =
    row.querySelector('.gallery-file');

  fileInput.addEventListener(
    'change',
    async () => {

      const file =
        fileInput.files?.[0];

      if (!file) return;

      await uploadGalleryImage(
        row,
        file
      );
    }
  );

  row
    .querySelector('.delete-gallery')
    .addEventListener(
      'click',
      () => {

        const id =
          row.dataset.id;

        /*
          Delete only from the editor.
          Database changes happen on Save Gallery.
        */

        if (id) {
          removedGalleryIds.push(id);
        }

        row.remove();
      }
    );
}

function addGallery() {

  const editor =
    $('galleryEditor');

  if (!editor) return;

  const count =
    editor.querySelectorAll(
      '.gallery-editor-item'
    ).length;

  createGallerySlot(
    {
      title: '',
      image_url: '',
      sort_order: count + 1
    },
    count
  );
}

async function uploadGalleryImage(
  row,
  file
) {

  if (!sb || !user) {
    alert(
      'You must be signed in to upload an image.'
    );
    return;
  }

  const oldUrl =
    row.dataset.originalUrl || '';

  const safeName =
    file.name
      .replace(/[^a-zA-Z0-9._-]/g, '-');

  const path =
    `gallery/${Date.now()}-${safeName}`;

  const fileInput =
    row.querySelector('.gallery-file');

  const preview =
    row.querySelector('.gallery-preview-wrap');

  try {

    if (fileInput) {
      fileInput.disabled = true;
    }

    if (preview) {
      preview.innerHTML =
        '<div class="gallery-no-image">Uploading...</div>';
    }

    const {
      error
    } = await sb.storage
      .from('SITE-IMAGES')
      .upload(
        path,
        file,
        {
          upsert: false,
          contentType: file.type
        }
      );

    if (error) {
      throw error;
    }

    const {
      data
    } = sb.storage
      .from('SITE-IMAGES')
      .getPublicUrl(path);

    const publicUrl =
      data?.publicUrl;

    if (!publicUrl) {
      throw new Error(
        'Could not create image URL.'
      );
    }

    /*
      New image is NOT published until
      Save Gallery is clicked.
    */

    const urlInput =
      row.querySelector('.gallery-url');

    if (urlInput) {
      urlInput.value =
        publicUrl;
    }

    if (oldUrl) {
      replacedGalleryOldUrls.push(
        oldUrl
      );
    }

    if (preview) {

      preview.innerHTML = `
        <img
          class="gallery-preview"
          src="${esc(publicUrl)}"
          alt="Gallery preview"
        >
      `;
    }

  } catch (err) {

    console.error(
      'Gallery upload failed:',
      err
    );

    if (preview) {
      preview.innerHTML =
        '<div class="gallery-no-image">Upload failed</div>';
    }

    alert(
      `Image upload failed: ${err.message || err}`
    );

  } finally {

    if (fileInput) {
      fileInput.disabled = false;
    }
  }
}

function collectGallery() {

  const editor =
    $('galleryEditor');

  if (!editor) return [];

  return [
    ...editor.querySelectorAll(
      '.gallery-editor-item'
    )
  ]
    .map((row, index) => {

      const title =
        row
          .querySelector('.gallery-title')
          ?.value
          .trim() || '';

      const imageUrl =
        row
          .querySelector('.gallery-url')
          ?.value
          .trim() || '';

      const sortOrder =
        Number(
          row
            .querySelector('.gallery-order')
            ?.value
        ) || index + 1;

      return {

        id:
          row.dataset.id || null,

        title,

        image_url:
          imageUrl,

        sort_order:
          sortOrder,

        published:
          true
      };

    })
    .filter(item => item.image_url);
}

/* -------------------------------------------------
   SAVE GALLERY
------------------------------------------------- */

async function saveGallery() {

  if (!sb || !user) {
    setEditorStatus(
      'settingsStatus',
      'You must be signed in.',
      'error'
    );
    return;
  }

  const items =
    collectGallery();

  const button =
    $('saveGallery');

  if (button) {
    button.disabled = true;
    button.textContent = 'Saving...';
  }

  try {

    const savedIds = [];

    for (const item of items) {

      const payload = {

        title:
          item.title,

        caption:
          item.title,

        image_url:
          item.image_url,

        sort_order:
          item.sort_order,

        published:
          true
      };

      let result;

      if (item.id) {

        result = await sb
          .from('gallery')
          .update(payload)
          .eq('id', item.id)
          .select()
          .single();

      } else {

        result = await sb
          .from('gallery')
          .insert(payload)
          .select()
          .single();

      }

      if (result.error) {
        throw result.error;
      }

      if (result.data?.id) {
        savedIds.push(
          result.data.id
        );
      }
    }

    /*
      Only delete rows after all updates/inserts
      have succeeded.
    */

    if (removedGalleryIds.length) {

      const {
        error
      } = await sb
        .from('gallery')
        .delete()
        .in(
          'id',
          removedGalleryIds
        );

      if (error) {
        throw error;
      }
    }

    await loadGallery();

    setEditorStatus(
      'settingsStatus',
      'Our Work saved successfully.',
      'success'
    );

  } catch (err) {

    console.error(
      'Could not save gallery:',
      err
    );

    setEditorStatus(
      'settingsStatus',
      `Our Work could not be saved: ${err.message || err}`,
      'error'
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = 'Save gallery';
    }
  }
}

async function loadGallery() {

  if (!sb) return;

  const {
    data,
    error
  } = await sb
    .from('gallery')
    .select('*')
    .order('sort_order');

  if (error) {

    console.error(
      'Could not load gallery:',
      error
    );

    return;
  }

  renderGalleryEditor(
    data || []
  );
}

/* -------------------------------------------------
   REVIEWS
------------------------------------------------- */

function ensureAddReviewButton() {

  if ($('addReview')) {
    return;
  }

  const editor =
    $('reviewsEditor');

  if (!editor) return;

  const button =
    document.createElement('button');

  button.type = 'button';
  button.id = 'addReview';
  button.textContent = 'Add Review';
  button.className = 'admin-btn secondary';

  editor.parentElement?.insertBefore(
    button,
    editor
  );

  button.addEventListener(
    'click',
    addReview
  );
}

function renderReviewsEditor(items = []) {

  const editor =
    $('reviewsEditor');

  if (!editor) return;

  editor.innerHTML = '';

  items.forEach(
    (item, index) => {

      createReviewItem(
        item,
        index
      );

    }
  );

  ensureAddReviewButton();
}

function createReviewItem(
  item = {},
  index = 0
) {

  const editor =
    $('reviewsEditor');

  if (!editor) return;

  const row =
    document.createElement('div');

  row.className =
    'admin-item review-editor-item';

  row.dataset.id =
    item.id || '';

  row.innerHTML = `
    <div class="admin-item-header">
      <strong>Review ${index + 1}</strong>

      <button
        type="button"
        class="delete-review"
      >
        Delete
      </button>
    </div>

    <label>
      Customer Name
      <input
        type="text"
        class="review-name"
        value="${esc(item.name || '')}"
      >
    </label>

    <label>
      Review Title
      <input
        type="text"
        class="review-title"
        value="${esc(item.title || '')}"
      >
    </label>

    <label>
      Rating
      <input
        type="number"
        class="review-rating"
        value="${Number(item.rating) || 5}"
        min="1"
        max="5"
      >
    </label>

    <label>
      Review
      <textarea
        class="review-text"
        rows="7"
      >${esc(item.text || '')}</textarea>
    </label>

    <label>
      Display Order
      <input
        type="number"
        class="review-order"
        value="${Number(item.sort_order) || index + 1}"
        min="1"
      >
    </label>
  `;

  editor.appendChild(row);

  row
    .querySelector('.delete-review')
    .addEventListener(
      'click',
      () => row.remove()
    );
}

function addReview() {

  const editor =
    $('reviewsEditor');

  if (!editor) return;

  const count =
    editor.querySelectorAll(
      '.review-editor-item'
    ).length;

  createReviewItem(
    {
      name: '',
      title: '',
      rating: 5,
      text: '',
      sort_order: count + 1
    },
    count
  );
}

function collectReviews() {

  const editor =
    $('reviewsEditor');

  if (!editor) return [];

  return [
    ...editor.querySelectorAll(
      '.review-editor-item'
    )
  ]
    .map((row, index) => {

      const name =
        row
          .querySelector('.review-name')
          ?.value
          .trim() || '';

      const title =
        row
          .querySelector('.review-title')
          ?.value
          .trim() || '';

      const rating =
        Math.max(
          1,
          Math.min(
            5,
            Number(
              row
                .querySelector('.review-rating')
                ?.value
            ) || 5
          )
        );

      const text =
        row
          .querySelector('.review-text')
          ?.value
          .trim() || '';

      const sortOrder =
        Number(
          row
            .querySelector('.review-order')
            ?.value
        ) || index + 1;

      return {

        id:
          row.dataset.id || null,

        name,

        title,

        rating,

        text,

        sort_order:
          sortOrder,

        published:
          true
      };

    })
    .filter(
      item =>
        item.name &&
        item.text
    );
}

/* -------------------------------------------------
   SAVE REVIEWS
------------------------------------------------- */

async function saveReviews() {

  if (!sb || !user) {
    setEditorStatus(
      'settingsStatus',
      'You must be signed in.',
      'error'
    );
    return;
  }

  const items =
    collectReviews();

  const button =
    $('saveReviews');

  if (button) {
    button.disabled = true;
    button.textContent = 'Saving...';
  }

  try {

    const savedIds = [];

    for (const item of items) {

      const payload = {

        name:
          item.name,

        title:
          item.title,

        rating:
          item.rating,

        text:
          item.text,

        sort_order:
          item.sort_order,

        published:
          true
      };

      let result;

      if (item.id) {

        result = await sb
          .from('reviews')
          .update(payload)
          .eq('id', item.id)
          .select()
          .single();

      } else {

        result = await sb
          .from('reviews')
          .insert(payload)
          .select()
          .single();

      }

      if (result.error) {
        throw result.error;
      }

      if (result.data?.id) {
        savedIds.push(
          result.data.id
        );
      }
    }

    const {
      data: existingRows,
      error: existingError
    } = await sb
      .from('reviews')
      .select('id');

    if (existingError) {
      throw existingError;
    }

    const idsToDelete =
      (existingRows || [])
        .map(row => row.id)
        .filter(
          id =>
            !savedIds.includes(id)
        );

    if (idsToDelete.length) {

      const {
        error: deleteError
      } = await sb
        .from('reviews')
        .delete()
        .in(
          'id',
          idsToDelete
        );

      if (deleteError) {
        throw deleteError;
      }
    }

    await loadReviews();

    setEditorStatus(
      'settingsStatus',
      'Reviews saved successfully.',
      'success'
    );

  } catch (err) {

    console.error(
      'Could not save reviews:',
      err
    );

    setEditorStatus(
      'settingsStatus',
      `Reviews could not be saved: ${err.message || err}`,
      'error'
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = 'Save reviews';
    }
  }
}

async function loadReviews() {

  if (!sb) return;

  const {
    data,
    error
  } = await sb
    .from('reviews')
    .select('*')
    .order('sort_order');

  if (error) {

    console.error(
      'Could not load reviews:',
      error
    );

    renderReviewsEditor([]);

    return;
  }

  renderReviewsEditor(
    data || []
  );
}

/* -------------------------------------------------
   SITE SETTINGS
------------------------------------------------- */

async function loadSettings() {

  if (!sb) return;

  const {
    data,
    error
  } = await sb
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) {

    console.error(
      'Could not load site settings:',
      error
    );

    return;
  }

  if (!data) return;

  if ($('googleUrl')) {
    $('googleUrl').value =
      data.google_review_url || '';
  }

  if ($('leaveReviewUrl')) {
    $('leaveReviewUrl').value =
      data.leave_review_url || '';
  }

  if ($('areaText')) {
    $('areaText').value =
      data.service_area_text || '';
  }
}

async function saveSettings() {

  if (!sb || !user) {

    setEditorStatus(
      'settingsStatus',
      'You must be signed in.',
      'error'
    );

    return;
  }

  const button =
    $('saveSettings');

  if (button) {
    button.disabled = true;
    button.textContent = 'Saving...';
  }

  try {

    const payload = {

      id: 1,

      google_review_url:
        $('googleUrl')?.value.trim() || '',

      leave_review_url:
        $('leaveReviewUrl')?.value.trim() || '',

      service_area_text:
        $('areaText')?.value.trim() || ''
    };

    const {
      error
    } = await sb
      .from('site_settings')
      .upsert(
        payload,
        {
          onConflict: 'id'
        }
      );

    if (error) {
      throw error;
    }

    await loadSettings();

    setEditorStatus(
      'settingsStatus',
      'Site settings saved successfully.',
      'success'
    );

  } catch (err) {

    console.error(
      'Could not save settings:',
      err
    );

    setEditorStatus(
      'settingsStatus',
      `Settings could not be saved: ${err.message || err}`,
      'error'
    );

  } finally {

    if (button) {
      button.disabled = false;
      button.textContent = 'Save settings';
    }
  }
}

/* -------------------------------------------------
   LOAD EVERYTHING
------------------------------------------------- */

async function loadAll() {

  if (!sb || !user) {
    return;
  }

  await Promise.all([
    loadServices(),
    loadGallery(),
    loadReviews(),
    loadSettings()
  ]);
}

/* -------------------------------------------------
   EVENT LISTENERS
------------------------------------------------- */

function setupEventListeners() {

  const signInBtn = $('signInBtn');

  if (signInBtn) {
    signInBtn.addEventListener(
      'click',
      signIn
    );
  }

  const signOutBtn = $('signOut');

  if (signOutBtn) {
    signOutBtn.addEventListener(
      'click',
      signOut
    );
  }

  const saveSettingsBtn = $('saveSettings');

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener(
      'click',
      saveSettings
    );
  }

  const addServiceBtn = $('addService');

  if (addServiceBtn) {
    addServiceBtn.addEventListener(
      'click',
      addService
    );
  }

  const saveServicesBtn = $('saveServices');

  if (saveServicesBtn) {
    saveServicesBtn.addEventListener(
      'click',
      saveServices
    );
  }

  const addGalleryBtn = $('addGallery');

  if (addGalleryBtn) {
    addGalleryBtn.addEventListener(
      'click',
      addGallery
    );
  }

  const saveGalleryBtn = $('saveGallery');

  if (saveGalleryBtn) {
    saveGalleryBtn.addEventListener(
      'click',
      saveGallery
    );
  }

  const saveReviewsBtn = $('saveReviews');

  if (saveReviewsBtn) {
    saveReviewsBtn.addEventListener(
      'click',
      saveReviews
    );
  }
}


/* -------------------------------------------------
   STARTUP
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
