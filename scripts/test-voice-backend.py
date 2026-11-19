"""Exercise real PocketBase migrations, team access, uploads and the local proxy."""
import importlib.util
import io
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
import wave
from http.server import ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[1]
def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0))
        return sock.getsockname()[1]

with tempfile.TemporaryDirectory(prefix='voice-test-', dir=ROOT/'.work') as temp:
    address = f'http://127.0.0.1:{port()}'
    command = [str(ROOT/'.tools/pocketbase/pocketbase.exe')]
    flags = [f'--dir={temp}/data',f'--migrationsDir={ROOT}/pocketbase/pb_migrations',f'--hooksDir={ROOT}/pocketbase/pb_hooks']
    password = secrets.token_urlsafe(24)
    subprocess.run(command+['superuser','upsert','voice-test@example.com',password]+flags, check=True, stdout=subprocess.DEVNULL)
    with open(Path(temp)/'server.log','w') as log:
        process = subprocess.Popen(command+['serve',f'--http={address.removeprefix("http://")}']+flags,stdout=log,stderr=log)
        try:
            def request(path, data=None, token='', method=None, content='application/json', base=address, expected=200):
                body = json.dumps(data).encode() if isinstance(data,dict) else data
                headers = {'Content-Type':content}
                if token: headers['Authorization']=token
                req = urllib.request.Request(base+path,data=body,method=method,headers=headers)
                try: response=urllib.request.urlopen(req,timeout=5)
                except urllib.error.HTTPError as error: response=error
                raw=response.read()
                assert response.code==expected,(path,response.code,raw[:800])
                return json.loads(raw) if 'json' in response.headers.get('Content-Type','') else raw
            for _ in range(100):
                try:
                    request('/api/health');break
                except OSError: time.sleep(.1)
            else: raise AssertionError('PocketBase did not start')
            admin=request('/api/collections/_superusers/auth-with-password',{'identity':'voice-test@example.com','password':password})['token']
            user=request('/api/collections/voice_team/records',{'email':'teammate@example.com','password':password,'passwordConfirm':password,'name':'Test teammate'},admin)
            auth=request('/api/collections/voice_team/auth-with-password',{'identity':'teammate@example.com','password':password})
            token=auth['token']
            # All records and both audio files are private to team members.
            assert request('/api/collections/voice_takes/records')['totalItems']==0
            request('/api/collections/voice_team/records',{'email':'intruder@example.com','password':password,'passwordConfirm':password,'name':'Intruder'},expected=403)
            spec=importlib.util.spec_from_file_location('player_server',ROOT/'scripts/serve-browser.py')
            server_module=importlib.util.module_from_spec(spec);spec.loader.exec_module(server_module)
            os.environ['POCKETBASE_URL']=address
            proxy=ThreadingHTTPServer(('127.0.0.1',0),server_module.Handler)
            thread=threading.Thread(target=proxy.serve_forever,daemon=True);thread.start()
            base=f'http://127.0.0.1:{proxy.server_port}'
            try:
                assert b'Give the party a voice' in request('/voice',base=base)
                assert request('/voice-lines.json',base=base)['vo_ball1locked']
                assert request('/api/collections/voice_team/auth-with-password',{'identity':'teammate@example.com','password':password},base=base)['token']
                wav=io.BytesIO()
                with wave.open(wav,'wb') as sound:
                    sound.setparams((2,2,32000,0,'NONE','not compressed')); sound.writeframes(b'\0'*12800)
                def upload(status='pending',contributor=user['id'],auth_token=token,expected=200):
                    boundary=secrets.token_hex(16); body=bytearray()
                    values={'contributor':contributor,'speaker':'Test teammate','line_id':'vo_ball1locked','line_text':'One friend is ready.','status':status,'settings':'{"name":"Finni Party","pitch":2}'}
                    for key,value in values.items():
                        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
                    for key in ('original','processed'):
                        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"; filename="{key}.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode()+wav.getvalue()+b'\r\n')
                    body.extend(f'--{boundary}--\r\n'.encode())
                    return request('/api/collections/voice_takes/records',bytes(body),auth_token,content=f'multipart/form-data; boundary={boundary}',base=base,expected=expected)
                take=upload()
                upload(status='approved',expected=400)
                upload(auth_token='',expected=400)
                assert request('/api/collections/voice_takes/records',token=token,base=base)['totalItems']==1
                assert request('/api/collections/voice_takes/records',base=base)['totalItems']==0
                file_path=f'/api/files/{take["collectionId"]}/{take["id"]}/{take["processed"]}'
                request(file_path,base=base,expected=404)
                file_token=request('/api/files/token',token=token,method='POST',base=base)['token']
                assert request(file_path+'?token='+file_token,base=base)==wav.getvalue()
                request(f'/api/collections/voice_takes/records/{take["id"]}',{'status':'approved'},token,method='PATCH',expected=403)
                request(f'/api/collections/voice_takes/records/{take["id"]}',{'status':'approved','review_note':'Ready for game build'},admin,method='PATCH')
                print('Voice backend: migrations, admin-only membership/review, private files, multipart proxy and shared library pass.')
            finally: proxy.shutdown();proxy.server_close()
        finally: process.terminate();process.wait(timeout=10)
