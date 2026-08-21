// Re-encodes existing listing photos that were accidentally stored as huge PNGs
// (iOS canvas.toBlob webp fallback) into small JPEGs, and stores a 400px
// thumbnail per photo. Originals are left in place so historical URLs keep
// working; the listing rows are pointed at the new, smaller files.
//
// Admin-only, one-off maintenance endpoint.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { decode, Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAIN_MAX = 1080;
const THUMB_W = 400;
const THUMB_H = 500;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const pathFromPublicUrl = (url: string): string | null => {
  const marker = '/storage/v1/object/public/listings/';
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Admin gate: parse the caller's JWT manually (cross-project safe).
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    let callerId: string | null = null;
    let callerRole: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      callerId = payload.sub ?? null;
      callerRole = payload.role ?? null;
    } catch {
      callerId = null;
    }

    // Service-role callers (maintenance runs) are trusted; everyone else must be admin.
    if (callerRole !== 'service_role') {
      if (!callerId) return json({ error: 'Unauthorized' }, 401);

      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: callerId,
        _role: 'admin',
      });
      if (!isAdmin) return json({ error: 'Forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 50, 200);

    const { data: listings, error } = await supabase
      .from('listings')
      .select('id, images, thumbnails')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return json({ error: error.message }, 500);

    const report: Array<Record<string, unknown>> = [];

    for (const listing of listings ?? []) {
      const images: string[] = listing.images ?? [];
      if (!images.length) continue;

      const newImages: string[] = [];
      const newThumbs: string[] = [];
      let changed = false;

      for (const url of images) {
        const path = pathFromPublicUrl(url);
        if (!path) {
          newImages.push(url);
          newThumbs.push(url);
          continue;
        }

        // Idempotency: a single ".opt.jpg" means this photo is already done.
        if (/^[^.]+\.opt\.jpg$/.test(path.split('/').pop() ?? '')) {
          newImages.push(url);
          newThumbs.push(url.replace(/\.opt\.jpg$/, '.thumb.jpg'));
          continue;
        }

        // Always re-encode from the ORIGINAL upload, never from a previous
        // pass, so repeated runs cannot stack generation loss.
        const baseStem = path.replace(/(\.opt)+\.jpg$/, '').replace(/\.[^./]+$/, '');
        const sourceCandidates = [`${baseStem}.webp`, `${baseStem}.jpg`, `${baseStem}.png`, path];

        try {
          let blob: Blob | null = null;
          for (const candidate of sourceCandidates) {
            const { data } = await supabase.storage.from('listings').download(candidate);
            if (data) { blob = data; break; }
          }
          if (!blob) throw new Error('download failed');

          const bytes = new Uint8Array(await blob.arrayBuffer());
          const decoded = await decode(bytes);
          if (!(decoded instanceof Image)) throw new Error('unsupported image');

          const stem = baseStem;

          // Main: cap the long edge at 1080 and re-encode as JPEG.
          const main = decoded.clone();
          const scale = Math.min(1, MAIN_MAX / Math.max(main.width, main.height));
          if (scale < 1) {
            main.resize(Math.round(main.width * scale), Math.round(main.height * scale));
          }
          const mainJpeg = await main.encodeJPEG(80);

          // Thumbnail: contained inside 400x500.
          const thumb = decoded.clone();
          const tScale = Math.min(1, THUMB_W / thumb.width, THUMB_H / thumb.height);
          thumb.resize(
            Math.max(1, Math.round(thumb.width * tScale)),
            Math.max(1, Math.round(thumb.height * tScale)),
          );
          const thumbJpeg = await thumb.encodeJPEG(72);

          const mainPath = `${stem}.opt.jpg`;
          const thumbPath = `${stem}.thumb.jpg`;

          const uploadOpts = {
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000, immutable',
            upsert: true,
          };

          const [mainUp, thumbUp] = await Promise.all([
            supabase.storage.from('listings').upload(mainPath, mainJpeg, uploadOpts),
            supabase.storage.from('listings').upload(thumbPath, thumbJpeg, uploadOpts),
          ]);

          const mainUrl = mainUp.error
            ? url
            : supabase.storage.from('listings').getPublicUrl(mainPath).data.publicUrl;
          const thumbUrl = thumbUp.error
            ? mainUrl
            : supabase.storage.from('listings').getPublicUrl(thumbPath).data.publicUrl;

          newImages.push(mainUrl);
          newThumbs.push(thumbUrl);
          changed = true;

          report.push({
            listing: listing.id,
            before: bytes.length,
            main: mainJpeg.length,
            thumb: thumbJpeg.length,
          });
        } catch (e) {
          console.error('backfill failed for', path, e);
          newImages.push(url);
          newThumbs.push(url);
        }
      }

      if (changed) {
        const { error: updErr } = await supabase
          .from('listings')
          .update({ images: newImages, thumbnails: newThumbs })
          .eq('id', listing.id);
        if (updErr) console.error('update failed', listing.id, updErr.message);
      }
    }

    return json({ success: true, processed: report.length, report });
  } catch (e) {
    console.error('backfill error', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
