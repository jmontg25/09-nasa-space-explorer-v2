// Backup CDN (class feed) - used only if API key is not provided or as a fallback
const apodData = 'https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json';

// DOM references
const getImageBtn = document.getElementById('getImageBtn');
const gallery = document.getElementById('gallery');
const randomFactEl = document.getElementById('randomFact');
const startDateInput = document.getElementById('startDate');

// Modal references
const modal = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose = document.getElementById('modalClose');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');

// A small set of fun space facts for the random fact feature
const spaceFacts = [
	"A day on Venus is longer than its year.",
	"Neutron stars can spin at a rate of 600 rotations per second.",
	"There are more trees on Earth than stars in the Milky Way.",
	"Light from the Sun takes about 8 minutes and 20 seconds to reach Earth.",
	"Saturn's rings are mostly made of ice and rock fragments.",
	"The footprints on the Moon will stay there for millions of years — there's no wind to erode them.",
];

// Show a random fact above the gallery on each page load
function showRandomFact() {
	const fact = spaceFacts[Math.floor(Math.random() * spaceFacts.length)];
	randomFactEl.textContent = `Did you know? ${fact}`;
}

// Show a loading message while fetching
function showLoading() {
	gallery.innerHTML = '<div class="loading">🔄 Loading space photos…</div>';
}

function formatDateISO(date) {
	// date is a Date object
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

// Note: We use the class-provided CDN feed (apodData) instead of live NASA API requests.
// The CDN returns an array of APOD-like objects which we can look up by date.

// Render the gallery items
function renderGallery(items) {
	if (!items || items.length === 0) {
		gallery.innerHTML = '<div class="placeholder"><p>No images found.</p></div>';
		return;
	}

	const fragment = document.createDocumentFragment();

	items.forEach(item => {
		const card = document.createElement('article');
		card.className = 'gallery-item';

		// Media wrapper keeps the hover zoom clipped
		const mediaWrap = document.createElement('div');
		mediaWrap.className = 'media-wrap';

		if (item.media_type === 'image') {
			const img = document.createElement('img');
			img.src = item.url || item.hdurl || '';
			img.alt = item.title || 'NASA image';
			mediaWrap.appendChild(img);
			card.appendChild(mediaWrap);
			// Clicking opens modal with larger image
			card.addEventListener('click', () => openModal(item));
		} else if (item.media_type === 'video') {
			// For videos show a thumbnail if available, else a placeholder
			const img = document.createElement('img');
			img.src = item.thumbnail_url || item.url || '';
			img.alt = item.title || 'NASA video';
			mediaWrap.appendChild(img);
			// add a small play overlay
			const play = document.createElement('div');
			play.textContent = '▶';
			play.style.position = 'absolute';
			play.style.left = '12px';
			play.style.top = '12px';
			play.style.fontSize = '22px';
			play.style.color = 'white';
			mediaWrap.style.position = 'relative';
			mediaWrap.appendChild(play);
			card.appendChild(mediaWrap);
			// Clicking opens modal which will embed the video
			card.addEventListener('click', () => openModal(item));
		} else {
			// Unknown media type
			const placeholder = document.createElement('div');
			placeholder.className = 'placeholder';
			placeholder.textContent = 'Unsupported media type';
			card.appendChild(placeholder);
		}

		const title = document.createElement('p');
		title.innerHTML = `<strong>${item.title || ''}</strong><br/><small>${item.date || ''}</small>`;
		card.appendChild(title);

		fragment.appendChild(card);
	});

	gallery.innerHTML = '';
	gallery.appendChild(fragment);
}

// Open modal with the selected item
function openModal(item) {
	// Clear previous media
	modalMedia.innerHTML = '';

	if (item.media_type === 'image') {
		const img = document.createElement('img');
		img.src = item.hdurl || item.url || '';
		img.alt = item.title || 'NASA image';
		modalMedia.appendChild(img);
	} else if (item.media_type === 'video') {
		// Try to embed the video if the URL is an embeddable link
		// Many entries include a YouTube embed URL (https://www.youtube.com/embed/ID)
		const iframe = document.createElement('iframe');
		iframe.src = item.url;
		iframe.frameBorder = '0';
		iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
		iframe.allowFullscreen = true;
		modalMedia.appendChild(iframe);
	} else {
		const link = document.createElement('a');
		link.href = item.url || '#';
		link.textContent = 'Open media';
		link.target = '_blank';
		modalMedia.appendChild(link);
	}

	modalTitle.textContent = item.title || '';
	modalDate.textContent = item.date || '';
	modalExplanation.textContent = item.explanation || '';

	modal.classList.remove('hidden');
	modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
	modal.classList.add('hidden');
	modal.setAttribute('aria-hidden', 'true');
	// stop any playing video by clearing the media container
	modalMedia.innerHTML = '';
}


// Fetch 9 APOD entries from the class CDN feed, starting at the selected date or the nearest available date.
async function fetchAndRender() {
	const startVal = startDateInput.value;

	if (!startVal) {
		gallery.innerHTML = '<div class="placeholder"><p>Please select a start date.</p></div>';
		return;
	}

	showLoading();

	try {
		const res = await fetch(apodData);
		if (!res.ok) throw new Error('Failed to fetch APOD feed');
		const data = await res.json();

		if (!Array.isArray(data) || data.length === 0) {
			gallery.innerHTML = '<div class="placeholder"><p>No APOD data available.</p></div>';
			return;
		}

		// Sort feed by date ascending (oldest -> newest)
		const feed = data.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));

		// Find index of the first entry on or after startVal
		let idx = feed.findIndex(item => item.date >= startVal);
		if (idx === -1) {
			// If no entries on/after startVal, start at the last available entry
			idx = feed.length - 1;
		}

		// Collect up to 9 items starting from idx forward; if not enough, take earlier items
		const results = [];
		let forward = idx;
		while (results.length < 9 && forward < feed.length) {
			results.push(feed[forward]);
			forward++;
		}

		// If still fewer than 9, pull previous entries before idx
		let back = idx - 1;
		while (results.length < 9 && back >= 0) {
			results.push(feed[back]);
			back--;
		}

		// Sort results by date ascending to keep chronological order
		results.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

		renderGallery(results.slice(0, 9));
	} catch (err) {
		gallery.innerHTML = `<div class="placeholder"><p>Failed to load images: ${err.message}</p></div>`;
		console.error('Fetch error', err);
	}
}

// Wire up event listeners
getImageBtn.addEventListener('click', fetchAndRender);
modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
window.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
		closeModal();
	}
});

// On page load show a random fact
document.addEventListener('DOMContentLoaded', () => {
	showRandomFact();
});

// Exported for debugging (optional)
window._apod = { fetchAndRender };
