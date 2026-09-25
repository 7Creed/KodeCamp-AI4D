const form = document.querySelector('#review-form');
const type = document.querySelector('#type');
const referenceField = document.querySelector('#reference-field');
const diffField = document.querySelector('#diff-field');
const status = document.querySelector('#status');
const report = document.querySelector('#report');

let currentFindings = [];

type.addEventListener('change', updateTargetFields);

function updateTargetFields() {
  referenceField.hidden = !['commit', 'pull-request'].includes(type.value);

  diffField.hidden = type.value !== 'diff';
}

updateTargetFields();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  status.hidden = false;
  report.hidden = true;
  status.innerHTML =
    '<strong>Review in progress…</strong><p>The supervisor is selecting specialist agents.</p>';

  const payload = {
    type: type.value,
    repositoryPath: document.querySelector('#repositoryPath').value,
  };

  const reference = document.querySelector('#reference').value.trim();

  const diff = document.querySelector('#diff').value.trim();

  if (reference) payload.reference = reference;
  if (diff) payload.diff = diff;

  try {
    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? 'Review failed.');
    }

    status.hidden = true;
    renderReport(data);
    await loadHistory();
  } catch (error) {
    status.innerHTML = `<strong>Review failed</strong><p>${escapeHtml(error.message)}</p>`;
  }
});

function renderReport(review) {
  report.hidden = false;

  document.querySelector('#recommendation').textContent =
    review.result.recommendation;

  document.querySelector('#specialists').innerHTML = `
    <p><strong>Selected specialists:</strong>
      ${review.result.supervisor.specialists.join(', ')}
    </p>
    <p>${escapeHtml(review.result.supervisor.reasoning)}</p>
  `;

  document.querySelector('#activity').innerHTML = (review.result.activity ?? [])
    .map(
      (item) => `
      <div class="activity-item">
        <strong>${escapeHtml(item.stage)}</strong>
        <span>${escapeHtml(item.status)}</span>
        <small>${escapeHtml(item.message)}</small>
      </div>
    `,
    )
    .join('');

  currentFindings = review.result.findings ?? [];
  buildFilters(currentFindings);
  renderFindings();
}

function buildFilters(findings) {
  fillFilter(
    '#category-filter',
    findings.map((item) => item.category),
    'All categories',
  );

  fillFilter(
    '#file-filter',
    findings.map((item) => item.file).filter(Boolean),
    'All files',
  );
}

function fillFilter(selector, values, label) {
  const element = document.querySelector(selector);
  const unique = [...new Set(values)];

  element.innerHTML =
    `<option value="">${label}</option>` +
    unique
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`,
      )
      .join('');
}

function renderFindings() {
  const severity = document.querySelector('#severity-filter').value;

  const category = document.querySelector('#category-filter').value;

  const file = document.querySelector('#file-filter').value;

  const filtered = currentFindings.filter(
    (finding) =>
      (!severity || finding.severity === severity) &&
      (!category || finding.category === category) &&
      (!file || finding.file === file),
  );

  document.querySelector('#findings').innerHTML = filtered.length
    ? filtered.map(findingCard).join('')
    : '<p>No findings match these filters.</p>';
}

function findingCard(finding) {
  const location = finding.file
    ? `${finding.file}${finding.lineStart ? `:${finding.lineStart}` : ''}`
    : 'Repository';

  return `
    <article class="finding">
      <div class="finding-top">
        <span class="severity">${escapeHtml(finding.severity)}</span>
        <span>${escapeHtml(finding.category)}</span>
      </div>
      <h3>${escapeHtml(finding.title)}</h3>
      <code>${escapeHtml(location)}</code>
      <p>${escapeHtml(finding.explanation)}</p>
      <p><strong>Impact:</strong> ${escapeHtml(finding.impact)}</p>
      <p><strong>Fix:</strong> ${escapeHtml(finding.recommendation)}</p>
      <small>
        ${escapeHtml(finding.agent)} ·
        ${escapeHtml(finding.confidence)} confidence
      </small>
    </article>
  `;
}

['#severity-filter', '#category-filter', '#file-filter'].forEach((selector) => {
  document.querySelector(selector).addEventListener('change', renderFindings);
});

async function loadHistory() {
  const response = await fetch('/api/reviews');
  const reviews = await response.json();

  document.querySelector('#history').innerHTML = reviews.length
    ? reviews
        .map(
          (review) => `
          <button
            class="history-item"
            data-review="${review.id}"
          >
            <strong>${escapeHtml(review.result.recommendation)}</strong>
            <span>${escapeHtml(review.target.type)}</span>
            <small>${new Date(review.createdAt).toLocaleString()}</small>
          </button>
        `,
        )
        .join('')
    : '<p>No reviews yet.</p>';

  document.querySelectorAll('[data-review]').forEach((button) => {
    button.addEventListener('click', async () => {
      const response = await fetch(`/api/reviews/${button.dataset.review}`);

      renderReport(await response.json());
    });
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

loadHistory();
