const $=id=>document.getElementById(id);
const ordinal=rank=>`${rank}${rank%100>=11&&rank%100<=13?'TH':({1:'ST',2:'ND',3:'RD'}[rank%10]||'TH')}`;
async function refresh(){
  $('refresh-scores').disabled=true;
  $('scores-status').textContent='Loading high scores…';
  try{
    const response=await fetch('/api/leaderboard',{signal:AbortSignal.timeout(12000),cache:'no-store'});
    if(!response.ok)throw Error('High scores are unavailable. Please try again.');
    const {items}=await response.json();
    $('scores-rows').replaceChildren();
    items.forEach((entry,index)=>{
      const row=document.createElement('tr');
      for(const value of [ordinal(index+1),Number(entry.score).toLocaleString(),entry.initials]){
        const cell=document.createElement('td');cell.textContent=value;row.append(cell);
      }
      $('scores-rows').append(row);
    });
    $('scores-table').hidden=!items.length;
    $('record-score').textContent=items.length?Number(items[0].score).toLocaleString():'—';
    $('record-name').textContent=items.length?items[0].initials:'YOUR NAME COULD BE HERE';
    $('scores-status').textContent=items.length?'':'No scores yet. Play a game and claim the top spot.';
  }catch{
    $('scores-status').textContent='Could not refresh high scores. Please try again.';
  }finally{$('refresh-scores').disabled=false;}
}
$('refresh-scores').addEventListener('click',refresh);
refresh();
