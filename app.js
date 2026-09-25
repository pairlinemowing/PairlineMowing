const CONFIG = window.PAIRLINE_CONFIG || {};
const DEFAULT_SERVICES = [
  ['01', 'Lawn Mowing', 'Consistent mowing to keep your lawn clean, even, and well maintained.'],
  ['02', 'Edging', 'Crisp edges along sidewalks, driveways, and lawn borders for a finished look.'],
  ['03', 'Weed Whacking', 'Detailed trimming around areas a mower cannot reach for a cleaner property.'],
  ['04', 'Gutter Cleaning', 'Help keep gutters clear of leaves and debris so water can flow properly.'],
  ['05', 'Lawn Mower Repairs', 'Repair help for lawn mowers and related equipment. Contact us with the issue.'],
  ['06', 'Whipper & Equipment Repairs', 'Repair help for whippers and other lawn equipment. Contact us to discuss your equipment.']
];
const DEFAULT_REVIEWS = [
  {
    name: 'Pamela B.',
    title: 'Great price',
    text: 'I had lawn service yesterday edging my yard and flower beds. Not only did they do an exceptional job but they are very professional and respectful. The owners have great communication and respond quickly to messages. I am so pleased with their professionalism. I have a list of jobs that I am hiring them for, starting with power washing our house this weekend. Then their next project will be deck and porch painting. I am excited and grateful to have them because I have a list of home projects that I need done and my husband and I are not able to accomplish it on our own. It was a blessing to randomly have met them as they were working on a neighbors property. Can’t wait to have my projects finished and I have great confidence that they will do a fantastic job. When the yard work was done, they knocked on the door and asked if I was satisfied with the job. That was so nice and respectful. You can tell they take pride in their work. Exceptional service!!! Highly recommend. 5 stars for sure! Give them a call. You won’t be disappointed!!!'
  },
  {
    name: 'Charly Parker',
    title: '',
    text: 'These guys did an amazing job! I wanted my grass cut the same day and they were at my house in less than an hour! Not only did they do a beautiful job, they were super respectful. Will absolutely be my go-to lawn service!'
  },
  {
    name: 'Iain Baunoch',
    title: 'Great price',
    text: 'These guys do excellent work. They have a great attention to detail, work quickly and make sure the job is done right.'
  }
];
const DEFAULT_GALLERY = [
  {
    image_url: 'images/our-work-1.jpeg',
    caption: 'Lawn mowing work',
    sort_order: 1
  },
  {
    image_url: 'images/our-work-2.jpeg',
    caption: 'Finished lawn care work',
    sort_order: 2
  }
];
let supabaseClient = null;
if (
  CONFIG.SUPABASE_URL &&
  CONFIG.SUPABASE_ANON_KEY &&
  window.supabase
) {
  supabaseClient = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
  );
}
function escapeHtml(value = '') {
  return String(value).replace(
    /[&<>'"]/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;'
    }[c])
  );
}
/* -----------------------------
   SERVICES
----------------------------- */
function renderServices(items = DEFAULT_SERVICES) {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;
  grid.innerHTML = items.map((s, i) => {
    const number =
      Array.isArray(s)
        ? s[0]
        : (
            s.number ||
            s.sort_order ||
            String(i + 1).padStart(2, '0')
          );
    const title =
      Array.isArray(s)
        ? s[1]
        : (
            s.title ||
            s.name ||
            ''
          );
    const description =
      Array.isArray(s)
        ? s[2]
        : (
            s.description ||
            ''
          );
    return `
      <article class="service-card">
        <div class="service-number">
          ${escapeHtml(number)}
        </div>
        <h3>
          ${escapeHtml(title)}
        </h3>
        <p>
          ${escapeHtml(description)}
        </p>
      </article>
    `;
  }).join('');
}
/* -----------------------------
   OUR WORK / GALLERY
----------------------------- */
function renderGallery(items = DEFAULT_GALLERY) {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  const sortedItems = [...items].sort(
    (a, b) =>
      (Number(a.sort_order) || 0) -
      (Number(b.sort_order) || 0)
  );
  grid.innerHTML = sortedItems.map(g => `
    <figure class="gallery-card">
      <img
        loading="lazy"
        src="${escapeHtml(g.image_url || '')}"
        alt="${escapeHtml(
          g.title ||
          g.caption ||
          'Pairline Mowing project photo'
        )}"
      >
      <figcaption>
        ${escapeHtml(
          g.title ||
          g.caption ||
          'Pairline Mowing project'
        )}
      </figcaption>
    </figure>
  `).join('');
}
/* -----------------------------
   REVIEWS
----------------------------- */
function renderReviews(items = DEFAULT_REVIEWS) {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;
  grid.innerHTML = items.map(r => {
    const rating = Number(r.rating) || 5;
    const stars = '★'.repeat(
      Math.max(
        0,
        Math.min(
          5,
          rating
        )
      )
    );
    return `
      <article class="review-card">
        <div
          class="stars"
          aria-label="${rating} out of 5 stars"
        >
          ${stars}
        </div>
        <h3>
          ${escapeHtml(r.name || '')}
        </h3>
        ${
          r.title
            ? `
              <div class="review-source">
                ${escapeHtml(r.title)}
              </div>
            `
            : ''
        }
        <p>
          ${escapeHtml(r.text || '')}
        </p>
      </article>
    `;
  }).join('');
}
/* -----------------------------
   GOOGLE REVIEW LINKS
----------------------------- */
function updateGoogleLinks(
  viewUrl,
  leaveUrl
) {
  const googleReviewsBtn =
    document.getElementById('googleReviewsBtn');
  const leaveReviewBtn =
    document.getElementById('leaveReviewBtn');
  if (
    googleReviewsBtn &&
    viewUrl
  ) {
    googleReviewsBtn.href = viewUrl;
  }
  if (
    leaveReviewBtn &&
    leaveUrl
  ) {
    leaveReviewBtn.href = leaveUrl;
  }
}
/* -----------------------------
   LOAD CONTENT FROM SUPABASE
----------------------------- */
async function loadSupabaseContent() {
  if (!supabaseClient) {
    return;
  }
  try {
    const [
      servicesResult,
      galleryResult,
      reviewsResult,
      settingsResult
    ] = await Promise.all([
      supabaseClient
        .from('services')
        .select('*')
        .order('sort_order'),
      supabaseClient
        .from('gallery')
        .select('*')
        .order('sort_order'),
      supabaseClient
        .from('reviews')
        .select('*')
        .order('sort_order'),
      supabaseClient
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle()
    ]);
    const services =
      servicesResult.data || [];
    const gallery =
      galleryResult.data || [];
    const reviews =
      reviewsResult.data || [];
    const settings =
      settingsResult.data;
    /* SERVICES */
    if (
      !servicesResult.error &&
      services.length > 0
    ) {
      renderServices(services);
    } else {
      renderServices(DEFAULT_SERVICES);
    }
    /* GALLERY */
    if (
      !galleryResult.error &&
      gallery.length > 0
    ) {
      renderGallery(gallery);
    } else {
      renderGallery(DEFAULT_GALLERY);
    }
    /* REVIEWS */
    if (
      !reviewsResult.error &&
      reviews.length > 0
    ) {
      renderReviews(reviews);
    } else {
      renderReviews(DEFAULT_REVIEWS);
    }
    /* SITE SETTINGS */
    if (settings) {
      updateGoogleLinks(
        settings.google_review_url,
        settings.leave_review_url
      );
      const areaText =
        document.getElementById(
          'serviceAreaText'
        );
      if (areaText) {
        areaText.textContent =
          settings.service_area_text || '';
      }
    }
    if (servicesResult.error) {
      console.warn(
        'Services could not be loaded:',
        servicesResult.error
      );
    }
    if (galleryResult.error) {
      console.warn(
        'Gallery could not be loaded:',
        galleryResult.error
      );
    }
    if (reviewsResult.error) {
      console.warn(
        'Reviews could not be loaded:',
        reviewsResult.error
      );
    }
    if (settingsResult.error) {
      console.warn(
        'Site settings could not be loaded:',
        settingsResult.error
      );
    }
  } catch (e) {
    console.warn(
      'Optional online content could not be loaded. Showing built-in content.',
      e
    );
    renderServices(DEFAULT_SERVICES);
    renderGallery(DEFAULT_GALLERY);
    renderReviews(DEFAULT_REVIEWS);
  }
}
/* -----------------------------
   REALTIME UPDATES
----------------------------- */
function setupRealtime() {
  if (!supabaseClient) {
    return;
  }
  supabaseClient
    .channel('pairline-live-site')
    /* SERVICES */
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'services'
      },
      async () => {
        console.log(
          'Services changed. Updating website...'
        );
        const {
          data,
          error
        } = await supabaseClient
          .from('services')
          .select('*')
          .order('sort_order');
        if (
          !error &&
          data &&
          data.length > 0
        ) {
          renderServices(data);
        } else {
          renderServices(DEFAULT_SERVICES);
        }
      }
    )
    /* GALLERY */
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'gallery'
      },
      async () => {
        console.log(
          'Gallery changed. Updating website...'
        );
        const {
          data,
          error
        } = await supabaseClient
          .from('gallery')
          .select('*')
          .order('sort_order');
        if (
          !error &&
          data &&
          data.length > 0
        ) {
          renderGallery(data);
        } else {
          renderGallery(DEFAULT_GALLERY);
        }
      }
    )
    /* REVIEWS */
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reviews'
      },
      async () => {
        console.log(
          'Reviews changed. Updating website...'
        );
        const {
          data,
          error
        } = await supabaseClient
          .from('reviews')
          .select('*')
          .order('sort_order');
        if (
          !error &&
          data &&
          data.length > 0
        ) {
          renderReviews(data);
        } else {
          renderReviews(DEFAULT_REVIEWS);
        }
      }
    )
    /* SITE SETTINGS */
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'site_settings'
      },
      async () => {
        console.log(
          'Site settings changed. Updating website...'
        );
        const {
          data,
          error
        } = await supabaseClient
          .from('site_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();
        if (
          !error &&
          data
        ) {
          updateGoogleLinks(
            data.google_review_url,
            data.leave_review_url
          );
          const areaText =
            document.getElementById(
              'serviceAreaText'
            );
          if (areaText) {
            areaText.textContent =
              data.service_area_text || '';
          }
        }
      }
    )
    .subscribe(
      status => {
        console.log(
          'Pairline realtime status:',
          status
        );
      }
    );
}
/* -----------------------------
   MOBILE NAVIGATION
----------------------------- */
function setupNav() {
  const btn =
    document.getElementById('menuToggle');
  const nav =
    document.getElementById('siteNav');
  if (
    !btn ||
    !nav
  ) {
    return;
  }
  btn.addEventListener(
    'click',
    () => {
      const open =
        nav.classList.toggle('open');
      btn.setAttribute(
        'aria-expanded',
        String(open)
      );
    }
  );
  nav
    .querySelectorAll('a')
    .forEach(a => {
      a.addEventListener(
        'click',
        () => {
          nav.classList.remove('open');
          btn.setAttribute(
            'aria-expanded',
            'false'
          );
        }
      );
    });
}
/* -----------------------------
   INITIAL PAGE CONTENT
----------------------------- */
renderServices(DEFAULT_SERVICES);
renderGallery(DEFAULT_GALLERY);
renderReviews(DEFAULT_REVIEWS);
updateGoogleLinks(
  CONFIG.GOOGLE_REVIEW_URL,
  CONFIG.LEAVE_REVIEW_URL
);
setupNav();
/* -----------------------------
   LOAD SAVED ADMIN CONTENT
----------------------------- */
loadSupabaseContent();
/* -----------------------------
   START REALTIME
----------------------------- */
setupRealtime();
