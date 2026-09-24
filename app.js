const CONFIG = window.PAIRLINE_CONFIG || {};
const DEFAULT_SERVICES = [
  ['01','Lawn Mowing','Consistent mowing to keep your lawn clean, even, and well maintained.'],
  ['02','Edging','Crisp edges along sidewalks, driveways, and lawn borders for a finished look.'],
  ['03','Weed Whacking','Detailed trimming around areas a mower cannot reach for a cleaner property.'],
  ['04','Gutter Cleaning','Help keep gutters clear of leaves and debris so water can flow properly.'],
  ['05','Lawn Mower Repairs','Repair help for lawn mowers and related equipment. Contact us with the issue.'],
  ['06','Whipper & Equipment Repairs','Repair help for whippers and other lawn equipment. Contact us to discuss your equipment.']
];
const DEFAULT_REVIEWS = [
  {name:'Pamela B.', title:'Great price', text:'I had lawn service yesterday edging my yard and flower beds. Not only did they do an exceptional job but they are very professional and respectful. The owners have great communication and respond quickly to messages. I am so pleased with their professionalism. I have a list of jobs that I am hiring them for, starting with power washing our house this weekend. Then their next project will be deck and porch painting. I am excited and grateful to have them because I have a list of home projects that I need done and my husband and I are not able to accomplish it on our own. It was a blessing to randomly have met them as they were working on a neighbors property. Can’t wait to have my projects finished and I have great confidence that they will do a fantastic job. When the yard work was done, they knocked on the door and asked if I was satisfied with the job. That was so nice and respectful. You can tell they take pride in their work. Exceptional service!!! Highly recommend. 5 stars for sure! Give them a call. You won’t be disappointed!!!'},
  {name:'Charly Parker', title:'', text:'These guys did an amazing job! I wanted my grass cut the same day and they were at my house in less than an hour! Not only did they do a beautiful job, they were super respectful. Will absolutely be my go-to lawn service!'},
  {name:'Iain Baunoch', title:'Great price', text:'These guys do excellent work. They have a great attention to detail, work quickly and make sure the job is done right.'}
];
const DEFAULT_GALLERY = [
  {image_url:'images/our-work-1.jpeg',caption:'Lawn mowing work',sort_order:1},
  {image_url:'images/our-work-2.jpeg',caption:'Finished lawn care work',sort_order:2}
];
let supabaseClient = null;
if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase) {
  supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function renderServices(items=DEFAULT_SERVICES){document.getElementById('servicesGrid').innerHTML=items.map((s,i)=>`<article class="service-card"><div class="service-number">${escapeHtml(s.number||String(i+1).padStart(2,'0'))}</div><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.description)}</p></article>`).join('');}
function renderGallery(items=DEFAULT_GALLERY){const grid=document.getElementById('galleryGrid');grid.innerHTML=items.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(g=>`<figure class="gallery-card"><img loading="lazy" src="${escapeHtml(g.image_url)}" alt="${escapeHtml(g.caption||'Pairline Mowing project photo')}"><figcaption>${escapeHtml(g.caption||'Pairline Mowing project')}</figcaption></figure>`).join('');}
function renderReviews(items=DEFAULT_REVIEWS){document.getElementById('reviewsGrid').innerHTML=items.map(r=>`<article class="review-card"><div class="stars" aria-label="5 out of 5 stars">★★★★★</div><h3>${escapeHtml(r.name)}</h3>${r.title?`<div class="review-source">${escapeHtml(r.title)}</div>`:''}<p>${escapeHtml(r.text)}</p></article>`).join('');}
function updateGoogleLinks(url){if(!url)return;document.getElementById('googleReviewsBtn').href=url;document.getElementById('leaveReviewBtn').href=url;}
async function loadSupabaseContent(){
  if(!supabaseClient)return;
  try{
    const [{data:services},{data:gallery},{data:reviews},{data:settings}] = await Promise.all([
      supabaseClient.from('services').select('*').eq('published',true).order('sort_order'),
      supabaseClient.from('gallery').select('*').eq('published',true).order('sort_order'),
      supabaseClient.from('reviews').select('*').eq('published',true).order('sort_order'),
      supabaseClient.from('site_settings').select('*').eq('id',1).maybeSingle()
    ]);
    if(services?.length) renderServices(services);
    if(gallery?.length) renderGallery(gallery); else renderGallery(DEFAULT_GALLERY);
    if(reviews?.length) renderReviews(reviews);
    if(settings?.google_review_url) updateGoogleLinks(settings.google_review_url);
    if(settings?.service_area_text) document.getElementById('serviceAreaText').textContent = settings.service_area_text;
  }catch(e){console.warn('Optional online content could not be loaded. Showing built-in content.',e);}
}
function setupNav(){const btn=document.getElementById('menuToggle'),nav=document.getElementById('siteNav');btn.addEventListener('click',()=>{const open=nav.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');btn.setAttribute('aria-expanded','false');}));}
renderServices();renderGallery();renderReviews();updateGoogleLinks(CONFIG.GOOGLE_REVIEW_URL);setupNav();loadSupabaseContent();
