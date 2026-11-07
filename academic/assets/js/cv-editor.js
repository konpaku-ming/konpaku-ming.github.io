(function () {
  'use strict';

  const root = document.getElementById('cv-editor');
  if (!root) return;

  const form = document.getElementById('cv-editor-form');
  const preview = document.getElementById('cv-preview');
  const status = document.getElementById('cv-editor-status');
  const importFile = document.getElementById('cv-import-file');
  const defaultElement = document.getElementById('cv-default-data');
  const storageKey = 'xuanming-cv-editor-v1';

  const defaultState = normalize(JSON.parse(defaultElement.textContent || '{}'));
  let state = loadState() || clone(defaultState);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalize(value) {
    const data = value && typeof value === 'object' ? value : {};
    data.profile = data.profile || {};
    data.education = Array.isArray(data.education) ? data.education : [];
    data.publications = Array.isArray(data.publications) ? data.publications : [];
    data.research_experience = Array.isArray(data.research_experience) ? data.research_experience : [];
    data.teaching = Array.isArray(data.teaching) ? data.teaching : [];
    data.honors = Array.isArray(data.honors) ? data.honors : [];
    data.skills = Array.isArray(data.skills) ? data.skills : [];
    return data;
  }

  function loadState() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? normalize(JSON.parse(saved)) : null;
    } catch (error) {
      return null;
    }
  }

  function saveState(message) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      // Private browsing modes may disable local storage.
    }
    if (message) setStatus(message);
  }

  function setStatus(message) {
    status.textContent = message;
    window.clearTimeout(setStatus.timer);
    setStatus.timer = window.setTimeout(function () {
      status.textContent = '';
    }, 2400);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function text(value) {
    return escapeHtml(value || '').replace(/\n/g, '<br>');
  }

  function lines(value) {
    return Array.isArray(value) ? value.join('\n') : value || '';
  }

  function list(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return String(value || '').split('\n').map(function (item) {
      return item.trim();
    }).filter(Boolean);
  }

  function hasValue(value) {
    return String(value == null ? '' : value).trim().length > 0;
  }

  function field(path, label, value, options) {
    const settings = options || {};
    const fullClass = settings.full ? ' cv-form__field--full' : '';
    const tag = settings.textarea ? 'textarea' : 'input';
    const format = settings.lines ? ' data-format="lines"' : '';
    const placeholder = settings.placeholder ? ' placeholder="' + escapeAttribute(settings.placeholder) + '"' : '';
    const content = settings.textarea ? escapeHtml(lines(value)) : '';
    const input = settings.textarea
      ? '<textarea data-path="' + escapeAttribute(path) + '"' + format + placeholder + '>' + content + '</textarea>'
      : '<input type="text" data-path="' + escapeAttribute(path) + '" value="' + escapeAttribute(value || '') + '"' + format + placeholder + '>';
    return '<div class="cv-form__field' + fullClass + '"><label>' + escapeHtml(label) + '</label>' + input + '</div>';
  }

  function itemHeader(title, section, index) {
    return '<div class="cv-form__item-header"><h3>' + escapeHtml(title) + '</h3><button class="cv-form__remove" type="button" data-action="remove" data-section="' + section + '" data-index="' + index + '">Remove</button></div>';
  }

  function addButton(section, label) {
    return '<button class="cv-form__add" type="button" data-action="add" data-section="' + section + '">+ ' + escapeHtml(label) + '</button>';
  }

  function renderForm() {
    const profile = state.profile || {};
    let html = '';

    html += '<section class="cv-form__section"><div class="cv-form__section-header"><div><h2>Basic information</h2><p>Contact details shown at the top of the CV.</p></div></div>';
    html += '<div class="cv-form__grid">';
    html += field('profile.name', 'Name', profile.name, { full: true, placeholder: 'Your full name' });
    html += field('profile.headline', 'Headline', profile.headline, { full: true, placeholder: 'Degree, position, or research profile' });
    html += field('profile.email', 'Email', profile.email, { placeholder: 'name@example.com' });
    html += field('profile.website', 'Website', profile.website, { placeholder: 'https://...' });
    html += field('profile.location', 'Location', profile.location, { placeholder: 'City, Country' });
    html += '</div></section>';

    html += '<section class="cv-form__section"><div class="cv-form__section-header"><div><h2>Education</h2><p>Follow the compact institution / degree / date layout from the template.</p></div>' + addButton('education', 'Add education') + '</div>';
    if (!state.education.length) html += '<p class="cv-form__empty">No education entries yet.</p>';
    state.education.forEach(function (item, index) {
      html += '<div class="cv-form__item">' + itemHeader('Education ' + (index + 1), 'education', index) + '<div class="cv-form__grid">';
      html += field('education.' + index + '.institution', 'Institution', item.institution, { full: true });
      html += field('education.' + index + '.degree', 'Degree / program', item.degree, { full: true });
      html += field('education.' + index + '.location', 'Location', item.location, {});
      html += field('education.' + index + '.dates', 'Dates', item.dates, { placeholder: 'e.g. 09/2023 – 06/2027' });
      html += field('education.' + index + '.details', 'Details (one per line)', item.details, { full: true, textarea: true, lines: true });
      html += '</div></div>';
    });
    html += '</section>';

    html += '<section class="cv-form__section"><div class="cv-form__section-header"><div><h2>Research interests</h2><p>A concise paragraph under the education section.</p></div></div>';
    html += field('research_interests', 'Research interests', state.research_interests, { full: true, textarea: true, placeholder: 'Describe your research focus.' });
    html += '</section>';

    html += '<section class="cv-form__section"><div class="cv-form__section-header"><div><h2>Selected publications</h2><p>Add one publication per card. Links use “label | URL”, one per line.</p></div>' + addButton('publications', 'Add publication') + '</div>';
    if (!state.publications.length) html += '<p class="cv-form__empty">No publications yet.</p>';
    state.publications.forEach(function (item, index) {
      html += '<div class="cv-form__item">' + itemHeader('Publication ' + (index + 1), 'publications', index) + '<div class="cv-form__grid">';
      html += field('publications.' + index + '.title', 'Title', item.title, { full: true });
      html += field('publications.' + index + '.authors', 'Authors', item.authors, { full: true });
      html += field('publications.' + index + '.venue', 'Venue / status', item.venue, { full: true });
      html += field('publications.' + index + '.links', 'Links', item.links, { full: true, textarea: true, lines: true, placeholder: 'Paper | https://...' });
      html += '</div></div>';
    });
    html += '</section>';

    html += '<section class="cv-form__section"><div class="cv-form__section-header"><div><h2>Research experience</h2><p>Describe projects, responsibilities, and results.</p></div>' + addButton('research_experience', 'Add experience') + '</div>';
    if (!state.research_experience.length) html += '<p class="cv-form__empty">No research experience yet.</p>';
    state.research_experience.forEach(function (item, index) {
      html += '<div class="cv-form__item">' + itemHeader('Experience ' + (index + 1), 'research_experience', index) + '<div class="cv-form__grid">';
      html += field('research_experience.' + index + '.organization', 'Organization / lab', item.organization, { full: true });
      html += field('research_experience.' + index + '.role', 'Role / project', item.role, { full: true });
      html += field('research_experience.' + index + '.location', 'Location', item.location, {});
      html += field('research_experience.' + index + '.dates', 'Dates', item.dates, { placeholder: 'e.g. 09/2024 – present' });
      html += field('research_experience.' + index + '.bullets', 'Highlights (one per line)', item.bullets, { full: true, textarea: true, lines: true });
      html += '</div></div>';
    });
    html += '</section>';

    html += '<section class="cv-form__section"><div class="cv-form__section-header"><div><h2>Teaching experience</h2><p>Teaching roles and responsibilities.</p></div>' + addButton('teaching', 'Add teaching') + '</div>';
    if (!state.teaching.length) html += '<p class="cv-form__empty">No teaching experience yet.</p>';
    state.teaching.forEach(function (item, index) {
      html += '<div class="cv-form__item">' + itemHeader('Teaching ' + (index + 1), 'teaching', index) + '<div class="cv-form__grid">';
      html += field('teaching.' + index + '.title', 'Course / role', item.title, { full: true });
      html += field('teaching.' + index + '.dates', 'Dates', item.dates, {});
      html += field('teaching.' + index + '.details', 'Responsibilities', item.details, { full: true, textarea: true });
      html += '</div></div>';
    });
    html += '</section>';

    html += '<section class="cv-form__section"><div class="cv-form__section-header"><div><h2>Honors</h2><p>Scholarships, awards, and distinctions.</p></div>' + addButton('honors', 'Add honor') + '</div>';
    if (!state.honors.length) html += '<p class="cv-form__empty">No honors yet.</p>';
    state.honors.forEach(function (item, index) {
      html += '<div class="cv-form__item">' + itemHeader('Honor ' + (index + 1), 'honors', index) + '<div class="cv-form__grid">';
      html += field('honors.' + index + '.title', 'Honor', item.title, { full: true });
      html += field('honors.' + index + '.details', 'Details', item.details, { full: true });
      html += '</div></div>';
    });
    html += '</section>';

    html += '<section class="cv-form__section"><div class="cv-form__section-header"><div><h2>Technical skills</h2><p>Languages, frameworks, and tools.</p></div>' + addButton('skills', 'Add skill') + '</div>';
    if (!state.skills.length) html += '<p class="cv-form__empty">No skills yet.</p>';
    state.skills.forEach(function (item, index) {
      html += '<div class="cv-form__item"><div class="cv-form__grid">';
      html += '<div class="cv-form__item-header cv-form__field--full">' + itemHeader('Skill ' + (index + 1), 'skills', index) + '</div>';
      html += field('skills.' + index + '.label', 'Category', item.label, {});
      html += field('skills.' + index + '.value', 'Skills', item.value, {});
      html += '</div></div>';
    });
    html += '</section>';

    form.innerHTML = html;
  }

  function getPath(path) {
    return path.split('.').reduce(function (current, key) {
      return current == null ? '' : current[key];
    }, state);
  }

  function setPath(path, value) {
    const keys = path.split('.');
    let target = state;
    keys.slice(0, -1).forEach(function (key) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      target = target[key];
    });
    target[keys[keys.length - 1]] = value;
  }

  function itemTemplate(section) {
    const templates = {
      education: { institution: '', location: '', degree: '', dates: '', details: [] },
      publications: { title: '', authors: '', venue: '', links: [] },
      research_experience: { organization: '', location: '', role: '', dates: '', bullets: [] },
      teaching: { title: '', dates: '', details: '' },
      honors: { title: '', details: '' },
      skills: { label: '', value: '' }
    };
    return clone(templates[section]);
  }

  function renderPreview() {
    const profile = state.profile || {};
    let html = '<header class="cv-paper__header">';
    html += '<h1 class="cv-paper__name">' + text(profile.name || 'Your Name') + '</h1>';
    if (hasValue(profile.headline)) html += '<p class="cv-paper__headline">' + text(profile.headline) + '</p>';
    const contacts = [profile.email, profile.website, profile.location].filter(hasValue);
    if (contacts.length) {
      html += '<div class="cv-paper__contact">';
      contacts.forEach(function (contact) {
        const value = String(contact);
        if (/^https?:\/\//i.test(value)) {
          html += '<span><a href="' + escapeAttribute(value) + '" target="_blank" rel="noreferrer">' + text(value.replace(/^https?:\/\//i, '').replace(/\/$/, '')) + '</a></span>';
        } else if (value.includes('@')) {
          html += '<span><a href="mailto:' + escapeAttribute(value) + '">' + text(value) + '</a></span>';
        } else {
          html += '<span>' + text(value) + '</span>';
        }
      });
      html += '</div>';
    }
    html += '</header>';

    html += section('Education', state.education.map(function (item) {
      return entry(item.institution, item.degree, item.location, item.dates, item.details);
    }).join(''));

    if (hasValue(state.research_interests)) {
      html += '<section class="cv-paper__section"><h2 class="cv-paper__section-title">Research Interests</h2><p class="cv-paper__interests">' + text(state.research_interests) + '</p></section>';
    }

    html += section('Selected Publications', state.publications.map(publication).join(''));
    html += section('Research Experience', state.research_experience.map(function (item) {
      return entry(item.organization, item.role, item.location, item.dates, item.bullets);
    }).join(''));
    html += section('Teaching Experience', state.teaching.map(function (item) {
      return entry(item.title, item.details, '', item.dates, []);
    }).join(''));
    html += section('Honors', state.honors.map(function (item) {
      return entry(item.title, item.details, '', '', []);
    }).join(''));
    html += section('Technical Skills', state.skills.map(function (item) {
      if (!hasValue(item.label) && !hasValue(item.value)) return '';
      return '<p class="cv-paper__skill"><strong>' + text(item.label) + (hasValue(item.label) ? ': ' : '') + '</strong>' + text(item.value) + '</p>';
    }).join(''));

    preview.innerHTML = html;
  }

  function section(title, content) {
    if (!content || !content.trim()) return '';
    return '<section class="cv-paper__section"><h2 class="cv-paper__section-title">' + title + '</h2>' + content + '</section>';
  }

  function entry(title, subtitle, location, dates, bulletItems) {
    if (!hasValue(title) && !hasValue(subtitle) && !hasValue(location) && !hasValue(dates) && !list(bulletItems).length) return '';
    let html = '<div class="cv-paper__entry"><div class="cv-paper__entry-head"><div>';
    if (hasValue(title)) html += '<h3 class="cv-paper__entry-title">' + text(title) + '</h3>';
    if (hasValue(subtitle)) html += '<p class="cv-paper__entry-subtitle">' + text(subtitle) + '</p>';
    html += '</div><div class="cv-paper__entry-meta">' + text([location, dates].filter(hasValue).join('\n')) + '</div></div>';
    const bullets = list(bulletItems);
    if (bullets.length) {
      html += '<ul class="cv-paper__bullets">' + bullets.map(function (item) {
        return '<li>' + text(item) + '</li>';
      }).join('') + '</ul>';
    }
    html += '</div>';
    return html;
  }

  function publication(item) {
    if (!hasValue(item.title) && !hasValue(item.authors) && !hasValue(item.venue)) return '';
    let html = '<div class="cv-paper__entry"><h3 class="cv-paper__entry-title">' + text(item.title) + '</h3>';
    if (hasValue(item.authors)) html += '<p class="cv-paper__publication-authors">' + text(item.authors) + '</p>';
    if (hasValue(item.venue)) html += '<p class="cv-paper__publication-venue">' + text(item.venue) + '</p>';
    const links = list(item.links);
    if (links.length) {
      html += '<span class="cv-paper__links">' + links.map(function (line) {
        const parts = line.split('|');
        const label = parts.length > 1 ? parts.shift().trim() : line;
        const url = parts.length ? parts.join('|').trim() : line;
        if (!/^https?:\/\//i.test(url)) return '<span>' + text(line) + '</span>';
        return '<a href="' + escapeAttribute(url) + '" target="_blank" rel="noreferrer">' + text(label) + '</a>';
      }).join('') + '</span>';
    }
    html += '</div>';
    return html;
  }

  function updateFromInput(input) {
    const value = input.dataset.format === 'lines' ? list(input.value) : input.value;
    setPath(input.dataset.path, value);
    saveState('Saved locally');
    renderPreview();
  }

  form.addEventListener('input', function (event) {
    const input = event.target.closest('[data-path]');
    if (input) updateFromInput(input);
  });

  form.addEventListener('click', function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const section = button.dataset.section;
    const index = Number(button.dataset.index);
    if (button.dataset.action === 'add') {
      state[section].push(itemTemplate(section));
      renderForm();
      renderPreview();
      saveState('Added a new entry');
    }
    if (button.dataset.action === 'remove') {
      state[section].splice(index, 1);
      renderForm();
      renderPreview();
      saveState('Removed the entry');
    }
  });

  root.addEventListener('click', function (event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.closest('form')) return;
    const action = button.dataset.action;
    if (action === 'print') window.print();
    if (action === 'reset') {
      state = clone(defaultState);
      saveState('Reset to the template data');
      renderForm();
      renderPreview();
    }
    if (action === 'export') {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'xuanming-ding-cv.json';
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus('Exported JSON');
    }
    if (action === 'import') importFile.click();
  });

  importFile.addEventListener('change', function () {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        state = normalize(JSON.parse(reader.result));
        saveState('Imported JSON');
        renderForm();
        renderPreview();
      } catch (error) {
        setStatus('Could not import this JSON file');
      }
      importFile.value = '';
    };
    reader.readAsText(file);
  });

  renderForm();
  renderPreview();
})();
