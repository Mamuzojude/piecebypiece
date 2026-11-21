const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const token = params.get('token') || '';
let statusData = null;

function showError(title, message) {
  $('loading-state').hidden = true;
  $('welcome-state').hidden = true;
  $('piece-state').hidden = true;
  $('error-state').hidden = false;
  $('error-title').textContent = title;
  $('error-copy').textContent = message;
}
function updateProgress() {
  const total = statusData?.assignedCount || 1;
  const done = statusData?.revealedCount || 0;
  $('progress-count').textContent = `${done} / ${total}`;
  $('progress-fill').style.width = `${Math.min(100, done / total * 100)}%`;
}
async function load() {
  if (token.length < 32) {
    showError('This invitation link looks incomplete.', 'Ask the person who invited you to send your personal link again.');
    return;
  }
  try {
    const response = await fetch(`/.netlify/functions/participant-status?token=${encodeURIComponent(token)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'This invitation could not be opened.');
    statusData = data;
    $('loading-state').hidden = true;
    if (data.experienceStatus === 'draft') {
      showError('Your experience is not live yet.', 'Your invitation is ready. Come back when the organizer launches the experience.');
      return;
    }
    if (data.experienceStatus === 'expired') {
      showError('This experience has ended.', 'The organizer has closed this experience, so no more pieces can be revealed.');
      return;
    }
    if (data.experienceStatus === 'completed') {
      showError('The picture is complete!', 'Everyone has contributed their pieces. Thank you for being part of it.');
      return;
    }
    $('welcome-state').hidden = false;
    $('welcome-title').textContent = `You're part of ${data.experienceTitle}.`;
    $('welcome-copy').textContent = `Welcome, ${data.participantName}. Every piece matters, and yours is waiting.`;
    if (data.revealMode === 'challenge') { $('challenge-panel').hidden = false; $('challenge-prompt').textContent = data.challengePrompt || 'Complete the challenge set by your organizer.'; $('ready-button').disabled = true; $('ready-button').textContent = 'Complete the challenge first'; }
    updateProgress();
    if (data.remainingCount === 0) {
      $('challenge-panel').hidden = true;
      $('confirm-step').hidden = true;
      $('reveal-step').hidden = true;
      $('reveal-status').textContent = 'You have revealed all the pieces assigned to you.';
    }
  } catch (error) {
    showError("We couldn't open this invitation.", error.message || 'Please check the link and try again.');
  }
}

$('challenge-complete').addEventListener('change', () => { if ($('challenge-complete').checked) { $('ready-button').disabled = false; $('ready-button').textContent = "I'm ready to reveal my piece →"; } else { $('ready-button').disabled = true; $('ready-button').textContent = 'Complete the challenge first'; } });
$('ready-button').addEventListener('click', () => {
  if (!$('ready-button').disabled && !$('challenge-panel').hidden && !$('challenge-complete').checked) return;
  $('confirm-step').hidden = true;
  $('reveal-step').hidden = false;
});
$('reveal-button').addEventListener('click', async () => {
  const button = $('reveal-button');
  button.disabled = true;
  $('milestone-note').hidden = true;
  $('reveal-status').textContent = 'Revealing your piece…';
  try {
    const response = await fetch('/.netlify/functions/reveal-piece', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, challengeCompleted: $('challenge-panel').hidden || $('challenge-complete').checked, challengeResponse: $('challenge-response').value.trim() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Your piece could not be revealed.');
    if (data.complete) {
      $('reveal-step').hidden = true;
      $('reveal-status').textContent = data.message;
      return;
    }
    $('welcome-state').hidden = true;
    $('piece-state').hidden = false;
    $('piece-image').src = data.imageUrl;
    $('board-link').href = `board.html?id=${encodeURIComponent(data.experienceId)}`;
    $('board-link').hidden = false;
    $('piece-number').textContent = `PIECE ${data.pieceNumber}`;
    if (data.milestoneReached) { const notes = {25:'A quarter of the picture is now revealed!',50:'Half of the picture is here!',75:'The picture is almost complete!',100:'The whole picture has come together!'}; $('milestone-note').textContent = notes[data.milestoneReached]; $('milestone-note').hidden = false; }
    $('piece-copy').textContent = 'Your piece has been revealed. It is one part of a bigger picture.';
    if (data.completed) {
      $('finished-message').hidden = false;
      $('completion-copy').textContent = data.completionMessage || 'Thank you for being part of this moment.';
    } else if (data.participantRemaining > 0) {
      $('next-piece-button').hidden = false;
    } else {
      $('finished-message').hidden = false;
      $('finished-message').querySelector('h2').textContent = 'You have revealed your pieces!';
      $('completion-copy').textContent = 'Thank you for adding your part to the bigger picture.';
    }
  } catch (error) {
    $('reveal-status').textContent = error.message || 'Please try again.';
    $('confirm-step').hidden = false;
    $('reveal-step').hidden = true;
  } finally {
    button.disabled = false;
  }
});
$('next-piece-button').addEventListener('click', () => {
  statusData.revealedCount = (statusData.revealedCount || 0) + 1;
  statusData.remainingCount = Math.max(0, (statusData.remainingCount || 1) - 1);
  updateProgress();
  $('piece-state').hidden = true;
  $('milestone-note').hidden = true;
  $('welcome-state').hidden = false;
  $('confirm-step').hidden = false;
  $('reveal-step').hidden = true;
  $('reveal-status').textContent = 'Ready for your next piece?';
});
load();
