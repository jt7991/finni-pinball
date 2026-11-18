migrate((app) => {
  const settings=app.settings();
  // The web proxy overwrites this header, and PB is not published separately.
  settings.trustedProxy.headers=['X-Real-IP'];
  settings.trustedProxy.useLeftmostIP=false;
  settings.rateLimits.enabled=true;
  app.save(settings);
}, (app) => {
  const settings=app.settings();settings.trustedProxy.headers=[];app.save(settings);
});
