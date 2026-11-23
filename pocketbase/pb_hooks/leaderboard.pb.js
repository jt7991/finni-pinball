// Public reads, anonymous one-use runs, admin-only record mutation.
// Client-side physics scores are not authoritative. Valid submissions publish immediately.
routerAdd('POST','/api/finni/runs',(e)=>{
  const now=Date.now();
  const ip=$security.sha256(e.realIP());
  const recent=$app.findRecordsByFilter('game_sessions','ip_hash = {:ip} && started > {:since}','',20,0,{ip:ip,since:now-3600000});
  if(recent.length>=20)throw new TooManyRequestsError('Too many games started. Try again later.');
  const token=$security.randomString(48);
  const record=new Record($app.findCollectionByNameOrId('game_sessions'));
  record.set('token_hash',$security.sha256(token));record.set('started',now);record.set('ip_hash',ip);record.set('version','finni-party-v9-wasm034');
  $app.save(record);
  return e.json(201,{id:record.id,token:token});
});

routerAdd('POST','/api/finni/scores',(e)=>{
  const data=e.requestInfo().body;
  if(!data||typeof data.run!=='string'||typeof data.token!=='string'||!Array.isArray(data.scores)||data.scores.length<1||data.scores.length>4)throw new BadRequestError('Invalid game result.');
  const players={};
  for(const entry of data.scores){
    if(!entry||!Number.isInteger(entry.score)||entry.score<1||entry.score>999999999999||!Number.isInteger(entry.player)||entry.player<1||entry.player>4||players[entry.player]||typeof entry.initials!=='string'||!(/^[A-Z0-9]{1,12}$/).test(entry.initials))throw new BadRequestError('Invalid score or name (use 1–12 uppercase letters or numbers).');
    players[entry.player]=true;
  }
  let replayed=false;
  $app.runInTransaction((tx)=>{
    let run;
    try{run=tx.findRecordById('game_sessions',data.run);}catch{throw new BadRequestError('Game session not found. Start a new game.');}
    if(run.getString('token_hash')!==$security.sha256(data.token))throw new ForbiddenError('Invalid game token.');
    if(run.getBool('used')){
      const saved=tx.findRecordsByFilter('scores','run = {:run}','player',4,0,{run:run.id});
      if(saved.length!==data.scores.length||!saved.every(r=>data.scores.some(s=>s.player===r.getInt('player')&&s.score===r.getFloat('score')&&s.initials===r.getString('initials'))))throw new BadRequestError('This game was already submitted.');
      replayed=true;return;
    }
    const duration=(Date.now()-run.getFloat('started'))/1000;
    if(duration>86400||duration<0)throw new BadRequestError('Game session expired.');
    for(const entry of data.scores){
      const record=new Record(tx.findCollectionByNameOrId('scores'));
      record.set('initials',entry.initials);record.set('score',entry.score);record.set('player',entry.player);record.set('run',run.id);record.set('duration',duration);record.set('version',run.getString('version'));record.set('submitted',new Date().toISOString());
      tx.save(record);
    }
    run.set('used',true);tx.save(run);
  });
  return e.json(replayed?200:201,{saved:true});
},$apis.bodyLimit(4096));

routerAdd('GET','/api/finni/leaderboard',(e)=>{
  // Rank names before limiting, so repeated games never crowd out players.
  // Keep every result for audit and idempotent run submission.
  const records=arrayOf(new DynamicModel({initials:'',score:0,submitted:''}));
  $app.db().newQuery(`
    SELECT initials, score, submitted FROM (
      SELECT UPPER(TRIM(initials)) AS initials, score, submitted, id,
        ROW_NUMBER() OVER (
          PARTITION BY UPPER(TRIM(initials)) ORDER BY score DESC, submitted, id
        ) AS position
      FROM scores WHERE hidden = false
    ) WHERE position = 1 ORDER BY score DESC, submitted, id LIMIT 25
  `).all(records);
  return e.json(200,{items:records});
});
