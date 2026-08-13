// DM Asset Picker — DA Library plugin
// -----------------------------------------------------------------------------
// Lets an author pick an asset from an AEM instance (via the Adobe Asset
// Selector) and inserts a `dm-asset` block into the current DA document. The
// block carries the asset's AEMaaCS Dynamic Media (delivery) URL plus a static
// image preview.
//
// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

// ── Configuration ────────────────────────────────────────────────────────────
// Fill these in for your AEM instance. Until IMS_CLIENT_ID and REPOSITORY_ID
// are set, the tool shows a "needs configuration" banner instead of the picker.
const CONFIG = {
  // AEM host the Asset Selector browses. For the delivery (OpenAPI) tier this is
  // the delivery host, e.g. 'delivery-p12345-e67890.adobeaemcloud.com'.
  REPOSITORY_ID: 'delivery-pXXXXX-eYYYYY.adobeaemcloud.com',
  // Host used to build the Dynamic Media delivery URL. Leave '' to reuse
  // REPOSITORY_ID (correct when browsing the delivery tier). Set this only if
  // you browse one host but deliver from another.
  DELIVERY_HOST: '',
  // Which AEM tier to browse: 'delivery' (published assets, OpenAPI) or 'author'.
  AEM_TIER: 'delivery',
  // IMS client registered in Adobe Developer Console. Its redirect-URI allowlist
  // must include this tool's URL (…/tools/dm-asset-picker/dm-asset-picker.html).
  IMS_CLIENT_ID: 'YOUR_IMS_CLIENT_ID',
  IMS_SCOPE: 'openid,AdobeID,additional_info.projectedProductContext,read_organizations,additional_info.roles',
  IMS_ENV: 'PROD',
  // Width (px) of the static preview rendition embedded in the block.
  PREVIEW_WIDTH: 750,
};

const ASSET_SELECTOR_SRC = 'https://experience.adobe.com/solutions/CQ-assets-selectors/static-assets/resources/assets-selector.js';

// ── Small DOM + string helpers ───────────────────────────────────────────────
function el(tag, opts = {}, ...children) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text) node.textContent = opts.text;
  if (opts.html) node.innerHTML = opts.html;
  if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, v));
  children.forEach((c) => c && node.append(c));
  return node;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isConfigured() {
  return CONFIG.IMS_CLIENT_ID
    && CONFIG.IMS_CLIENT_ID !== 'YOUR_IMS_CLIENT_ID'
    && !CONFIG.REPOSITORY_ID.includes('XXXXX');
}

function deliveryHost() {
  return CONFIG.DELIVERY_HOST || CONFIG.REPOSITORY_ID;
}

// The Asset Selector returns AEM repository metadata; the asset id is the
// urn:aaid:aem:… value used to build a delivery URL.
function assetId(asset) {
  return asset['repo:id'] || asset.assetId || asset.id || '';
}

function assetName(asset) {
  return asset['repo:name'] || asset.name || asset.title || 'asset';
}

// Build the AEMaaCS Dynamic Media delivery URL for an asset.
function deliveryUrl(asset) {
  const id = assetId(asset);
  const name = encodeURIComponent(assetName(asset));
  return `https://${deliveryHost()}/adobe/assets/${id}/as/${name}`;
}

function previewUrl(asset) {
  return `${deliveryUrl(asset)}?width=${CONFIG.PREVIEW_WIDTH}&preferwebp=true`;
}

// The DA block markup: first row is the block name, then the static preview
// image, then the Dynamic Media URL as a link.
function blockHtml(asset) {
  const dm = deliveryUrl(asset);
  const preview = previewUrl(asset);
  const name = esc(assetName(asset));
  return '<table><tbody>'
    + '<tr><td>dm-asset</td></tr>'
    + `<tr><td><img src="${esc(preview)}" alt="${name}"></td></tr>`
    + `<tr><td><a href="${esc(dm)}">${esc(dm)}</a></td></tr>`
    + '</tbody></table>';
}

// ── Load the Adobe Asset Selector micro-frontend ─────────────────────────────
function loadAssetSelector() {
  if (window.PureJSSelectors) return Promise.resolve(window.PureJSSelectors);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = ASSET_SELECTOR_SRC;
    s.onload = () => resolve(window.PureJSSelectors);
    s.onerror = () => reject(new Error('Failed to load the Adobe Asset Selector script.'));
    document.head.append(s);
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async function init() {
  const { actions } = await DA_SDK;

  const root = el('div', { class: 'dm-root' });
  root.append(el('div', { class: 'dm-header' },
    el('h1', { class: 'dm-title', text: 'DM Asset Picker' }),
    el('p', { class: 'dm-sub', text: 'Pick an asset from AEM to insert a Dynamic Media block with a live preview.' })));
  document.body.append(root);

  if (!isConfigured()) {
    root.append(el('div', {
      class: 'dm-banner',
      html: 'Almost there — this tool needs your AEM details. Open '
        + '<code>/tools/dm-asset-picker/dm-asset-picker.js</code> and set '
        + '<code>REPOSITORY_ID</code> and <code>IMS_CLIENT_ID</code> in the CONFIG block, '
        + 'then push to your repo.',
    }));
    return;
  }

  const selectorHost = el('div', { class: 'dm-selector', attrs: { id: 'dm-selector' } });
  const preview = el('div', { class: 'dm-preview' });
  root.append(selectorHost, preview);

  const renderPreview = (asset) => {
    const dm = deliveryUrl(asset);
    preview.innerHTML = '';

    const img = el('img', { class: 'dm-card-img', attrs: { src: previewUrl(asset), alt: assetName(asset) } });
    const meta = el('div', { class: 'dm-card-meta' },
      el('div', { class: 'dm-card-name', text: assetName(asset) }),
      el('a', { class: 'dm-card-url', text: dm, attrs: { href: dm, target: '_blank', rel: 'noopener' } }));

    const status = el('span', { class: 'dm-status' });
    const insertBtn = el('button', { class: 'dm-btn dm-btn-primary', text: 'Insert block' });
    const insertCloseBtn = el('button', { class: 'dm-btn', text: 'Insert & close' });

    const doInsert = () => {
      if (!actions?.sendHTML) {
        status.textContent = 'Open this tool inside DA to insert a block.';
        return false;
      }
      actions.sendHTML(blockHtml(asset));
      return true;
    };

    insertBtn.addEventListener('click', () => {
      if (doInsert()) status.textContent = '✓ Inserted a dm-asset block.';
    });
    insertCloseBtn.addEventListener('click', () => {
      if (doInsert()) actions.closeLibrary();
    });

    const bar = el('div', { class: 'dm-card-actions' }, insertBtn, insertCloseBtn, status);
    preview.append(el('div', { class: 'dm-card' }, img, meta, bar));
  };

  try {
    const PureJSSelectors = await loadAssetSelector();
    PureJSSelectors.renderAssetSelectorWithAuthFlow(
      selectorHost,
      {
        imsClientId: CONFIG.IMS_CLIENT_ID,
        imsScope: CONFIG.IMS_SCOPE,
        redirectUrl: window.location.href,
        env: CONFIG.IMS_ENV,
        repositoryId: CONFIG.REPOSITORY_ID,
        aemTierType: CONFIG.AEM_TIER,
        onClose: () => {},
        handleSelection: (assets) => {
          const asset = Array.isArray(assets) ? assets[0] : assets;
          if (asset) renderPreview(asset);
        },
      },
      () => {}, // onImsLoggedIn
      () => {}, // onImsLoggedOut
    );
  } catch (err) {
    root.append(el('div', { class: 'dm-banner dm-banner-error', text: err.message }));
  }
}());
