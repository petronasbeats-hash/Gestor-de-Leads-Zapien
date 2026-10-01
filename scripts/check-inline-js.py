from html.parser import HTMLParser
from pathlib import Path
import subprocess
import tempfile
import sys

class InlineScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_script = False
        self.parts = []
        self.scripts = []
    def handle_starttag(self, tag, attrs):
        if tag == "script":
            attributes = dict(attrs)
            self.in_script = "src" not in attributes and attributes.get("type", "").lower() not in ("application/ld+json", "application/json")
            self.parts = []
    def handle_data(self, data):
        if self.in_script:
            self.parts.append(data)
    def handle_endtag(self, tag):
        if tag == "script" and self.in_script:
            self.scripts.append("".join(self.parts))
            self.in_script = False

failed = False
for filename in ("index.html", "agenda.html", "reservar.html"):
    parser = InlineScripts()
    parser.feed(Path(filename).read_text(encoding="utf-8"))
    for index, code in enumerate(parser.scripts, 1):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".js", encoding="utf-8") as temp:
            temp.write(code)
            temp.flush()
            result = subprocess.run(["node", "--check", temp.name], capture_output=True, text=True)
            if result.returncode:
                print(f"FAIL {filename} inline script {index}:\n{result.stderr}")
                failed = True
            else:
                print(f"OK {filename} inline script {index}")
if failed:
    sys.exit(1)
