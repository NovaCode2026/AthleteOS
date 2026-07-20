import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const env = Object.fromEntries((await readFile(join(root, '.env.local'), 'utf8').catch(() => '')).split(/\r?\n/).map(line => line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, '')]));
const model = env.OPENAI_MODEL || 'gpt-4.1-mini';

function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
async function body(req) { let raw=''; for await (const part of req) { raw += part; if(raw.length > 3_000_000) throw new Error('Request is too large.'); } return raw ? JSON.parse(raw) : {}; }
function safeUrl(value) { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url.hostname)) throw new Error('Use a public http(s) official source URL.'); return url; }
async function openai(input) {
  if (!env.OPENAI_API_KEY) throw new Error('OpenAI is not configured. Add OPENAI_API_KEY to .env.local and restart the server.');
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input, temperature: 0.2 }) });
  const result = await response.json(); if (!response.ok) throw new Error(result?.error?.message || 'OpenAI request failed.'); return result.output_text || result.output?.flatMap(item => item.content || []).map(item => item.text || '').join('') || '';
}
async function sourceText({ sourceUrl, sourceText }) {
  if (sourceText?.trim()) return sourceText.trim().slice(0, 100000);
  if (!sourceUrl) throw new Error('Add an official source URL or paste the official update text.');
  const url = safeUrl(sourceUrl); const response = await fetch(url, { signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': 'AthleteOS/1.0 official-update-reader' } });
  if (!response.ok) throw new Error(`Official source returned ${response.status}.`); return (await response.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]*>/gi, ' ').replace(/\s+/g, ' ').slice(0,100000);
}
function localEventExtraction(text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const dates = [...new Set(normalized.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g) || [])];
  const registration = (normalized.match(/[^.]{0,90}(?:registration|register)[^.]{0,130}/i) || [''])[0].trim();
  const venue = (normalized.match(/(?:venue|at)\s+([^.,;]{3,100})/i) || ['', ''])[1].trim();
  return { summary: 'Official update saved. AI summary is unavailable, so review the extracted source details.', changes: dates.length ? [`Dates found: ${dates.join(', ')}`] : ['Source content saved for review.'], dates, venue, registration, actionItems: ['Review the official source before acting on this update.'], confidence: 'needs_review', localFallback: true };
}
async function api(req, res, path) {
  if (req.method === 'GET' && path === '/api/health') return json(res, 200, { configured: Boolean(env.OPENAI_API_KEY), model });
  if (req.method === 'GET' && path === '/api/weather') { const city = new URL(req.url, 'http://x').searchParams.get('city') || 'New Delhi'; const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`).then(r=>r.json()); const place=geo.results?.[0]; if(!place) throw new Error('Location not found.'); const forecast=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`).then(r=>r.json()); return json(res,200,{ place:`${place.name}, ${place.country}`, current:forecast.current }); }
  if (req.method !== 'POST') return json(res, 404, { error: 'Not found.' });
  const data = await body(req);
  if (path === '/api/event-scan') { const text=await sourceText(data); let parsed; try { const result=await openai(`You are AthleteOS, a cautious Taekwondo competition assistant. Analyze this official update for the event "${data.eventName || 'Taekwondo event'}". Return ONLY valid JSON with keys summary (string, max 60 words), changes (array of concise strings), dates (array), venue (string or empty), registration (string or empty), actionItems (array), confidence (verified|needs_review). Never invent facts. Official update:\n${text}`); try { parsed=JSON.parse(result.replace(/^```json\s*|\s*```$/g,'')); } catch { parsed={ summary:result, changes:[], dates:[], venue:'', registration:'', actionItems:[], confidence:'needs_review' }; } } catch (error) { parsed=localEventExtraction(text); parsed.aiError=error.message; } return json(res,200,{...parsed, scannedAt:new Date().toISOString(), sourceUrl:data.sourceUrl||''}); }
  if (path === '/api/certificate-scan') { if(!data.imageData) throw new Error('Choose a certificate image first.'); try { const result=await openai([{ role:'user', content:[{ type:'input_text', text:'Extract certificate details. Return ONLY JSON with event, organizer, date, medal, position, category, location. Use empty strings where unavailable. Do not guess.' },{ type:'input_image', image_url:data.imageData }] }]); let parsed; try { parsed=JSON.parse(result.replace(/^```json\s*|\s*```$/g,'')); } catch { parsed={ event:'',organizer:'',date:'',medal:'',position:'',category:'',location:'',raw:result }; } return json(res,200,parsed); } catch (error) { return json(res,200,{ event:'',organizer:'',date:'',medal:'',position:'',category:'',location:'',needsManualReview:true,message:'AI extraction is temporarily unavailable. Add the achievement manually after reviewing the certificate.' }); } }
  return json(res,404,{error:'Not found.'});
}
const port = Number(process.env.PORT || 4173);
createServer(async (req,res) => { try { const path=(req.url?.split('?')[0]||'/'); if(path.startsWith('/api/')) return await api(req,res,path); const relative=path==='/'?'index.html':path.replace(/^\/+/, ''); const file=normalize(join(root,relative)); if(!file.startsWith(root)) return res.writeHead(403).end('Forbidden'); if(!(await stat(file)).isFile()) throw new Error('not file'); res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'}); res.end(await readFile(file)); } catch(error) { if((req.url||'').startsWith('/api/')) return json(res,400,{error:error.message||'Request failed.'}); res.writeHead(404).end('Not found'); } }).listen(port,()=>console.log(`AthleteOS running at http://localhost:${port}`));
