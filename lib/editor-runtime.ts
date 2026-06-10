/**
 * Runtime di editing visuale iniettato nell'iframe di anteprima.
 * Tutto ciò che è marcato [data-lpb-editor] viene rimosso alla serializzazione,
 * quindi l'HTML esportato è identico a una pagina "pulita".
 */
export const EDITOR_RUNTIME = String.raw`
<style data-lpb-editor>
  .lpb-hover { outline: 2px dashed #6ee7ff !important; outline-offset: 2px; cursor: default !important; }
  .lpb-selected { outline: 2px solid #6ee7ff !important; outline-offset: 2px; }
  [contenteditable="true"].lpb-selected { outline-color: #7CFFB2 !important; cursor: text !important; }
</style>
<script data-lpb-editor>
(function () {
  'use strict';
  var enabled = false;
  var selected = null;
  var hovered = null;

  function isEditorNode(el) {
    return !!(el && el.closest && el.closest('[data-lpb-editor]'));
  }

  function post(type, payload) {
    parent.postMessage({ source: 'lpb-iframe', type: type, payload: payload || null }, '*');
  }

  function describe(el) {
    if (!el) return null;
    var cs = getComputedStyle(el);
    var isImage = el.tagName === 'IMG';
    var isLink = el.tagName === 'A';
    var directText = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3) directText += n.textContent;
    }
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim().slice(0, 120),
      hasOwnText: directText.trim().length > 0,
      isImage: isImage,
      isLink: isLink,
      src: isImage ? el.getAttribute('src') : null,
      href: isLink ? el.getAttribute('href') : null,
      styles: {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize,
        textAlign: cs.textAlign,
      },
    };
  }

  function clearHover() {
    if (hovered) { hovered.classList.remove('lpb-hover'); hovered = null; }
  }

  function deselect() {
    if (selected) {
      selected.removeAttribute('contenteditable');
      selected.classList.remove('lpb-selected');
      selected = null;
    }
    post('lpb:selected', null);
  }

  function select(el) {
    if (selected === el) return;
    if (selected) {
      selected.removeAttribute('contenteditable');
      selected.classList.remove('lpb-selected');
    }
    selected = el;
    el.classList.add('lpb-selected');
    post('lpb:selected', describe(el));
  }

  document.addEventListener('mouseover', function (e) {
    if (!enabled || isEditorNode(e.target)) return;
    clearHover();
    if (e.target !== document.body && e.target !== document.documentElement) {
      hovered = e.target;
      hovered.classList.add('lpb-hover');
    }
  }, true);

  document.addEventListener('mouseout', function () { if (enabled) clearHover(); }, true);

  document.addEventListener('click', function (e) {
    if (!enabled) return;
    if (isEditorNode(e.target)) return;
    if (selected && selected.getAttribute('contenteditable') === 'true' && selected.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.target === document.body || e.target === document.documentElement) { deselect(); return; }
    select(e.target);
  }, true);

  document.addEventListener('dblclick', function (e) {
    if (!enabled || isEditorNode(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    select(el);
    el.setAttribute('contenteditable', 'true');
    el.focus();
  }, true);

  document.addEventListener('input', function () { if (enabled) post('lpb:dirty'); }, true);

  document.addEventListener('keydown', function (e) {
    if (!enabled) return;
    if (e.key === 'Escape') deselect();
  }, true);

  function serialize() {
    var clone = document.documentElement.cloneNode(true);
    var junk = clone.querySelectorAll('[data-lpb-editor]');
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    var marked = clone.querySelectorAll('.lpb-hover, .lpb-selected, [contenteditable]');
    for (var j = 0; j < marked.length; j++) {
      marked[j].classList.remove('lpb-hover');
      marked[j].classList.remove('lpb-selected');
      marked[j].removeAttribute('contenteditable');
      if (marked[j].getAttribute('class') === '') marked[j].removeAttribute('class');
    }
    return '<!DOCTYPE html>\n' + clone.outerHTML;
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.source !== 'lpb-parent') return;
    var cmd = d.cmd, value = d.value;

    if (cmd === 'enable') { enabled = true; return; }
    if (cmd === 'disable') { enabled = false; clearHover(); deselect(); return; }
    if (cmd === 'serialize') { post('lpb:html', { html: serialize(), reqId: d.reqId }); return; }
    if (cmd === 'deselect') { deselect(); return; }

    if (!selected) return;

    if (cmd === 'style') {
      selected.style.setProperty(value.prop, value.value, 'important');
      post('lpb:dirty');
      post('lpb:selected', describe(selected));
    } else if (cmd === 'editText') {
      selected.setAttribute('contenteditable', 'true');
      selected.focus();
    } else if (cmd === 'setSrc') {
      if (selected.tagName === 'IMG') { selected.setAttribute('src', value); post('lpb:dirty'); }
    } else if (cmd === 'setHref') {
      if (selected.tagName === 'A') { selected.setAttribute('href', value); post('lpb:dirty'); }
    } else if (cmd === 'remove') {
      var el = selected; deselect(); el.remove(); post('lpb:dirty');
    } else if (cmd === 'duplicate') {
      var copy = selected.cloneNode(true);
      copy.classList.remove('lpb-selected');
      selected.after(copy);
      post('lpb:dirty');
    } else if (cmd === 'moveUp') {
      var prev = selected.previousElementSibling;
      if (prev) { selected.parentNode.insertBefore(selected, prev); post('lpb:dirty'); selected.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    } else if (cmd === 'moveDown') {
      var next = selected.nextElementSibling;
      if (next) { next.after(selected); post('lpb:dirty'); selected.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    } else if (cmd === 'selectParent') {
      var p = selected.parentElement;
      if (p && p !== document.body && p !== document.documentElement) select(p);
    }
  });

  post('lpb:ready');
})();
</script>
`;

/** Inietta il runtime di editing prima della chiusura di </body> (o in coda). */
export function injectEditorRuntime(html: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, EDITOR_RUNTIME + '</body>');
  }
  return html + EDITOR_RUNTIME;
}
