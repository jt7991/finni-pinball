migrate((app) => {
  const team = new Collection({type:'auth', name:'voice_team', fields:[
    {name:'name',type:'text',required:true,max:80},
  ]});
  // Admin-provisioned membership; teammates cannot register or change roles.
  app.save(team);
  const member = '@request.auth.collectionName = "voice_team"';
  app.save(new Collection({type:'base',name:'voice_takes',
    listRule:member,viewRule:member,
    createRule:member + ' && contributor = @request.auth.id && status = "pending" && review_note = ""',
    updateRule:null,deleteRule:null,
    fields:[
      {name:'contributor',type:'relation',required:true,collectionId:team.id,maxSelect:1},
      {name:'speaker',type:'text',required:true,max:80},
      {name:'line_id',type:'text',required:true,max:100,pattern:'^[A-Za-z0-9_-]+$'},
      {name:'line_text',type:'text',required:true,max:500},
      {name:'settings',type:'json',required:true,maxSize:4096},
      {name:'original',type:'file',required:true,maxSelect:1,maxSize:4000000,mimeTypes:['audio/wav','audio/x-wav','audio/wave','audio/vnd.wave'],protected:true},
      {name:'processed',type:'file',required:true,maxSelect:1,maxSize:4000000,mimeTypes:['audio/wav','audio/x-wav','audio/wave','audio/vnd.wave'],protected:true},
      {name:'status',type:'select',required:true,maxSelect:1,values:['pending','approved','needs-retake']},
      {name:'review_note',type:'text',max:2000},
      {name:'created',type:'autodate',onCreate:true,onUpdate:false},
    ],indexes:['CREATE INDEX idx_voice_created ON voice_takes (created)'],
  }));
}, (app) => {
  app.delete(app.findCollectionByNameOrId('voice_takes'));
  app.delete(app.findCollectionByNameOrId('voice_team'));
});
