const $ = id => document.getElementById(id);
const boardId = new URLSearchParams(location.search).get('id');
let boardBusy = false;
let boardLoaded = false;

async function loadBoard() {
  if (boardBusy) return;
  if (!boardId) {
    $('board-loading').textContent = 'This shared picture link is incomplete.';
    return;
  }
  boardBusy = true;
  if (!boardLoaded) {
    $('board-loading').hidden = false;
    $('board-loading').textContent = 'Bringing the pieces together…';
    $('puzzle-board').hidden = true;
  }
  try {
    const response = await fetch(`/.netlify/functions/public-board?id=${encodeURIComponent(boardId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load this shared picture.');

    $('board-title').textContent = data.title;
    const shareUrl = location.href;
    const shareText = `${data.title} — the picture is coming together, one piece at a time.`;
    $('facebook-board-link').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    $('whatsapp-board-link').href = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
    $('telegram-board-link').href = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    $('board-subtitle').textContent = data.complete ? 'Every piece has found its place.' : data.expired ? 'This experience has ended. Here is the picture so far.' : 'Every contribution brings the bigger picture into focus.';
    $('board-count').textContent = `${data.revealedCount} / ${data.pieceCount}`;
    $('board-progress-fill').style.width = `${Math.min(100, data.revealedCount / data.pieceCount * 100)}%`;
    $('board-message').textContent = data.complete ? 'A little part from everyone. A bigger picture together.' : data.expired ? 'No more pieces can be revealed.' : data.progressPercent>=75 ? 'The picture is almost complete!' : data.progressPercent>=50 ? 'Half the picture is here!' : data.progressPercent>=25 ? 'A quarter of the picture is now revealed!' : 'The picture is growing, one reveal at a time.';

    const host = $('puzzle-board');
    host.innerHTML = '';
    const rows = data.rows || [];
    const rowHeight = (data.imageHeight || 1) / Math.max(1, rows.length);
    for (const row of rows) {
      const rowEl = document.createElement('div');
      rowEl.className = 'puzzle-row';
      rowEl.style.gridTemplateColumns = `repeat(${Math.max(1, row.columnCount)}, minmax(0, 1fr))`;
      rowEl.style.aspectRatio = `${data.imageWidth || 1} / ${rowHeight || 1}`;
      for (const tile of row.tiles) {
        const cell = document.createElement('div');
        cell.className = `puzzle-cell ${tile.revealed ? 'revealed' : 'unrevealed'}`;
        if (tile.revealed && tile.imageUrl) {
          const img = document.createElement('img');
          img.src = tile.imageUrl;
          img.alt = `Revealed puzzle piece ${tile.number}`;
          cell.appendChild(img);
          if (data.showParticipantNames && tile.participantName) {
            const credit = document.createElement('span');
            credit.className = 'tile-credit';
            credit.textContent = tile.participantName;
            cell.appendChild(credit);
          }
        } else {
          const mark = document.createElement('div');
          mark.className = 'unrevealed-mark';
          mark.innerHTML = `<b>${String(tile.number).padStart(2, '0')}</b><small>Not revealed yet</small>`;
          cell.appendChild(mark);
        }
        rowEl.appendChild(cell);
      }
      host.appendChild(rowEl);
    }
    $('board-loading').hidden = true;
    host.hidden = false;
    boardLoaded = true;
    $('board-complete').hidden = !data.complete;
    $('board-completion-copy').textContent = data.completionMessage || 'Thank you to everyone who helped bring this picture together.';
  } catch (error) {
    if (!boardLoaded) $('board-loading').textContent = error.message || 'Could not load this shared picture.';
    else $('board-message').textContent = 'Could not refresh just now. The last picture is still shown.';
  } finally {
    boardBusy = false;
  }
}

$('share-board-button').addEventListener('click', async () => {
  if (navigator.share) {
    try { await navigator.share({ title: document.title, text: $('board-title').textContent, url: location.href }); } catch {}
  } else {
    try { await navigator.clipboard.writeText(location.href); $('share-board-button').textContent = 'Link copied'; }
    catch { $('share-board-button').textContent = 'Share unavailable'; }
  }
});
$('copy-board-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); $('copy-board-link').textContent = 'Copied'; }
  catch { $('copy-board-link').textContent = 'Copy unavailable'; }
});
$('refresh-board').addEventListener('click', loadBoard);
loadBoard();
setInterval(() => { if (!document.hidden) loadBoard(); }, 20000);
