import urllib.request
import urllib.error
import json
import ssl

data = json.dumps({'token': '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'}).encode('utf-8')
req = urllib.request.Request('http://127.0.0.1:8000/api/github/auth', data=data, headers={'Content-Type': 'application/json'})
context = ssl._create_unverified_context()

try:
    res = urllib.request.urlopen(req, context=context)
    print("SUCCESS:", res.status, res.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print(e.read().decode('utf-8'))
except Exception as e:
    print("OTHER ERROR:", str(e))
