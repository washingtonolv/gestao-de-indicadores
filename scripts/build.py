"""Rebuild both sandboxed documents from canonical beta sources, decoding once."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
def read(name):
    return (ROOT / name).read_text(encoding='utf-8').strip()
class FrameParser(HTMLParser):
    def handle_starttag(self, tag, attrs):
        if tag == 'iframe':
            self.inner = dict(attrs)['data-srcdoc']

page = read('design/prototipo.html')
parser = FrameParser(); parser.feed(page)
inner = parser.inner.replace("__CODEX_VISUALIZATION_WIDGET_STATE__", "{}")
css = read('beta/beta.css') + '\n' + read('beta/admin.css') + '\n' + read('beta/evolution.css') + '\n' + read('beta/theme.css') + '\n' + read('beta/redesign.css')
inner, count = re.subn(r'<style>#gi-beta\{.*?</style>', lambda m: '<style>' + css + '</style>', inner, count=1, flags=re.S)
assert count == 1
start = inner.index('<div id="gi-beta"')
end = inner.index('<script>function validateDB', start)
markup = read('beta/beta.html').replace('<!-- ADMIN_PANEL -->', read('beta/admin.html')).replace('<!-- EVOLUTION_PANEL -->', read('beta/evolution.html')).replace('<!-- OPERATION_PANEL -->', read('beta/operation.html')).replace('<!-- INDIVIDUAL_GOALS -->', read('beta/individual-goals.html'))
inner = inner[:start] + markup + '\n' + inner[end:]
schema = read('beta/beta-schema.js')
app = read('beta/beta.js').replace('// ADMIN_MODULE', read('beta/admin.js')).replace('// EVOLUTION_MODULE', read('beta/evolution.js')).replace('// CLOUD_MODULE', read('beta/cloud-ui.js') + '\n' + read('beta/redesign.js') + '\n' + read('beta/entry-controls.js'))
start = inner.index('<script>function validateDB')
end = inner.index('</script>', start) + len('</script>')
inner = inner[:start] + '<script>' + schema + '\n' + read('beta/evolution-core.js') + '\n' + app + '\n' + read('beta/theme-frame.js') + '\n</script>' + inner[end:]
page, count = re.subn(r'(data-srcdoc=")[\s\S]*?("\s*></iframe>)', lambda m: m.group(1) + escape(inner, quote=True) + m.group(2), page, count=1)
assert count == 1
start = page.index('<script>function validateDB')
end = page.index('</script>', start) + len('</script>')
bundle = subprocess.run(['node', 'scripts/build-cloud.cjs'], cwd=ROOT, check=True, capture_output=True, text=True, encoding='utf-8').stdout
page = page[:start] + '<script>' + schema + '\n' + bundle.replace('</script', '<\\/script') + '\n' + read('beta/beta-bridge.js') + '\n' + read('beta/pwa.js') + '\n' + read('beta/theme.js') + '\n</script>' + page[end:]
# The iframe retains its original CSP and sandbox. Only the parent connects.
head_end = page.index('</head>')
page = page[:head_end].replace('connect-src blob: data:;', 'connect-src blob: data: https://wyvtuvmsgncllwxxotjp.supabase.co;') + page[head_end:]
head, tail = page[:page.index('</head>')], page[page.index('</head>'):]
for directive in ['img-src', 'worker-src', 'connect-src']:
    head = re.sub(r'(' + directive + r') (?!\x27self\x27)', r"\1 'self' ", head)
if 'manifest-src' not in head:
    head = head.replace("object-src 'none';", "manifest-src 'self'; object-src 'none';")
head = re.sub(r'<!-- PWA_HEAD -->.*?<!-- /PWA_HEAD -->\s*', '', head, flags=re.S)
page = head + '\n<!-- PWA_HEAD -->\n' + read('beta/pwa-head.html') + '\n<!-- /PWA_HEAD -->\n' + tail
for name in ['design/prototipo.html', 'docs/index.html']:
    (ROOT / name).write_text(page + '\n', encoding='utf-8')
print('Built design/prototipo.html and docs/index.html')
