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
  return String(v).replace(
    /[&<>'"]/g,
    c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      "'":'&#39;',
      '"':'&quot;'
    }[c])
  );
}

const defaultServices = [
  ['01','Lawn Mowing','Consistent mowing to keep your lawn clean, even, and well maintained.'],
  ['02','Edging','Crisp edges along sidewalks, driveways, and lawn borders for a finished look.'],
  ['03','Weed Whacking','Detailed trimming around areas a mower cannot reach for a cleaner property.'],
  ['04','Gutter Cleaning','Help keep gutters clear of leaves and debris so water can flow properly.'],
  ['05','Lawn Mower Repairs','Repair help for lawn mowers and related equipment. Contact us with the issue.'],
  ['06','Whipper & Equipment Repairs','Repair help for whippers and other lawn equipment. Contact us to discuss your equipment.']
];

const defaultReviews = [
  {
    name:'Pamela B.',
    title:'Great price',
    text:'I had lawn service yesterday edging my yard and flower beds. Not only did they do an exceptional job but they are very professional and respectful. The owners have great communication and respond quickly to messages. I am so pleased with their professionalism. I have a list of jobs that I am hiring them for, starting with power washing our house this weekend. Then their next project will be deck and porch painting. I am excited and grateful to have them because I have a list of home projects that I need done and my husband and I are not able to accomplish it on our own. It was a blessing to randomly have met them as they were working on a neighbors property. Can’t wait to have my projects finished and I have great confidence that they will do a fantastic job. When the yard work was done, they knocked on the door and asked if I was satisfied with the job. That was so nice and respectful. You can tell they take pride in their work. Exceptional service!!! Highly recommend. 5 stars for sure! Give them a call. You won’t be disappointed!!!'
  },
  {
    name:'Charly Parker',
    title:'',
    text:'These guys did an amazing job! I wanted my grass cut the same day and they were at my house in less than an hour! Not only did they do a beautiful job, they were super respectful. Will absolutely be my go-to lawn service!'
  },
  {
    name:'Iain Baunoch',
    title:'Great price',
    text:'These guys do excellent work. They have a great attention to detail, work quickly and make sure the job is done right.'
  }
];

function hideDashboard() {
  $('dashboard').classList.add('hidden');
}

function showLogin() {
  $('login').classList.remove('hidden');
  $('dashboard').classList.add('hidden');
}

function showSetup() {
  $('setupNotice').classList.remove('hidden');
  $('login').classList.add('hidden');
  $('dashboard').classList.add('hidden');
}

function showDashboard() {
  $('login').classList.add('hidden');
  $('setupNotice').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
}

function setStatus(id, msg, ok = true) {
  $(id).innerHTML = `
    <div class="status" style="border-left-color:${ok ? '#5fbf21' : '#b52c2c'}">
      ${esc(msg)}
    </div>
  `;
}

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
    email: email,
    password: password
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

async function check() {
  // Always hide the dashboard before checking authentication.
  hideDashboard();

  if (!sb) {
    showSetup();
    return;
  }

  showLogin();

  const { data, error } = await sb.auth.getSession();

  if (error) {
    showLogin();
    setStatus(
      'loginStatus',
      error.message,
      false
    );
    return;
  }

  if (data.session) {
    await handleUser(data.session.user);
  }

  sb.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => {
      if (session) {
        handleUser(session.user);
      } else {
        showLogin();
      }
    }, 0);
  });
}

async function handleUser(u) {
  user = u;

  const signedInEmail =
    (u.email || '').trim().toLowerCase();

  const ownerEmail =
    (C.OWNER_EMAIL || '').trim().toLowerCase();

  if (!ownerEmail || signedInEmail !== ownerEmail) {
    await sb.auth.signOut();

    showLogin();

    setStatus(
      'loginStatus',
      'That email is not authorized for the owner dashboard.',
      false
    );

    return;
  }

  showDashboard();

  await loadAll();
}

async function loadAll() {
  const [
    { data:s },
    { data:g },
    { data:r },
    { data:set }
  ] = await Promise.all([
    sb.from('services').select('*').order('sort_order'),
    sb.from('gallery').select('*').order('sort_order'),
    sb.from('reviews').select('*').order('sort_order'),
    sb.from('site_settings').select('*').eq('id',1).maybeSingle()
  ]);

  renderServices(
    s?.length
      ? s
      : defaultServices.map(x => ({
          number:x[0],
          name:x[1],
          description:x[2],
          published:true,
          sort_order:Number(x[0])
        }))
  );

  renderGallery(g || []);

  renderReviews(
    r?.length
      ? r
      : defaultReviews.map((x,i) => ({
          ...x,
          published:true,
          sort_order:i+1
        }))
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

function renderServices(items) {
  $('servicesEditor').innerHTML = items.map((s,i) => `
    <div class="list-item service-edit">
      <div class="admin-grid">

        <div class="field">
          <label>Service name</label>
          <input data-k="name" value="${esc(s.name)}">
        </div>

        <div class="field">
          <label>Order</label>
          <input
            type="number"
            data-k="sort_order"
            value="${Number(s.sort_order || i+1)}"
          >
        </div>

        <div class="field full">
          <label>Description</label>
          <textarea data-k="description">${esc(s.description)}</textarea>
        </div>

        <div class="field">
          <label>Published</label>
          <select data-k="published">
            <option value="true" ${s.published !== false ? 'selected' : ''}>Yes</option>
            <option value="false" ${s.published === false ? 'selected' : ''}>No</option>
          </select>
        </div>

      </div>
    </div>
  `).join('');
}

function renderGallery(items) {
  $('galleryEditor').innerHTML = items.map((g,i) => `
    <div class="list-item gallery-edit">

      <div class="file-row">

        <div class="field">
          <label>Caption</label>
          <input
            data-k="caption"
            value="${esc(g.caption || '')}"
            data-old-url="${esc(g.image_url || '')}"
          >
        </div>

        <div class="field">
          <label>Order</label>
          <input
            type="number"
            data-k="sort_order"
            value="${Number(g.sort_order || i+1)}"
          >
        </div>

      </div>

      <div class="field" style="margin-top:10px">
        <label>Replace image</label>
        <input type="file" accept="image/*" data-file>
      </div>

      <div class="field" style="margin-top:10px">
        <label>Published</label>
        <select data-k="published">
          <option value="true" ${g.published !== false ? 'selected' : ''}>Yes</option>
          <option value="false" ${g.published === false ? 'selected' : ''}>No</option>
        </select>
      </div>

      <div class="muted" style="margin-top:8px">
        Current image: ${esc(g.image_url || 'none')}
      </div>

    </div>
  `).join('');
}

function renderReviews(items) {
  $('reviewsEditor').innerHTML = items.map((r,i) => `
    <div class="list-item review-edit">
      <div class="admin-grid">

        <div class="field">
          <label>Name</label>
          <input data-k="name" value="${esc(r.name)}">
        </div>

        <div class="field">
          <label>Title</label>
          <input data-k="title" value="${esc(r.title || '')}">
        </div>

        <div class="field full">
          <label>Review text</label>
          <textarea data-k="text">${esc(r.text)}</textarea>
        </div>

        <div class="field">
          <label>Published</label>
          <select data-k="published">
            <option value="true" ${r.published !== false ? 'selected' : ''}>Yes</option>
            <option value="false" ${r.published === false ? 'selected' : ''}>No</option>
          </select>
        </div>

      </div>
    </div>
  `).join('');
}

$('signInBtn').onclick = signIn;

$('signOut').onclick = async () => {
  if (sb) {
    await sb.auth.signOut();
  }

  showLogin();
};

$('saveSettings').onclick = async () => {
  if (!user) {
    showLogin();
    return;
  }

  const { error } = await sb
    .from('site_settings')
    .upsert({
      id:1,
      google_review_url:$('googleUrl').value.trim(),
      leave_review_url:$('leaveReviewUrl').value.trim(),
      service_area_text:$('areaText').value.trim()
    });

  setStatus(
    'settingsStatus',
    error ? error.message : 'Settings saved.',
    !error
  );
};

$('addService').onclick = () => {
  const n =
    document.querySelectorAll('.service-edit').length + 1;

  const box = document.createElement('div');
  box.className = 'list-item service-edit';

  box.innerHTML = `
    <div class="admin-grid">

      <div class="field">
        <label>Service name</label>
        <input data-k="name" value="New service">
      </div>

      <div class="field">
        <label>Order</label>
        <input
          type="number"
          data-k="sort_order"
          value="${n}"
        >
      </div>

      <div class="field full">
        <label>Description</label>
        <textarea data-k="description"></textarea>
      </div>

      <div class="field">
        <label>Published</label>
        <select data-k="published">
          <option value="true" selected>Yes</option>
          <option value="false">No</option>
        </select>
      </div>

    </div>
  `;

  $('servicesEditor').appendChild(box);
};

$('saveServices').onclick = async () => {
  if (!user) {
    showLogin();
    return;
  }

  const rows =
    [...document.querySelectorAll('.service-edit')];

  await sb
    .from('services')
    .delete()
    .neq('id',0);

  for (const row of rows) {

    const get = k =>
      row.querySelector(`[data-k="${k}"]`).value;

    const { error } = await sb
      .from('services')
      .insert({
        name:get('name'),
        description:get('description'),
        sort_order:Number(get('sort_order')),
        published:get('published') === 'true'
      });

    if (error) {
      setStatus(
        'servicesEditor',
        error.message,
        false
      );
      return;
    }
  }

  setStatus(
    'servicesEditor',
    'Services saved.'
  );
};

$('addGallery').onclick = () => {
  const box = document.createElement('div');

  box.className = 'list-item gallery-edit';

  box.innerHTML = `
    <div class="file-row">

      <div class="field">
        <label>Caption</label>
        <input
          data-k="caption"
          value="New project"
        >
      </div>

      <div class="field">
        <label>Order</label>
        <input
          type="number"
          data-k="sort_order"
          value="${document.querySelectorAll('.gallery-edit').length + 1}"
        >
      </div>

    </div>

    <div class="field" style="margin-top:10px">
      <label>Image</label>
      <input
        type="file"
        accept="image/*"
        data-file
      >
    </div>

    <div class="field" style="margin-top:10px">
      <label>Published</label>
      <select data-k="published">
        <option value="true" selected>Yes</option>
        <option value="false">No</option>
      </select>
    </div>
  `;

  $('galleryEditor').appendChild(box);
};

async function uploadFile(file) {
  const safe = file.name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g,'-');

  const path =
    `${user.id}/${Date.now()}-${safe}`;

  const { error } = await sb
    .storage
    .from('site-images')
    .upload(
      path,
      file,
      {
        upsert:false,
        contentType:file.type
      }
    );

  if (error) {
    throw error;
  }

  const { data } = sb
    .storage
    .from('site-images')
    .getPublicUrl(path);

  return data.publicUrl;
}

$('saveGallery').onclick = async () => {
  if (!user) {
    showLogin();
    return;
  }

  const rows =
    [...document.querySelectorAll('.gallery-edit')];

  await sb
    .from('gallery')
    .delete()
    .neq('id',0);

  for (const row of rows) {

    const get = k =>
      row.querySelector(`[data-k="${k}"]`).value;

    let url =
      row.querySelector('[data-old-url]')
        ?.dataset.oldUrl || '';

    const file =
      row.querySelector('[data-file]')
        ?.files?.[0];

    if (file) {
      try {
        url = await uploadFile(file);
      } catch (e) {
        setStatus(
          'galleryEditor',
          e.message,
          false
        );
        return;
      }
    }

    if (!url) {
      setStatus(
        'galleryEditor',
        'Every gallery item needs an image.',
        false
      );
      return;
    }

    const { error } = await sb
      .from('gallery')
      .insert({
        image_url:url,
        caption:get('caption'),
        sort_order:Number(get('sort_order')),
        published:get('published') === 'true'
      });

    if (error) {
      setStatus(
        'galleryEditor',
        error.message,
        false
      );
      return;
    }
  }

  setStatus(
    'galleryEditor',
    'Gallery saved.'
  );
};

$('saveReviews').onclick = async () => {
  if (!user) {
    showLogin();
    return;
  }

  const rows =
    [...document.querySelectorAll('.review-edit')];

  await sb
    .from('reviews')
    .delete()
    .neq('id',0);

  for (const row of rows) {

    const get = k =>
      row.querySelector(`[data-k="${k}"]`).value;

    const { error } = await sb
      .from('reviews')
      .insert({
        name:get('name'),
        title:get('title'),
        text:get('text'),
        sort_order:rows.indexOf(row) + 1,
        published:get('published') === 'true'
      });

    if (error) {
      setStatus(
        'reviewsEditor',
        error.message,
        false
      );
      return;
    }
  }

  setStatus(
    'reviewsEditor',
    'Reviews saved.'
  );
};

// Start authentication check.
check();
