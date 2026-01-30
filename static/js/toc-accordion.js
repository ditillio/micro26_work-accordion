(function () {
  'use strict';

  function isModifiedClick(ev) {
    return ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey;
  }

  function absUrl(href, base) {
    try {
      return new URL(href, base).href;
    } catch (e) {
      return href;
    }
  }

  // Ensure URL ends with "/" so relative links like "./1" resolve to ".../5/1" (not ".../II/1")
  function ensureTrailingSlash(url) {
    try {
      const u = new URL(url, location.href);
      if (!u.pathname.endsWith('/')) u.pathname = u.pathname + '/';
      return u.href;
    } catch (e) {
      return url.endsWith('/') ? url : (url + '/');
    }
  }

  async function fetchHtml(url) {
    const resp = await fetch(url, { credentials: 'same-origin' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.text();
  }

  function extractSectionsFromChapterHtml(htmlText, chapterBaseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const rows = Array.from(doc.querySelectorAll('div.chapter'));
    const sections = [];

    for (const row of rows) {
      const a = row.querySelector('a');
      if (!a) continue; // drafts have no link

      const numEl = row.querySelector('span.number');
      const numberText = (numEl ? numEl.textContent : '').trim();
      const titleText = (a.textContent || '').trim();
      const href = a.getAttribute('href') || '';
      if (!href) continue;

      // IMPORTANT: resolve against chapterBaseUrl WITH trailing slash
      sections.push({
        number: numberText,
        title: titleText,
        url: absUrl(href, chapterBaseUrl),
      });
    }

    return sections;
  }

  function buildSectionsNode(sections) {
    const container = document.createElement('div');
    container.className = 'toc-sections';

    for (const s of sections) {
      const item = document.createElement('div');
      item.className = 'toc-section_link';

      const num = document.createElement('span');
      num.className = 'toc-section_number';
      num.textContent = s.number;

      const link = document.createElement('a');
      link.href = s.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = s.title;

      item.appendChild(num);
      item.appendChild(link);
      container.appendChild(item);
    }

    return container;
  }

  async function toggleChapter(ev, chapterAnchor) {
    if (isModifiedClick(ev)) return;
    ev.preventDefault();

    const row = chapterAnchor.closest('.chapter_link');
    if (!row) return;

    const next = row.nextElementSibling;
    if (next && next.classList && next.classList.contains('toc-sections')) {
      next.remove();
      return;
    }

    const rawHref = chapterAnchor.getAttribute('href') || chapterAnchor.href;
    const chapterUrl = absUrl(rawHref, location.href);
    const chapterUrlWithSlash = ensureTrailingSlash(chapterUrl);

    // Try fetch both variants; use the successful one as base for resolving relative links
    let htmlText, baseForLinks;

    try {
      htmlText = await fetchHtml(chapterUrlWithSlash);
      baseForLinks = chapterUrlWithSlash;
    } catch (e1) {
      try {
        htmlText = await fetchHtml(chapterUrl);
        baseForLinks = chapterUrlWithSlash; // still use slash version for correct relative resolution
      } catch (e2) {
        window.location.href = chapterUrl;
        return;
      }
    }

    const sections = extractSectionsFromChapterHtml(htmlText, baseForLinks);

    if (!sections.length) {
      // If we can't find sections, fall back to normal navigation.
      window.location.href = chapterUrl;
      return;
    }

    const node = buildSectionsNode(sections);
    row.insertAdjacentElement('afterend', node);
  }

  function init() {
    document.addEventListener('click', function (ev) {
      const a = ev.target.closest('.chapter_link > a');
      if (!a) return;
      toggleChapter(ev, a);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
