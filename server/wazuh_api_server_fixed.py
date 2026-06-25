#!/usr/bin/env python3
"""
Wazuh SOC Dashboard - Advanced API Server v3.1
Fixes: threading, crash recovery, connection reset handling
"""
import json, subprocess, base64, os, sys, signal
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import parse_qs, urlparse, unquote
from datetime import datetime
import re, threading

INDEXER_URL = "https://localhost:9200"
INDEXER_USER = "admin"
INDEXER_PASS = "bqUxnAP*Mw2b+qLaI2ansmKNlCqoCHs7"

def map_index(idx):
    if not idx: return idx
    return re.sub(r"(?i)^unishield360-", "wazuh-", idx)

# ─── Threaded HTTPServer (handles multiple requests concurrently) ───
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    allow_reuse_address = True
    daemon_threads = True

class Handler(BaseHTTPRequestHandler):

    def safe_send(self, data):
        """Write response safely — catches connection resets"""
        try:
            self.wfile.write(data)
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass  # Client disconnected — ignore

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        try:
            if path == '/health':
                resp = self.health_check()
            elif path == '/indices':
                resp = self.get_indices()
            elif path == '/index-stats':
                resp = self.get_index_stats(params)
            elif path == '/fields':
                resp = self.get_fields(params)
            elif path == '/search':
                resp = self.search_documents(params)
            elif path == '/count':
                resp = self.count_documents(params)
            elif path == '/scan':
                resp = self.scan_alerts(params)
            elif path == '/aggregate':
                resp = self.aggregate_data(params)
            elif path == '/geo':
                resp = self.get_geo_data(params)
            else:
                resp = {
                    "success": False, "error": "Unknown endpoint",
                    "available_endpoints": ["/health","/indices","/index-stats","/fields","/search","/count","/scan","/aggregate","/geo"]
                }
        except Exception as e:
            resp = {"success": False, "error": str(e)}

        body = json.dumps(resp, default=str).encode()

        # Send response safely
        try:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'close')
            self.end_headers()
            self.safe_send(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass  # Client disconnected before/during response
        except Exception:
            pass  # Any other send error

    def do_OPTIONS(self):
        try:
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.send_header('Connection', 'close')
            self.end_headers()
        except:
            pass

    def log_message(self, format, *args):
        pass

    # ─── Elasticsearch Query via curl ───
    def es_query(self, method, path, body=None):
        auth_str = base64.b64encode(f"{INDEXER_USER}:{INDEXER_PASS}".encode()).decode()
        url = f"{INDEXER_URL}{path}"
        cmd = ['curl', '-k', '-s', '--max-time', '30',
               '-X', method,
               '-H', f'Authorization: Basic {auth_str}',
               '-H', 'Content-Type: application/json',
               url]
        if body:
            cmd.extend(['-d', json.dumps(body)])
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=35)
            if result.returncode != 0:
                return {"error": f"curl failed: {result.stderr[:200]}"}
            if not result.stdout.strip():
                return {"error": "Empty response"}
            return json.loads(result.stdout)
        except subprocess.TimeoutExpired:
            return {"error": "Request timeout"}
        except json.JSONDecodeError as e:
            return {"error": f"JSON parse: {str(e)[:100]}"}
        except Exception as e:
            return {"error": str(e)[:200]}

    # ─── Health ───
    def health_check(self):
        data = self.es_query('GET', '/_cluster/health')
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "cluster": data.get('cluster_name', 'unknown'),
            "cluster_status": data.get('status', 'unknown'),
            "nodes": data.get('number_of_nodes', 0),
            "api_version": "3.1.0"
        }

    # ─── Indices ───
    def get_indices(self):
        data = self.es_query('GET', '/_cat/indices?format=json&bytes=b&h=index,health,status,docs.count,store.size,pri.store.size')
        if 'error' in data:
            return {"success": False, "error": data['error']}
        indices = []
        for idx in data:
            name = idx.get('index','')
            if name.startswith('.'): continue
            indices.append({
                "name": name, "health": idx.get('health','unknown'),
                "status": idx.get('status','unknown'),
                "docs_count": int(idx.get('docs.count',0)),
                "store_size": idx.get('store.size','0'),
                "pri_store_size": idx.get('pri.store.size','0'),
                "pattern": self._extract_pattern(name)
            })
        patterns = {}
        for idx in indices:
            p = idx['pattern']
            if p not in patterns:
                patterns[p] = {"pattern": p, "indices": [], "total_docs": 0, "count": 0}
            patterns[p]['indices'].append(idx)
            patterns[p]['total_docs'] += idx['docs_count']
            patterns[p]['count'] += 1
        return {
            "success": True, "total_indices": len(indices),
            "patterns": list(patterns.values()),
            "all_indices": sorted([idx['name'] for idx in indices], reverse=True)
        }

    def _extract_pattern(self, name):
        parts = name.split('-')
        if len(parts) >= 3 and len(parts[2]) >= 8 and parts[2][:4].isdigit():
            return '-'.join(parts[:2]) + '-*'
        if len(parts) >= 2:
            return parts[0] + '-*'
        return name + '*'

    # ─── Index Stats ───
    def get_index_stats(self, params):
        index_name = map_index(params.get('index',[''])[0])
        if not index_name:
            return {"success": False, "error": "Missing 'index'"}
        data = self.es_query('GET', f'/{index_name}/_stats/docs,store')
        if 'error' in data:
            return {"success": False, "error": data['error']}
        total = data.get('_all',{}).get('total',{})
        return {
            "success": True, "index": index_name,
            "docs_count": total.get('docs',{}).get('count',0),
            "size_bytes": total.get('store',{}).get('size_in_bytes',0)
        }

    # ─── Fields ───
    def get_fields(self, params):
        idx = map_index(params.get('index',['wazuh-alerts-4.x-*'])[0])
        data = self.es_query('GET', f'/{idx}/_mapping')
        if 'error' in data: return {"success": False, "error": data['error']}
        fields = []
        try:
            for idx_name, idx_data in data.items():
                props = idx_data.get('mappings',{}).get('properties',{})
                def extract(prefix, p, depth=0):
                    if depth > 10: return
                    for f, info in p.items():
                        fp = f"{prefix}.{f}" if prefix else f
                        if 'properties' in info:
                            extract(fp, info['properties'], depth+1)
                        else:
                            fields.append({"name": fp, "type": info.get('type','object')})
                extract('', props)
                break
        except: pass
        seen = set()
        return {
            "success": True, "index": idx,
            "fields": sorted([f for f in fields if f['name'] not in seen and not seen.add(f['name'])], key=lambda x: x['name'])
        }

    # ─── Search ───
    def search_documents(self, params):
        idx = map_index(params.get('index',['wazuh-alerts-4.x-*'])[0])
        q = params.get('q',[''])[0]
        limit = min(int(params.get('limit',['50'])[0]), 500)
        offset = int(params.get('offset',['0'])[0])
        sort_field = params.get('sort',['timestamp'])[0]
        sort_order = params.get('order',['desc'])[0]
        must = []
        if q:
            must.extend(self._parse_dql(q))
        sd = params.get('start_date',[None])[0]
        ed = params.get('end_date',[None])[0]
        if sd: must.append({"range":{"timestamp":{"gte":self._parse_date(sd)}}})
        if ed: must.append({"range":{"timestamp":{"lte":self._parse_date(ed)}}})
        query_dict = {
            "from": offset, "size": limit,
            "sort": [{sort_field: {"order": sort_order}}],
            "query": {"bool":{"must":must}} if must else {"match_all":{}}
        }
        data = self.es_query('POST', f'/{idx}/_search', query_dict)
        if 'error' in data:
            return {"success": False, "error": str(data.get('error','')), "query": query_dict}
        tv = data.get('hits',{}).get('total',{})
        total_value = tv.get('value',0) if isinstance(tv,dict) else tv
        hits = data.get('hits',{}).get('hits',[])
        docs = []
        for h in hits:
            d = h.get('_source',{})
            d['_id'] = h.get('_id','')
            docs.append(d)
        return {"success": True, "total": total_value, "offset": offset, "limit": limit, "count": len(docs), "results": docs}

    def _parse_dql(self, text):
        must = []
        if not text or text == '*': return must
        for m in re.findall(r'_exists_:([\w.]+)', text):
            must.append({"exists":{"field":m}})
            text = text.replace(f'_exists_:{m}','')
        for f, v in re.findall(r'(\w+(?:\.\w+)*)\s*:\s*"([^"]+)"', text):
            must.append({"match_phrase":{f:v}})
            text = text.replace(f'{f}:"{v}"','')
        for f, v in re.findall(r'(\w+(?:\.\w+)*)\s*:\s*(\S+)', text):
            if f'"' not in v:
                try: float(v); must.append({"term":{f:float(v)}})
                except: must.append({"match":{f:v}})
        r = re.sub(r'\b(AND|OR|NOT)\b','',text,flags=re.I).strip()
        if r: must.append({"query_string":{"query":r,"default_operator":"AND"}})
        return must

    # ─── Count ───
    def count_documents(self, params):
        idx = map_index(params.get('index',['wazuh-alerts-4.x-*'])[0])
        q = params.get('q',[''])[0]
        sd = params.get('start_date',[None])[0]
        ed = params.get('end_date',[None])[0]
        must = []
        if q and q != '*':
            for m in re.findall(r'(\w+(?:\.\w+)*)\s*:\s*\[(\d+)\s+TO\s+(\d+)\]', q):
                must.append({"range":{m[0]:{"gte":int(m[1]),"lte":int(m[2])}}})
                q = q.replace(f'{m[0]}:[{m[1]} TO {m[2]}]','')
            if q.strip(): must.extend(self._parse_dql(q))
        if sd: must.append({"range":{"timestamp":{"gte":self._parse_date(sd)}}})
        if ed: must.append({"range":{"timestamp":{"lte":self._parse_date(ed)}}})
        query_dict = {"query":{"bool":{"must":must}}} if must else {"query":{"match_all":{}}}
        data = self.es_query('POST', f'/{idx}/_count', query_dict)
        if 'error' in data:
            return {"success": True, "index": idx, "query": q, "count": 0}
        return {"success": True, "index": idx, "query": q, "count": data.get('count',0)}

    # ─── Scan Alerts ───
    def scan_alerts(self, params):
        ml = int(params.get('min_level',['1'])[0])
        xl = int(params.get('max_level',['15'])[0])
        sd = params.get('start_date',[None])[0]
        ed = params.get('end_date',[None])[0]
        rid = params.get('rule_id',[None])[0]
        limit = min(int(params.get('limit',['500'])[0]), 2000)
        idx = map_index(params.get('index',['wazuh-alerts-4.x-*'])[0])
        must = [{"range":{"rule.level":{"gte":ml,"lte":xl}}}]
        if sd: must.append({"range":{"timestamp":{"gte":self._parse_date(sd)}}})
        if ed: must.append({"range":{"timestamp":{"lte":self._parse_date(ed)}}})
        if rid: must.append({"match":{"rule.id":rid}})
        qd = {"size":limit, "sort":[{"timestamp":{"order":"desc"}}], "query":{"bool":{"must":must}}}
        data = self.es_query('POST', f'/{idx}/_search', qd)
        if 'error' in data: return {"success":False,"error":str(data['error'])}
        tv = data.get('hits',{}).get('total',{})
        tv = tv.get('value',0) if isinstance(tv,dict) else tv
        return {"success":True,"total":tv,"count":len(data.get('hits',{}).get('hits',[])),"results":[h['_source'] for h in data.get('hits',{}).get('hits',[])]}

    # ─── Aggregate ───
    def aggregate_data(self, params):
        idx = map_index(params.get('index',['wazuh-alerts-4.x-*'])[0])
        af = params.get('field',['rule.level'])[0]
        at = params.get('type',['terms'])[0]
        limit = int(params.get('limit',['20'])[0])
        sd = params.get('start_date',[None])[0]
        ed = params.get('end_date',[None])[0]
        q = params.get('q',[''])[0]
        must = []
        if q and q != '*': must.extend(self._parse_dql(q))
        if sd: must.append({"range":{"timestamp":{"gte":self._parse_date(sd)}}})
        if ed: must.append({"range":{"timestamp":{"lte":self._parse_date(ed)}}})
        fq = {"bool":{"must":must}} if must else {"match_all":{}}
        if at == 'terms':
            aq = {"size":0,"query":fq,"aggs":{"group_by":{"terms":{"field":af,"size":limit,"order":{"_count":"desc"}}}}}
        elif at == 'date_histogram':
            iv = params.get('interval',['1h'])[0]
            aq = {"size":0,"query":fq,"aggs":{"group_by":{"date_histogram":{"field":af,"calendar_interval":iv}}}}
        else:
            return {"success":False,"error":f"Unknown type: {at}"}
        data = self.es_query('POST', f'/{idx}/_search', aq)
        if 'error' in data: return {"success":False,"error":str(data['error'])}
        buckets = data.get('aggregations',{}).get('group_by',{}).get('buckets',[])
        return {"success":True,"field":af,"type":at,"buckets":buckets}

    # ─── Geo ───
    def get_geo_data(self, params):
        idx = map_index(params.get('index',['wazuh-alerts-4.x-*'])[0])
        limit = min(int(params.get('limit',['1000'])[0]), 5000)
        qd = {"size":limit,"query":{"bool":{"must":[{"exists":{"field":"data.geoip.location"}}]}},"_source":["data.geoip","data.srcip","rule.level","timestamp","agent.name"]}
        data = self.es_query('POST', f'/{idx}/_search', qd)
        if 'error' in data: return {"success":False,"error":str(data['error'])}
        docs = []
        for h in data.get('hits',{}).get('hits',[]):
            d = h.get('_source',{})
            g = d.get('data',{}).get('geoip',{})
            loc = g.get('location',{})
            if loc:
                docs.append({"lat":loc.get('lat'),"lon":loc.get('lon'),"city":g.get('city_name','Unknown'),"country":g.get('country_name','Unknown'),"ip":d.get('data',{}).get('srcip','N/A'),"level":d.get('rule',{}).get('level',0),"agent":d.get('agent',{}).get('name','N/A'),"timestamp":d.get('timestamp','')})
        return {"success":True,"count":len(docs),"results":docs}

    # ─── Utils ───
    def _parse_date(self, ds):
        if not ds or 'T' in ds: return ds
        for fmt in ['%Y-%m-%dT%H:%M','%Y-%m-%d %H:%M','%Y-%m-%d','%Y-%m-%dT%H:%M:%S','%Y-%m-%d %H:%M:%S']:
            try: return datetime.strptime(ds,fmt).strftime('%Y-%m-%dT%H:%M:%S')
            except: continue
        return ds

# ─── Auto-restart monitor ───
def start_with_monitor():
    while True:
        try:
            server = ThreadedHTTPServer(('0.0.0.0', 9999), Handler)
            print(f"\n╔══════════════════════════════════════════════╗")
            print(f"║  🛡️  WAZUH SOC API SERVER v3.1             ║")
            print(f"║  Port: 9999  (Threaded + Auto-Restart)     ║")
            print(f"╠══════════════════════════════════════════════╣")
            print(f"║  Endpoints: /health /indices /fields       ║")
            print(f"║  /search /count /scan /aggregate /geo      ║")
            print(f"╚══════════════════════════════════════════════╝\n")
            server.serve_forever()
        except OSError as e:
            if "Address already in use" in str(e):
                print("⚠ Port 9999 in use, waiting 5s...")
                import time; time.sleep(5)
            else:
                print(f"⚠ Server error: {e}, restarting in 3s...")
                import time; time.sleep(3)
        except Exception as e:
            print(f"⚠ Crash: {e}, restarting in 3s...")
            import time; time.sleep(3)

if __name__ == '__main__':
    start_with_monitor()
