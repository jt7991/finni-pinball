// Publish previously held scores as well as new submissions. Explicit admin
// removals (hidden) still apply; the legacy flagged field is no longer a gate.
migrate((app) => {
  const scores=app.findCollectionByNameOrId('scores');
  scores.listRule='hidden = false';
  scores.viewRule='hidden = false';
  app.save(scores);
}, (app) => {
  const scores=app.findCollectionByNameOrId('scores');
  scores.listRule='hidden = false && flagged = false';
  scores.viewRule='hidden = false && flagged = false';
  app.save(scores);
});
