// Keep the existing field/API name so saved scores and older clients still work.
migrate((app) => {
  const scores=app.findCollectionByNameOrId('scores');
  const name=scores.fields.getByName('initials');
  name.max=12;
  name.pattern='^[A-Z0-9]{1,12}$';
  app.save(scores);
}, (app) => {
  // Do not truncate names already saved by players on rollback.
});
