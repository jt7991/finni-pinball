migrate((app) => {
  const settings = app.settings();
  settings.rateLimits.rules = [
    {label: 'POST /api/voice-login', audience: '', duration: 60, maxRequests: 10},
    ...settings.rateLimits.rules,
  ];
  app.save(settings);
  const takes = app.findCollectionByNameOrId('voice_takes');
  takes.createRule += ' && speaker = @request.auth.name';
  app.save(takes);
}, (app) => {
  const settings = app.settings();
  settings.rateLimits.rules = settings.rateLimits.rules.filter(rule => rule.label !== 'POST /api/voice-login');
  app.save(settings);
  const takes = app.findCollectionByNameOrId('voice_takes');
  takes.createRule = takes.createRule.replace(' && speaker = @request.auth.name', '');
  app.save(takes);
});
