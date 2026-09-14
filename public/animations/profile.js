
/* Separate profile motion hook. Visual animation rules live in animations.css. */
(function(){
  const profile = document.getElementById('profilePage');
  if(!profile) return;
  window.MaalavoProfileMotion = {
    refresh(){
      profile.classList.remove('profile-motion-refresh');
      void profile.offsetWidth;
      profile.classList.add('profile-motion-refresh');
    }
  };
})();
