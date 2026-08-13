// dm-asset block
// Rendered from the markup inserted by the DM Asset Picker tool:
//   row 1 → static preview image (Dynamic Media rendition)
//   row 2 → the Dynamic Media delivery URL (as a link)
export default function decorate(block) {
  const [imageRow, urlRow] = block.children;

  const media = imageRow?.querySelector('picture, img');
  const link = urlRow?.querySelector('a');
  const url = link?.getAttribute('href') || urlRow?.textContent?.trim() || '';

  const figure = document.createElement('figure');
  figure.className = 'dm-asset-figure';
  if (media) figure.append(media);

  if (url) {
    const caption = document.createElement('figcaption');
    caption.className = 'dm-asset-caption';

    const anchor = document.createElement('a');
    anchor.className = 'dm-asset-url';
    anchor.href = url;
    anchor.textContent = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener';

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'dm-asset-copy';
    copy.textContent = 'Copy URL';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        copy.textContent = 'Copied!';
      } catch (e) {
        copy.textContent = 'Copy failed';
      }
      setTimeout(() => { copy.textContent = 'Copy URL'; }, 1500);
    });

    caption.append(anchor, copy);
    figure.append(caption);
  }

  block.textContent = '';
  block.append(figure);
}
