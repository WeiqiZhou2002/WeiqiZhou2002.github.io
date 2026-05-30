#!/usr/bin/env python3
import os, json, datetime, subprocess, re
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

HOME = Path.home()
POSTS_DIR = HOME / "WeiqiZhou2002.github.io" / "_posts"
SITE_DIR = HOME / "WeiqiZhou2002.github.io"
WWW_DIR = HOME / "hermes-web" / "www"
HOST, PORT = "0.0.0.0", 8092
GEM_PATH = str(HOME / ".local" / "share" / "gem" / "ruby" / "3.3.0" / "bin")

def rebuild():
    env = os.environ.copy()
    env["PATH"] = GEM_PATH + ":" + env.get("PATH", "")
    r = subprocess.run(
        "cd " + str(SITE_DIR) + " && jekyll build --future",
        shell=True, capture_output=True, text=True, timeout=60, env=env
    )
    if r.returncode != 0:
        print("REBUILD FAIL:", r.stderr)
        return False
    subprocess.run(
        "cp -r " + str(SITE_DIR / "_site") + "/* " + str(WWW_DIR) + "/",
        shell=True, capture_output=True, text=True, timeout=30
    )
    return True

def parse_fm(text):
    m = re.search(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not m: return {}
    meta = {}
    for line in m.group(1).split("\n"):
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip('"').strip("'")
    if "date" in meta: meta["date"] = meta["date"][:10]
    return meta

def build_fm(title, date, tags, body):
    parts = ["---", "layout: post", "title: " + title, "date: " + date]
    if tags:
        parts.append("tags:")
        for t in tags:
            parts.append("  - " + t.strip())
    parts.append("---\n")
    return "\n".join(parts) + "\n" + body

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/posts":
            return self.json(self.list_posts())
        elif self.path.startswith("/post/"):
            return self.json(self.get_post(self.path[6:]))
        elif self.path == "/":
            return self.html(self.page())
        self.json({"error": 404})

    def do_POST(self):
        if self.path.endswith("/delete"):
            name = self.path[6:].replace("/delete", "")
            return self.json(self.delete(name))
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        if self.path == "/post/new":
            return self.json(self.create(body))
        elif self.path.startswith("/post/"):
            name = self.path[6:]
            return self.json(self.save(name, body))

    def list_posts(self):
        posts = []
        for f in sorted(POSTS_DIR.glob("*.md"), reverse=True):
            m = parse_fm(f.read_text())
            posts.append({"file": f.name, "title": m.get("title", f.stem),
                          "date": m.get("date", ""), "tags": m.get("tags", "")})
        return {"posts": posts}

    def get_post(self, name):
        f = POSTS_DIR / name
        if not f.exists(): return {"error": "not found"}
        text = f.read_text()
        m = parse_fm(text)
        body = re.sub(r"^---.*?\n---\n*", "", text, flags=re.DOTALL)
        return {"file": f.name, "content": body, **m}

    def save(self, name, body):
        f = POSTS_DIR / name
        title = body.get("title", "Untitled")
        date = body.get("date", datetime.date.today().isoformat())
        tags = body.get("tags", [])
        content = build_fm(title, date, tags, body.get("content", ""))
        f.write_text(content)
        rebuild()
        return {"ok": True}

    def create(self, body):
        title = body.get("title", "Untitled")
        ds = body.get("date", datetime.date.today().isoformat())
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        if not slug:
            slug = datetime.datetime.now().strftime("%H%M%S")
        tags = body.get("tags", [])
        content = build_fm(title, ds, tags, "Write your post here...")
        fn = ds + "-" + slug + ".md"
        (POSTS_DIR / fn).write_text(content)
        rebuild()
        return {"file": fn}

    def delete(self, name):
        f = POSTS_DIR / name
        if f.exists(): f.unlink()
        rebuild()
        return {"ok": True}

    def json(self, d):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(d).encode())

    def html(self, h):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(h.encode())

    def log_message(self, *a): pass

    def page(self):
        return '''<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Blog Manager</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f5;color:#1a1a1a;padding:20px;max-width:1200px;margin:0 auto}
h1{margin-bottom:20px}
.toolbar{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
.btn{padding:8px 16px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer}
.btn-primary{background:#2563eb;color:#fff;border-color:#2563eb}
.btn-danger{background:#dc2626;color:#fff;border-color:#dc2626}
.layout{display:flex;gap:20px}
.sidebar{width:300px;flex-shrink:0}
.post-list{list-style:none;background:#fff;border-radius:8px;border:1px solid #ddd}
.post-list li{padding:12px 16px;border-bottom:1px solid #eee;cursor:pointer;display:flex;justify-content:space-between}
.post-list li:last-child{border-bottom:none}
.post-list li:hover{background:#f0f4ff}
.post-list li.active{background:#dbeafe}
.post-title{font-size:.9rem;font-weight:500}
.post-date{font-size:.75rem;color:#888}
.editor-area{flex:1;display:flex;flex-direction:column;gap:10px}
.meta-row{display:flex;gap:10px}
.meta-row input{flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:.9rem}
.actions{display:flex;gap:10px;margin-top:10px}
</style></head>
<body>
<h1>Blog Manager</h1>
<div class="toolbar">
  <button class="btn btn-primary" onclick="newPost()">+ New Post</button>
  <button class="btn" onclick="loadList()">Refresh</button>
</div>
<div class="layout">
  <div class="sidebar"><ul class="post-list" id="postList"></ul></div>
  <div class="editor-area">
    <div class="meta-row">
      <input id="titleInput" placeholder="Title" />
      <input id="dateInput" type="date" />
      <input id="tagsInput" placeholder="tags" />
    </div>
    <textarea id="editor"></textarea>
    <div class="actions">
      <button class="btn btn-primary" onclick="savePost()">Save</button>
      <button class="btn btn-danger" onclick="deletePost()" style="margin-left:auto">Delete</button>
    </div>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.js"></script>
<script>
let cur=null;
const ed=new EasyMDE({element:document.getElementById("editor"),spellChecker:false,status:false});
async function api(p,o){const r=await fetch(p,{headers:{"Content-Type":"application/json"},...o});return r.json()}
async function loadList(){const d=await api("/posts");document.getElementById("postList").innerHTML=d.posts.map(p=>'<li class="'+(p.file===cur?'active':'')+'" onclick="load(\\''+p.file+'\\')"><div><div class=post-title>'+p.title+'</div><div class=post-date>'+(p.date||'').slice(0,10)+'</div></div><span style=color:#888;font-size:.75em>'+p.file.slice(0,12)+'</span></li>').join("")}
async function load(f){cur=f;const d=await api("/post/"+f);document.getElementById("titleInput").value=d.title||"";document.getElementById("dateInput").value=d.date||"";document.getElementById("tagsInput").value=(d.tags||"").split("\\n").map(t=>t.replace(/^- /,"")).filter(Boolean).join(", ");ed.value(d.content||"");loadList()}
async function savePost(){if(!cur)return alert("Select a post");const t=document.getElementById("titleInput").value;if(!t)return alert("Title required");await api("/post/"+cur,{method:"POST",body:JSON.stringify({title:t,date:document.getElementById("dateInput").value,tags:document.getElementById("tagsInput").value.split(",").map(x=>x.trim()).filter(Boolean),content:ed.value()})});alert("Saved! Rebuilding...")}
async function newPost(){const t=prompt("Post title:");if(!t)return;const d=await api("/post/new",{method:"POST",body:JSON.stringify({title:t,date:new Date().toISOString().slice(0,10)})});if(d.file){cur=d.file;load(d.file)}}
async function deletePost(){if(!cur||!confirm("Delete?"))return;await api("/post/"+cur+"/delete",{method:"POST"});cur=null;ed.value("");document.getElementById("titleInput").value="";document.getElementById("dateInput").value="";document.getElementById("tagsInput").value="";loadList()}
loadList()
</script></body></html>'''

if __name__ == "__main__":
    print("Blog manager on http://" + HOST + ":" + str(PORT))
    HTTPServer((HOST, PORT), Handler).serve_forever()
