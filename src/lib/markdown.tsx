import type { ReactNode } from 'react';

const MAX_BLOCKS = 900;
const MAX_LINE = 2000;
const MAX_INLINE_NODES = 500;
const MAX_INLINE_DEPTH = 4;
const MAX_TABLE_ROWS = 200;
const MAX_LIST_ITEMS = 400;

/* ------------------------------------------------------------------ */
/* HTML entities (fixes raw `&middot;`, `&amp;`, … leaking into view)  */
/* ------------------------------------------------------------------ */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  middot: '·', mdash: '—', ndash: '–', hellip: '…', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', bull: '•', trade: '™', copy: '©', reg: '®',
  times: '×', divide: '÷', rarr: '→', larr: '←', uarr: '↑', darr: '↓',
  harr: '↔', infin: '∞', deg: '°', plusmn: '±', sup2: '²', sup3: '³',
  frac12: '½', frac14: '¼', frac34: '¾', para: '¶', sect: '§', dagger: '†',
  Dagger: '‡', permil: '‰', euro: '€', pound: '£', yen: '¥', cent: '¢',
  laquo: '«', raquo: '»', iexcl: '¡', iquest: '¿', szlig: 'ß',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (full, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code < 0x110000) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return full;
        }
      }
      return full;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? full;
  });
}

/* ------------------------------------------------------------------ */
/* HTML normalization (strips layout wrappers, keeps content)          */
/* ------------------------------------------------------------------ */

function normalizeHtml(s: string): string {
  // protect fenced code + inline code from any rewriting
  const stash: string[] = [];
  const keep = (block: string) => {
    stash.push(block);
    return `\u0000${stash.length - 1}\u0000`;
  };
  s = s.replace(/```[\s\S]*?(```|$)/g, (m) => keep(m));
  s = s.replace(/`[^`\n]+`/g, (m) => keep(m));

  s = s.replace(/<!--[\s\S]*?-->/g, ''); // tracking pixels etc.
  // clickable badge → just the image
  s = s.replace(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>\s*(<img\b[^>]*>)\s*<\/a>/gi, '$2 ');
  s = s.replace(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  s = s.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    const src = /src=["']([^"']+)["']/i.exec(attrs);
    const alt = /alt=["']([^"']*)["']/i.exec(attrs);
    if (!src) return '';
    return `![${alt?.[1] ?? ''}](${src[1]})`;
  });
  s = s.replace(/<summary\b[^>]*>([\s\S]*?)<\/summary>/gi, '**$1**');
  s = s.replace(/<(details|p|div|span|center|section|article|figure|table|tbody|thead|tr|td|th|ul|ol|li|h[1-6])\b[^>]*>/gi, ' ');
  s = s.replace(/<\/(details|p|div|span|center|section|article|figure|table|tbody|thead|tr|td|th|ul|ol|li|h[1-6])>/gi, ' ');
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = s.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');
  s = s.replace(/<(b|strong)\b[^>]*>/gi, '**').replace(/<\/(b|strong)>/gi, '**');
  s = s.replace(/<(i|em)\b[^>]*>/gi, '*').replace(/<\/(i|em)>/gi, '*');
  s = s.replace(/<(s|del|strike)\b[^>]*>/gi, '~~').replace(/<\/(s|del|strike)>/gi, '~~');
  s = s.replace(/<code\b[^>]*>/gi, '`').replace(/<\/code>/gi, '`');
  s = s.replace(/<kbd\b[^>]*>/gi, '`').replace(/<\/kbd>/gi, '`');
  s = s.replace(/<sup\b[^>]*>([\s\S]*?)<\/sup>/gi, '^$1^');
  s = s.replace(/<sub\b[^>]*>([\s\S]*?)<\/sub>/gi, '_$1_');
  s = s.replace(/<[^>]+>/g, ''); // any remaining tag
  s = decodeEntities(s);
  s = s.replace(/\]\(([^)]*)\s{2,}([^)]*)\)/g, ']($1 $2)'); // spaces inside URLs from tag stripping
  s = s.replace(/^[ \t]+/gm, '');
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, idx) => stash[Number(idx)]);
  return s;
}

/* ------------------------------------------------------------------ */
/* inline parsing                                                      */
/* ------------------------------------------------------------------ */

const INLINE_RE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(~~[^~\n]+~~)|(!\[[^\]\n]*\]\([^)\n]+\))|(\[[^\]\n]+\]\([^)\n]+\))|(https?:\/\/[^\s<>"')\]]+)/g;

const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?[^)\s]*)?$/i;
const BADGE_HOSTS = /(shields\.io|badge|circleci|travis|coveralls|codecov|npmjs|appveyor|github\.com\/[^)\s]+\/workflows|readthedocs|deepsource|codefactor|snyk|david-dm|img\.shields)/i;

type Resolver = (src: string) => string;

/* A README is written by someone else, so every URL in it is untrusted input.
 *
 * React escapes text but does not vet URLs: `<a href="javascript:…">` renders
 * exactly as written, and clicking it runs script in *this* origin — the one
 * where the reader's GitHub token sits in localStorage. The sanitiser above
 * strips HTML tags; the tag stripping is not what makes this safe, and CodeQL
 * was right to flag it. The real fix belongs here, at the sink.
 *
 * Only schemes that cannot execute are allowed through. Everything else the
 * caller renders as plain text, so the reader still sees what the README said.
 */
function safeScheme(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  // Control characters are removed before the scheme is read. Browsers treat
  // "java\tscript:" and "java\nscript:" as "javascript:", so a check that looks
  // only at the raw prefix can be walked around — and the HTML-entity decode
  // upstream means "jav&#x61;script:" arrives here already spelled out.
  const cleaned = url.replace(/[\u0000-\u0020\u007f]/g, '');
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  // No scheme means a relative or fragment URL: same origin by construction,
  // and it cannot carry script. Leave it alone — that is how anchor links work.
  if (!m) return null;
  return m[1].toLowerCase();
}

/** An href, or null when the URL could execute script and must not be a link. */
function safeHref(raw: string): string | null {
  const scheme = safeScheme(raw);
  if (scheme === null) return raw.trim() || null;
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto' ? raw : null;
}

/**
 * An image src, or null. Images are read, not run: `data:image/...` is fine,
 * but `data:text/html` has no business in an <img>, and a scheme we do not
 * recognise is refused rather than guessed at.
 */
function safeSrc(raw: string, resolve: Resolver): string | null {
  const url = raw.trim();
  if (!url) return null;
  const scheme = safeScheme(url);
  if (scheme === null) return resolve(url);
  if (scheme === 'http' || scheme === 'https') return resolve(url);
  if (scheme === 'data' && /^data:image\//i.test(url.replace(/[\u0000-\u0020]/g, ''))) return url;
  return null;
}

function ImageNode({ src, alt, resolve }: { src: string; alt: string; resolve: Resolver }) {
  const isBadge = !IMG_EXT.test(src) || BADGE_HOSTS.test(src);
  const url = safeSrc(src, resolve);
  // A refused image renders as nothing rather than as a broken-image icon: the
  // alt text was never going to be shown for a URL we do not trust.
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={isBadge ? 'badge-img' : undefined}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}

function parseInline(text: string, keyBase: string, resolve: Resolver, depth = 0): ReactNode[] {
  const safe = text.length > MAX_LINE ? `${text.slice(0, MAX_LINE)}…` : text;
  const re = new RegExp(INLINE_RE.source, 'g'); // fresh cursor — recursion must not clobber outer loop
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(safe)) !== null) {
    if (m.index === re.lastIndex) re.lastIndex += 1;
    if (m.index > last) nodes.push(safe.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    const token = m[0];
    if (m[1]) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (m[2]) {
      nodes.push(
        <strong key={key}>
          {depth < MAX_INLINE_DEPTH ? parseInline(token.slice(2, -2), key, resolve, depth + 1) : token}
        </strong>,
      );
    } else if (m[3]) {
      nodes.push(
        <em key={key}>{depth < MAX_INLINE_DEPTH ? parseInline(token.slice(1, -1), key, resolve, depth + 1) : token}</em>,
      );
    } else if (m[4]) {
      nodes.push(<del key={key}>{token.slice(2, -2)}</del>);
    } else if (m[5]) {
      const mm = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(token)!;
      nodes.push(<ImageNode key={key} src={mm[2]} alt={mm[1]} resolve={resolve} />);
    } else if (m[6]) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
      if (IMG_EXT.test(mm[2])) {
        nodes.push(<ImageNode key={key} src={mm[2]} alt={mm[1]} resolve={resolve} />);
      } else {
        const href = safeHref(mm[2]);
        const label = depth < MAX_INLINE_DEPTH ? parseInline(mm[1], key, resolve, depth + 1) : mm[1];
        nodes.push(
          href ? (
            <a key={key} href={href} target="_blank" rel="noreferrer">
              {label}
            </a>
          ) : (
            // Refused. The label is kept as text so the README still reads the
            // way it was written — the reader just cannot follow it.
            <span key={key} title="Link blocked: the URL uses a scheme that can execute script">
              {label}
            </span>
          ),
        );
      }
    } else if (m[7]) {
      if (IMG_EXT.test(token)) {
        nodes.push(<ImageNode key={key} src={token} alt="" resolve={resolve} />);
      } else {
        const href = safeHref(token);
        nodes.push(
          href ? (
            <a key={key} href={href} target="_blank" rel="noreferrer">
              {token}
            </a>
          ) : (
            <span key={key} title="Link blocked: the URL uses a scheme that can execute script">
              {token}
            </span>
          ),
        );
      }
    }
    last = m.index + token.length;
    if (i >= MAX_INLINE_NODES) break;
  }
  if (last < safe.length) nodes.push(safe.slice(last));
  return nodes;
}

/* ------------------------------------------------------------------ */
/* block parsing                                                       */
/* ------------------------------------------------------------------ */

const isTableSep = (line: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

function youtubeId(url: string): string | null {
  const a = /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:[^#\s]*&)?v=([\w-]{6,})/.exec(url);
  if (a) return a[1];
  const b = /^(?:https?:\/\/)?(?:www\.)?youtu\.be\/([\w-]{6,})/.exec(url);
  return b ? b[1] : null;
}

export function Markdown({
  source,
  truncatedNotice,
  imageBase,
}: {
  source: string;
  truncatedNotice?: ReactNode;
  imageBase?: string;
}) {
  const resolve: Resolver = (src) => {
    if (!src) return src;
    const blob = /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/.exec(src);
    if (blob) return `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}`;
    if (/^(https?:|data:)/i.test(src)) return src;
    if (!imageBase) return src;
    const path = src.replace(/^\.\//, '').replace(/^\/+/, '').split('#')[0];
    return `${imageBase}/${path}`;
  };

  const lines = normalizeHtml(source).replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  let truncated = false;

  while (i < lines.length) {
    if (k >= MAX_BLOCKS) {
      truncated = true;
      break;
    }
    const line = lines[i];

    /* fenced code */
    if (line.trim().startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      const code = buf.length > 400 ? `${buf.slice(0, 400).join('\n')}\n… (${buf.length - 400} more lines)` : buf.join('\n');
      out.push(
        <pre key={k++}>
          <code>{code}</code>
        </pre>,
      );
      continue;
    }

    /* table */
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      let extra = 0;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        if (rows.length < MAX_TABLE_ROWS) rows.push(splitRow(lines[i]));
        else extra++;
        i++;
      }
      out.push(
        <table key={k++}>
          <thead>
            <tr>
              {header.map((h, hi) => (
                <th key={hi}>{parseInline(h, `th${k}-${hi}`, resolve)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci}>{parseInline(c, `td${k}-${ri}-${ci}`, resolve)}</td>
                ))}
              </tr>
            ))}
            {extra > 0 && (
              <tr>
                <td colSpan={header.length}>… +{extra}</td>
              </tr>
            )}
          </tbody>
        </table>,
      );
      continue;
    }

    /* headings */
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = parseInline(h[2].replace(/\s+#+\s*$/, ''), `h${k}`, resolve);
      out.push(
        level === 1 ? (
          <h1 key={k++}>{content}</h1>
        ) : level === 2 ? (
          <h2 key={k++}>{content}</h2>
        ) : level === 3 ? (
          <h3 key={k++}>{content}</h3>
        ) : (
          <h4 key={k++}>{content}</h4>
        ),
      );
      i++;
      continue;
    }

    /* hr */
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push(<hr key={k++} />);
      i++;
      continue;
    }

    /* blockquote */
    if (line.trim().startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(<blockquote key={k++}>{parseInline(buf.join(' '), `bq${k}`, resolve)}</blockquote>);
      continue;
    }

    /* unordered list */
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      let extra = 0;
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        if (items.length < MAX_LIST_ITEMS) items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        else extra++;
        i++;
      }
      out.push(
        <ul key={k++}>
          {items.map((it, ii) => (
            <li key={ii}>{parseInline(it, `ul${k}-${ii}`, resolve)}</li>
          ))}
          {extra > 0 && <li>… +{extra}</li>}
        </ul>,
      );
      continue;
    }

    /* ordered list */
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      let extra = 0;
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        if (items.length < MAX_LIST_ITEMS) items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        else extra++;
        i++;
      }
      out.push(
        <ol key={k++}>
          {items.map((it, ii) => (
            <li key={ii}>{parseInline(it, `ol${k}-${ii}`, resolve)}</li>
          ))}
          {extra > 0 && <li>… +{extra}</li>}
        </ol>,
      );
      continue;
    }

    /* blank line */
    if (line.trim() === '') {
      i++;
      continue;
    }

    /* paragraph */
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    const key = `p${k}`;
    if (buf.length === 1) {
      const yt = youtubeId(buf[0].trim());
      if (yt) {
        out.push(
          <div key={k++} style={{ aspectRatio: '16/9', margin: '1em 0', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-line)' }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${yt}`}
              title="YouTube demo"
              loading="lazy"
              allow="accelerometer; encrypted-media; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
            />
          </div>,
        );
        continue;
      }
    }
    out.push(<p key={k++}>{parseInline(buf.join(' '), key, resolve)}</p>);
  }

  return (
    <div className="md-body">
      {out}
      {truncated && (
        <div style={{ marginTop: '1em', paddingTop: '0.8em', borderTop: '1px dashed var(--color-line)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-mut)' }}>
          {truncatedNotice ?? '… the document continues on GitHub — it is too large to render fully in-browser.'}
        </div>
      )}
    </div>
  );
}
