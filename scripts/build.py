"""Rebuild both sandboxed documents from canonical beta sources, decoding once."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
import re

ROOT = Path(__file__).resolve().parents[1]
def read(name):
    return (ROOT / name).read_text(encoding='utf-8').strip()
class FrameParser(HTMLParser):
    def handle_starttag(self, tag, attrs):
        if tag == 'iframe':
            self.inner = dict(attrs)['data-srcdoc']

page = read('design/prototipo.html')
parser = FrameParser(); parser.feed(page)
inner = parser.inner
css = read('beta/beta.css') + '\n' + read('beta/admin.css')
inner, count = re.subn(r'<style>#gi-beta\{.*?</style>', lambda m: '<style>' + css + '</style>', inner, count=1, flags=re.S)
assert count == 1
start = inner.index('<div id="gi-beta"')
end = inner.index('<script>function validateDB', start)
markup = read('beta/beta.html').replace('<!-- ADMIN_PANEL -->', read('beta/admin.html'))
inner = inner[:start] + markup + '\n' + inner[end:]
schema = read('beta/beta-schema.js')
app = read('beta/beta.js').replace('// ADMIN_MODULE', read('beta/admin.js'))
start = inner.index('<script>function validateDB')
end = inner.index('</script>', start) + len('</script>')
inner = inner[:start] + '<script>' + schema + '\n' + app + '\n</script>' + inner[end:]
page, count = re.subn(r'(data-srcdoc=")[\s\S]*?("\s*></iframe>)', lambda m: m.group(1) + escape(inner, quote=True) + m.group(2), page, count=1)
assert count == 1
start = page.index('<script>function validateDB')
end = page.index('</script>', start) + len('</script>')
page = page[:start] + '<script>' + schema + '\n' + read('beta/beta-bridge.js') + '\n</script>' + page[end:]
for name in ['design/prototipo.html', 'docs/index.html']:
    (ROOT / name).write_text(page + '\n', encoding='utf-8')
print('Built design/prototipo.html and docs/index.html')
