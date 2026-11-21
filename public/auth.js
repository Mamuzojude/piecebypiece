const byId = id => document.getElementById(id);
let signUpMode = false;
const form = byId('auth-form');
const statusEl = byId('auth-status');
const warning = byId('config-warning');
function paintMode(){
  byId('auth-title').innerHTML = signUpMode ? 'Create your <em>account.</em>' : 'Welcome <em>back.</em>';
  byId('name-wrap').hidden = !signUpMode;
  byId('password').autocomplete = signUpMode ? 'new-password' : 'current-password';
  byId('auth-submit').innerHTML = signUpMode ? 'Create account <span>↗</span>' : 'Sign in <span>↗</span>';
  byId('switch-copy').textContent = signUpMode ? 'Already have an account?' : 'New to PieceByPiece?';
  byId('switch-mode').textContent = signUpMode ? 'Sign in' : 'Create an account';
  statusEl.textContent = '';
}
byId('switch-mode').addEventListener('click',()=>{signUpMode=!signUpMode;paintMode();});
if(!window.pbpSupabaseReady){warning.hidden=false;warning.textContent='Supabase is not configured yet. Add your project URL and publishable/anon key in supabase-config.js after creating your Supabase project. The account form will become active once configured.';byId('auth-submit').disabled=true;}
else {
  window.pbpSupabase.auth.getSession().then(({data})=>{if(data.session) location.href='organizer.html';});
  form.addEventListener('submit',async e=>{
    e.preventDefault();const email=byId('email').value.trim();const password=byId('password').value;const button=byId('auth-submit');button.disabled=true;statusEl.textContent=signUpMode?'Creating your account…':'Signing you in…';
    try{
      if(signUpMode){const displayName=byId('display-name').value.trim();const {data,error}=await window.pbpSupabase.auth.signUp({email,password,options:{data:{display_name:displayName},emailRedirectTo:`${location.origin}${location.pathname.replace(/auth\.html$/,'')}organizer.html`}});if(error)throw error;statusEl.textContent=data.session?'Account created. Opening your workspace…':'Account created. Check your email to confirm your address, then sign in.';if(data.session)setTimeout(()=>location.href='organizer.html',700);}
      else {const {error}=await window.pbpSupabase.auth.signInWithPassword({email,password});if(error)throw error;location.href='organizer.html';}
    }catch(err){statusEl.textContent=err.message||'Something went wrong. Please try again.';}finally{button.disabled=false;}
  });
}
paintMode();
