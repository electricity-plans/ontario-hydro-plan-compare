// Dependency-free XML reader for ESPI/Atom feeds. Works in browsers and Node.
// It reads the document as a stream of tags, builds a small tree for one <entry> at a time (so a 70 MB export never
// becomes a full DOM), and is strict about structure: entries must be children of the Atom <feed> root, the feed
// must be closed, comments and CDATA are never mistaken for markup, quoted attribute values may contain '>', and
// DOCTYPE/entity declarations and unknown entities are refused.

const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
export const ATOM_NS = 'http://www.w3.org/2005/Atom';
export const LIMITS = { depth: 64, entryChars: 20 * 1024 * 1024, entries: 400000 };

export class XmlError extends Error { constructor(message) { super(message); this.code = 'xml'; } }

export function decodeEntities(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&([^;\s]{1,10});/g, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) throw new XmlError(`Bad character reference “${m}”`);
      return String.fromCodePoint(n);
    }
    if (!(e in ENT)) throw new XmlError(`Unknown entity “${m}”`);
    return ENT[e];
  });
}

function parseAttrs(s, at) {
  const out = {};
  const re = /\s*([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/y;
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue; }
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) throw new XmlError(`Malformed attribute near offset ${at + i}`);
    if (m[1] in out) throw new XmlError(`Duplicate attribute “${m[1]}”`);
    out[m[1]] = decodeEntities(m[3] ?? m[4]);
    i = re.lastIndex;
  }
  return out;
}

/** End of a tag starting at '<' (index lt): the '>' that is not inside a quoted attribute value. */
function tagEnd(xml, lt) {
  let q = null;
  for (let i = lt + 1; i < xml.length; i++) {
    const c = xml.charCodeAt(i);
    if (q) { if (c === q) q = null; }
    else if (c === 34 || c === 39) q = c;
    else if (c === 62) return i;
  }
  return -1;
}

const NO_ATTRS = Object.freeze({});
const nameOk = new Map();
const isSpace = c => c === 32 || c === 10 || c === 13 || c === 9;
function checkName(name, at) {
  let ok = nameOk.get(name);
  if (ok === undefined) { ok = /^[A-Za-z_][\w.\-]*(:[A-Za-z_][\w.\-]*)?$/.test(name); if (nameOk.size < 10000) nameOk.set(name, ok); }
  if (!ok) throw new XmlError(`Malformed tag name near offset ${at}`);
}

/**
 * Walk the document's tokens from `from` to `to`. Calls onOpen(name, attrs, selfClose, start, end) (which may return
 * an index to continue from), onClose(name, start, end) and onText(from, to, cdata). Comments are skipped, CDATA is
 * passed as text, processing instructions are skipped. Text is passed as positions, so whitespace is never copied.
 */
function walk(xml, from, to, onOpen, onClose, onText) {
  let i = from;
  while (i < to) {
    const lt = xml.indexOf('<', i);
    if (lt < 0 || lt >= to) { if (onText && i < to) onText(i, to, false); return to; }
    if (lt > i && onText) onText(i, lt, false);
    const c1 = xml.charCodeAt(lt + 1);
    if (c1 === 33) {   // '!'
      if (xml.startsWith('<!--', lt)) { const e = xml.indexOf('-->', lt + 4); if (e < 0) throw new XmlError('A comment is never closed'); i = e + 3; continue; }
      if (xml.startsWith('<![CDATA[', lt)) { const e = xml.indexOf(']]>', lt + 9); if (e < 0) throw new XmlError('A CDATA section is never closed'); if (onText) onText(lt + 9, e, true); i = e + 3; continue; }
      throw new XmlError('DOCTYPE and entity declarations are not accepted');
    }
    if (c1 === 63) { const e = xml.indexOf('?>', lt + 2); if (e < 0) throw new XmlError('A processing instruction is never closed'); i = e + 2; continue; }   // '?'
    const gt = tagEnd(xml, lt);
    if (gt < 0) throw new XmlError('A tag is never closed (the file may be cut off)');
    if (c1 === 47) {   // '/': closing tag
      let e = gt; while (e > lt + 2 && isSpace(xml.charCodeAt(e - 1))) e--;
      onClose(xml.slice(lt + 2, e), lt, gt + 1); i = gt + 1; continue;
    }
    const selfClose = xml.charCodeAt(gt - 1) === 47;
    const bodyEnd = selfClose ? gt - 1 : gt;
    let ne = lt + 1; while (ne < bodyEnd && !isSpace(xml.charCodeAt(ne))) ne++;
    const name = xml.slice(lt + 1, ne);
    checkName(name, lt);
    let attrs = NO_ATTRS;
    for (let k = ne; k < bodyEnd; k++) if (!isSpace(xml.charCodeAt(k))) { attrs = parseAttrs(xml.slice(ne, bodyEnd), ne); break; }
    const jump = onOpen(name, attrs, selfClose, lt, gt + 1);
    i = typeof jump === 'number' ? jump : gt + 1;
  }
  return i;
}

function makeEl(name, attrs, parentNs) {
  let ns = parentNs;
  if (attrs !== NO_ATTRS) for (const k of Object.keys(attrs)) if (k === 'xmlns' || k.startsWith('xmlns:')) { if (ns === parentNs) ns = { ...parentNs }; ns[k === 'xmlns' ? '' : k.slice(6)] = attrs[k]; }
  const c = name.indexOf(':');
  const prefix = c < 0 ? '' : name.slice(0, c);
  if (prefix && !(prefix in ns)) throw new XmlError(`Unknown namespace prefix “${prefix}”`);
  return { name, local: c < 0 ? name : name.slice(c + 1), prefix, uri: ns[prefix], attrs, children: [], text: '', ns };
}

/** Parse a fragment (used for one entry) into {name, local, prefix, uri, attrs, children, text}. */
export function parseFragment(xml, inheritedNs = {}, from = 0, to = xml.length) {
  const root = { name: '#root', children: [], text: '', ns: inheritedNs };
  const stack = [root];
  walk(xml, from, to,
    (name, attrs, selfClose) => {
      const parent = stack[stack.length - 1];
      const el = makeEl(name, attrs, parent.ns);
      parent.children.push(el);
      if (!selfClose) { stack.push(el); if (stack.length > LIMITS.depth) throw new XmlError('Elements are nested too deeply'); }
    },
    name => { const top = stack.pop(); if (!top || top.name !== name) throw new XmlError(`Mismatched </${name}>, expected </${top && top.name}>`); },
    (a, b, cdata) => {
      if (!cdata) { let k = a; while (k < b && isSpace(xml.charCodeAt(k))) k++; if (k === b) return; }   // whitespace between tags
      const t = xml.slice(a, b); stack[stack.length - 1].text += cdata ? t : decodeEntities(t);
    });
  if (stack.length !== 1) throw new XmlError(`Unclosed element <${stack[stack.length - 1].name}>`);
  return root;
}

// Namespace-aware lookups. Pass the namespace URI the field must be in.
export const child = (el, local, uri) => el && el.children.find(c => c.local === local && (uri === undefined || c.uri === uri));
export const kids = (el, local, uri) => (el ? el.children.filter(c => c.local === local && (uri === undefined || c.uri === uri)) : []);
export const text = (el, local, uri) => { const c = child(el, local, uri); return c ? c.text.trim() : undefined; };

/**
 * Iterate the <entry> elements that are direct children of the Atom <feed> root.
 * Anything else at that level is ignored; markup inside comments or CDATA is never an entry.
 */
export function* scanEntries(xml) {
  const stack = [];       // open elements between the feed and its entries
  let rootSeen = false, rootClosed = false, count = 0;
  const pending = [];
  const onOpen = (name, attrs, selfClose, start, end) => {
    const parentNs = stack.length ? stack[stack.length - 1].ns : {};
    const el = makeEl(name, attrs, parentNs);
    if (!rootSeen) {
      if (el.local !== 'feed' || el.uri !== ATOM_NS) throw new XmlError('Not an Atom feed: the root element is not an Atom <feed>');
      rootSeen = true;
      if (selfClose) rootClosed = true; else stack.push(el);
      return;
    }
    if (rootClosed) throw new XmlError('There is markup after the end of the feed');
    if (stack.length === 1 && el.local === 'entry' && el.uri === ATOM_NS) {
      if (selfClose) { pending.push({ el, end }); return; }
      // Jump to this entry's closing tag and build it once. parseFragment checks the entry's structure strictly;
      // if a comment or CDATA inside the entry happens to contain the closing text, try the next occurrence.
      const close = `</${name}>`;
      let at = start, built = null, lastErr = null;
      for (let tries = 0; tries < 8 && !built; tries++) {
        at = xml.indexOf(close, at + 1);
        if (at < 0) break;
        if (at + close.length - start > LIMITS.entryChars) throw new XmlError('One entry in this file is too large');
        try { built = parseFragment(xml, parentNs, start, at + close.length).children[0]; } catch (e) { lastErr = e; }
      }
      if (!built) throw lastErr || new XmlError('The file ends before an entry is closed (it may be cut off)');
      pending.push({ el: built, end: at + close.length });
      return at + close.length;
    }
    if (!selfClose) { stack.push(el); if (stack.length > LIMITS.depth) throw new XmlError('Elements are nested too deeply'); }
  };
  const onClose = name => {
    const top = stack.pop();
    if (!top || top.name !== name) throw new XmlError(`Mismatched </${name}>, expected </${top && top.name}>`);
    if (!stack.length) rootClosed = true;
  };
  const onText = (a, b) => {
    let k = a; while (k < b && isSpace(xml.charCodeAt(k))) k++;
    if (k === b) return;
    if (xml.indexOf('&', a) > -1 && xml.indexOf('&', a) < b) decodeEntities(xml.slice(a, b));   // refuse unknown entities anywhere
    if (!rootSeen) throw new XmlError('There is text before the feed starts');
    if (rootClosed) throw new XmlError('There is text after the end of the feed');
  };
  let i = 0;
  const step = 1 << 20;
  while (i < xml.length) {
    let to = Math.min(xml.length, i + step);
    const lt = xml.indexOf('<', to); to = lt < 0 ? xml.length : lt;     // never cut a tag in two
    i = walk(xml, i, Math.max(to, i + 1), onOpen, onClose, onText);
    while (pending.length) { const p = pending.shift(); if (++count > LIMITS.entries) throw new XmlError('This file has too many entries'); p.el.endOffset = p.end; yield p.el; }
  }
  if (!rootSeen) throw new XmlError('Not an Atom feed: no <feed> element found');
  if (!rootClosed) throw new XmlError('The file ends before the feed is closed (it may be cut off)');
}
