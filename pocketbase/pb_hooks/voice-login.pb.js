routerAdd('POST', '/api/voice-login', (e) => {
  const password = $os.getenv('VOICE_STUDIO_PASSWORD');
  if (!password) throw new ServiceUnavailableError('Voice Studio sign-in is not configured.');
  const body = e.requestInfo().body;
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > 80) throw new BadRequestError('Enter a name of up to 80 characters.');
  if (typeof body.password !== 'string' || !$security.equal($security.sha256(body.password), $security.sha256(password))) {
    throw new UnauthorizedError('Incorrect studio password.');
  }

  const email = $security.sha256(name.toLowerCase()).slice(0, 40) + '@studio.invalid';
  let member;
  $app.runInTransaction(tx => {
    const existing = tx.findRecordsByFilter('voice_team', 'email = {:email}', '', 1, 0, {email});
    if (existing.length) {
      member = existing[0];
      return;
    }
    member = new Record(tx.findCollectionByNameOrId('voice_team'));
    member.setEmail(email);
    member.setPassword($security.randomString(48));
    member.set('name', name);
    tx.save(member);
  });
  e.response.header().set('Cache-Control', 'no-store');
  return e.json(200, {token: member.newAuthToken(), id: member.id, name: member.getString('name')});
}, $apis.bodyLimit(4096));
