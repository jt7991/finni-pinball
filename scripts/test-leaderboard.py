"""Integration checks against a disposable real PocketBase database."""
import concurrent.futures
import json
import os
from pathlib import Path
import socket
import sqlite3
from contextlib import closing
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
BIN=Path(os.environ.get('POCKETBASE_BIN',ROOT/'.tools/pocketbase/pocketbase.exe'))


class LeaderboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not BIN.is_file():
            raise unittest.SkipTest('Set POCKETBASE_BIN to a PocketBase 0.42.3 executable.')
        cls.temp=tempfile.TemporaryDirectory(prefix='finni-leaderboard-')
        cls.data=Path(cls.temp.name)/'data'
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        cls.url=f'http://127.0.0.1:{port}'
        cls.log=open(Path(cls.temp.name)/'server.log','wb')
        cls.process=subprocess.Popen([str(BIN),'serve',f'--http=127.0.0.1:{port}',f'--dir={cls.data}',f'--hooksDir={ROOT / "pocketbase/pb_hooks"}',f'--migrationsDir={ROOT / "pocketbase/pb_migrations"}'],stdout=cls.log,stderr=cls.log)
        for _ in range(100):
            try:
                with urllib.request.urlopen(cls.url+'/api/health',timeout=.2):return
            except (OSError,urllib.error.URLError):time.sleep(.05)
        cls.process.terminate();cls.process.wait();cls.log.close();cls.temp.cleanup()
        raise RuntimeError('Test PocketBase did not start')

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate();cls.process.wait();cls.log.close();cls.temp.cleanup()

    def request(self,path,data=None,method=None):
        payload=None if data is None else json.dumps(data).encode()
        req=urllib.request.Request(self.url+path,data=payload,method=method,headers={'Content-Type':'application/json','X-Real-IP':'198.51.100.42'})
        try:response=urllib.request.urlopen(req)
        except urllib.error.HTTPError as error:response=error
        with response:return response.status,json.loads(response.read())

    def run_record(self,age=60):
        status,run=self.request('/api/finni/runs',{})
        self.assertEqual(status,201)
        with closing(sqlite3.connect(self.data/'data.db')) as db, db:
            db.execute('UPDATE game_sessions SET started=? WHERE id=?',(time.time()*1000-age*1000,run['id']))
        return {'run':run['id'],'token':run['token']}

    def submit(self,run,initials='TST',score=1000,player=1):
        return self.request('/api/finni/scores',{**run,'scores':[{'initials':initials,'score':score,'player':player}]})

    def test_valid_shared_scores_and_duplicate_rejection(self):
        run=self.run_record()
        self.assertEqual(self.submit(run,'AAA',123456)[0],201)
        self.assertEqual(self.submit(run,'AAA',123456)[0],200)
        self.assertEqual(self.submit(run,'AAA',123457)[0],400)
        status,board=self.request('/api/finni/leaderboard')
        self.assertEqual(status,200)
        self.assertTrue(any(r['initials']=='AAA' and r['score']==123456 for r in board['items']))

    def test_bad_token_and_input_do_not_consume_run(self):
        run=self.run_record()
        self.assertEqual(self.submit({**run,'token':'wrong'})[0],403)
        for initials,score in [('<X>',10),('ABCD',10),('ABC',-1),('ABC',1.5),('ABC',True),('ABC',1e15)]:
            self.assertEqual(self.submit(run,initials,score)[0],400)
        self.assertEqual(self.submit(run)[0],201)

    def test_suspicious_run_hidden_from_both_read_endpoints(self):
        run=self.run_record(age=0)
        status,result=self.submit(run,'ZZZ',999999999)
        self.assertEqual(status,201);self.assertTrue(result['review'])
        _,board=self.request('/api/finni/leaderboard')
        self.assertFalse(any(r['initials']=='ZZZ' for r in board['items']))
        _,records=self.request('/api/collections/scores/records')
        self.assertFalse(any(r['initials']=='ZZZ' for r in records['items']))

    def test_public_mutation_locked_and_sessions_private(self):
        self.assertNotEqual(self.request('/api/collections/scores/records',{'initials':'BAD','score':999999})[0],200)
        self.assertEqual(self.request('/api/collections/game_sessions/records')[0],403)

    def test_multiplayer_atomicity_and_ranking(self):
        run=self.run_record()
        entries=[{'initials':'P'+str(i),'score':i*100,'player':i} for i in range(1,5)]
        self.assertEqual(self.request('/api/finni/scores',{**run,'scores':entries})[0],201)
        _,board=self.request('/api/finni/leaderboard')
        scores=[row['score'] for row in board['items']]
        self.assertEqual(scores,sorted(scores,reverse=True))
        with closing(sqlite3.connect(self.data/'data.db')) as db, db:
            self.assertEqual(db.execute('SELECT count(*) FROM scores WHERE run=?',(run['run'],)).fetchone()[0],4)

    def test_concurrent_submissions_only_save_once(self):
        run=self.run_record()
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            statuses=list(pool.map(lambda _:self.submit(run)[0],range(2)))
        self.assertEqual(sorted(statuses),[200,201])

    def test_expired_session_rejected(self):
        self.assertEqual(self.submit(self.run_record(age=90000))[0],400)


if __name__=='__main__':unittest.main(verbosity=2)
