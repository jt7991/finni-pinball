migrate((app) => {
  app.save(new Collection({type:'base',name:'game_sessions',fields:[
    {name:'token_hash',type:'text',required:true},
    {name:'started',type:'number',required:true},
    {name:'ip_hash',type:'text',required:true},
    {name:'used',type:'bool'},
    {name:'version',type:'text',required:true},
  ],indexes:['CREATE INDEX idx_sessions_started_ip ON game_sessions (ip_hash, started)']}));
  app.save(new Collection({type:'base',name:'scores',listRule:'hidden = false && flagged = false',viewRule:'hidden = false && flagged = false',fields:[
    {name:'initials',type:'text',required:true,min:1,max:3,pattern:'^[A-Z0-9]{1,3}$'},
    {name:'score',type:'number',required:true,min:1,max:999999999999,onlyInt:true},
    {name:'player',type:'number',required:true,min:1,max:4,onlyInt:true},
    {name:'run',type:'relation',required:true,collectionId:app.findCollectionByNameOrId('game_sessions').id,maxSelect:1,cascadeDelete:false},
    {name:'duration',type:'number',required:true,min:0},
    {name:'version',type:'text',required:true},
    {name:'flagged',type:'bool'}, {name:'hidden',type:'bool'},
    {name:'review_note',type:'text'},
    {name:'submitted',type:'date',required:true},
  ],indexes:['CREATE UNIQUE INDEX idx_scores_run_player ON scores (run, player)','CREATE INDEX idx_scores_ranking ON scores (hidden, flagged, score DESC, submitted)']}));
}, (app) => {
  app.delete(app.findCollectionByNameOrId('scores'));
  app.delete(app.findCollectionByNameOrId('game_sessions'));
});
