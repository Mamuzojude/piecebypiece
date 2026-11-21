import { createHash, randomBytes, randomUUID } from 'node:crypto';
import sharp from 'sharp';

const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
const cleanBase = value => String(value || '').replace(/\/$/, '');

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const url = cleanBase(process.env.SUPABASE_URL);
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return json(503, { error: 'The secure invitation service is not configured yet.' });
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) return json(401, { error: 'Please sign in again before creating invitations.' });
  const authResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` } });
  if (!authResponse.ok) return json(401, { error: 'Your sign-in session is invalid or has expired.' });
  const user = await authResponse.json();
  let input;
  try { input = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid request body.' }); }
  const experienceId = String(input.experienceId || '');
  const names = Array.isArray(input.participants) ? input.participants.map(n => String(n).trim()).filter(Boolean) : [];
  if (!/^[0-9a-f-]{36}$/i.test(experienceId)) return json(400, { error: 'Invalid experience.' });
  if (!names.length || names.length > 100 || names.some(n => n.length > 80)) return json(400, { error: 'Add between 1 and 100 participant names. Each name must be 80 characters or fewer.' });
  if (new Set(names.map(n => n.toLocaleLowerCase())).size !== names.length) return json(400, { error: 'Participant names must be unique within this experience.' });

  const api = `${url}/rest/v1`;
  const adminHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
  const expResponse = await fetch(`${api}/experiences?id=eq.${encodeURIComponent(experienceId)}&select=id,owner_id,piece_count,grid_rows,grid_columns,image_width,image_height,image_path,status`, { headers: adminHeaders });
  if (!expResponse.ok) return json(502, { error: 'Could not verify the experience.' });
  const exp = (await expResponse.json())[0];
  if (!exp || exp.owner_id !== user.id) return json(404, { error: 'Experience not found for this organizer.' });
  if (exp.status !== 'draft') return json(409, { error: 'Invitations can only be created for a draft experience.' });
  if (!exp.image_path || !exp.image_width || !exp.image_height) return json(400, { error: 'The experience image is missing its dimensions. Please recreate the draft with the image selected.' });
  if (names.length > exp.piece_count) return json(400, { error: `You listed ${names.length} people but selected only ${exp.piece_count} pieces. Increase the piece count or reduce the participant list so everyone can receive at least one piece.` });
  const existingResponse = await fetch(`${api}/participants?experience_id=eq.${encodeURIComponent(experienceId)}&select=id&limit=1`, { headers: adminHeaders });
  if (!existingResponse.ok) return json(502, { error: 'Could not check existing participants.' });
  if ((await existingResponse.json()).length) return json(409, { error: 'Invitations have already been created for this experience.' });

  const people = names.map(display_name => {
    const token = randomBytes(32).toString('base64url');
    return { id: randomUUID(), display_name, token, token_hash: createHash('sha256').update(token).digest('hex') };
  });
  const participantResponse = await fetch(`${api}/participants`, { method: 'POST', headers: { ...adminHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(people.map(p => ({ id: p.id, experience_id: experienceId, display_name: p.display_name, token_hash: p.token_hash, invitation_status: 'pending' }))) });
  if (!participantResponse.ok) return json(502, { error: 'Could not save participants. No invitation links were issued.' });

  const pieces = [];
  const uploadedPaths = [];
  let rows = 0, cols = 0;
  try {
    const sourceResponse = await fetch(`${url}/storage/v1/object/experience-images/${exp.image_path}`, { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } });
    if (!sourceResponse.ok) throw new Error('The original image could not be read from private storage.');
    const downloadedImage = Buffer.from(await sourceResponse.arrayBuffer());
    const sourceBuffer = await sharp(downloadedImage).rotate().toBuffer();
    const metadata = await sharp(sourceBuffer).metadata();
    const actualWidth = metadata.width || exp.image_width;
    const actualHeight = metadata.height || exp.image_height;
    let suggestedLayout = { rows: 1, columns: exp.piece_count, score: Number.POSITIVE_INFINITY };
    for (let candidateRows = 1; candidateRows <= exp.piece_count; candidateRows++) {
      const candidateColumns = Math.ceil(exp.piece_count / candidateRows);
      const tileAspect = (actualWidth / actualHeight) * candidateRows / candidateColumns;
      const score = Math.abs(Math.log(tileAspect));
      if (score < suggestedLayout.score - 1e-9 || (Math.abs(score - suggestedLayout.score) < 1e-9 && candidateRows < suggestedLayout.rows)) suggestedLayout = { rows: candidateRows, columns: candidateColumns, score };
    }
    cols = exp.grid_columns || suggestedLayout.columns;
    rows = exp.grid_rows || suggestedLayout.rows;
    if (rows < 1 || cols < 1 || rows > exp.piece_count || rows * cols < exp.piece_count || cols !== Math.ceil(exp.piece_count / rows)) throw new Error('The selected layout does not have enough spaces for all puzzle pieces.');
    const basePiecesPerRow = Math.floor(exp.piece_count / rows);
    const extraPieces = exp.piece_count % rows;
    const rowCounts = Array.from({ length: rows }, (_, row) => basePiecesPerRow + (row < extraPieces ? 1 : 0));
    if (rowCounts.some(count => count > cols)) throw new Error('The selected columns are too few for the chosen rows.');
    const rowStarts = []; let runningPieceIndex = 0;
    for (const rowCount of rowCounts) { rowStarts.push(runningPieceIndex); runningPieceIndex += rowCount; }
    for (let batchStart = 0; batchStart < exp.piece_count; batchStart += 8) {
      const indices = Array.from({ length: Math.min(8, exp.piece_count - batchStart) }, (_, offset) => batchStart + offset);
      const results = await Promise.allSettled(indices.map(async index => {
        let row = 0;
        while (row + 1 < rows && index >= rowStarts[row + 1]) row++;
        const piecesInRow = rowCounts[row];
        const column = index - rowStarts[row];
        const x0 = Math.floor(column * actualWidth / piecesInRow);
        const x1 = Math.floor((column + 1) * actualWidth / piecesInRow);
        const y0 = Math.floor(row * actualHeight / rows);
        const y1 = Math.floor((row + 1) * actualHeight / rows);
        const crop = await sharp(sourceBuffer).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).webp({ quality: 88 }).toBuffer();
        const piecePath = `${experienceId}/${index + 1}.webp`;
        const upload = await fetch(`${url}/storage/v1/object/experience-pieces/${piecePath}`, { method: 'POST', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'image/webp', 'x-upsert': 'true' }, body: crop });
        if (!upload.ok) throw new Error('A puzzle tile could not be saved to private storage.');
        uploadedPaths.push(piecePath);
        return { experience_id: experienceId, participant_id: people[index % people.length].id, piece_number: index + 1, grid_row: row, grid_column: column, image_x: x0, image_y: y0, image_width: x1 - x0, image_height: y1 - y0, image_piece_path: piecePath };
      }));
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      pieces.push(...results.map(result => result.value));
    }
    await fetch(`${api}/experiences?id=eq.${encodeURIComponent(experienceId)}`, { method: 'PATCH', headers: { ...adminHeaders, Prefer: 'return=minimal' }, body: JSON.stringify({ image_width: actualWidth, image_height: actualHeight, grid_rows: rows, grid_columns: cols }) });
    const pieceResponse = await fetch(`${api}/puzzle_pieces`, { method: 'POST', headers: { ...adminHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(pieces) });
    if (!pieceResponse.ok) throw new Error('The puzzle assignments could not be saved.');
  } catch (error) {
    if (uploadedPaths.length) await fetch(`${url}/storage/v1/object/experience-pieces`, { method: 'DELETE', headers: adminHeaders, body: JSON.stringify({ prefixes: uploadedPaths }) });
    await fetch(`${api}/participants?experience_id=eq.${encodeURIComponent(experienceId)}`, { method: 'DELETE', headers: adminHeaders });
    return json(502, { error: `${error.message || 'Could not prepare puzzle pieces.'} No invitations were issued; please try again.` });
  }

  const base = cleanBase(process.env.URL || process.env.DEPLOY_URL || event.headers.origin);
  return json(200, {
    message: 'Participants, private image tiles, and piece assignments created.',
    participants: people.map(p => ({ id: p.id, name: p.display_name, pieceNumbers: pieces.filter(piece => piece.participant_id === p.id).map(piece => piece.piece_number), invitationUrl: `${base}/reveal.html?token=${encodeURIComponent(p.token)}` })),
    pieceCount: exp.piece_count, grid: { rows, columns: cols }
  });
}
