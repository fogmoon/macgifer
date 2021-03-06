window.macgifer = window.macgifer || {};

/**
 * Intro player
 */
macgifer.Intro = function () {
  //Chrome bug: explosion image doesn't load after refresh
  var t = (new Date()).getTime();
  this.swf_ = '/vendor/soundmanager2/swf/';
  this.sound_ = '/sound/intro.mp3';
  this.explosion_ = '/img/explosion.gif?t=' + t;
  this.logo_ = '/img/macgifer.gif?t=' + t;
  this.load_();
};

/**
 * Load the player
 */
macgifer.Intro.prototype.load_ = function() {
  soundManager.setup({
    url: this.swf_,
    flashVersion: 9,
    useHTML5Audio: true,
    preferFlash: false,
    useFlashBlock: false,
    debugFlash: false,
    debugMode: false,
    onready: this.loadSound_.bind(this)
  });
};

/**
 * Load sound
 */
macgifer.Intro.prototype.loadSound_ = function() {
  soundManager.createSound({
    id: 1,
    url: this.sound_,
    autoLoad: true,
    onload: this.loadExplosion_.bind(this)
  });
};

/**
 * Load explosion
 */
macgifer.Intro.prototype.loadExplosion_ = function() {
  var explosion = new Image();
  explosion.onload = this.loadLogo_.bind(this);
  explosion.src = this.explosion_;
};

/**
 * Load logo
 */
macgifer.Intro.prototype.loadLogo_ = function() {
  var logo = new Image();
  logo.onload = this.animate_.bind(this);
  logo.src = this.logo_;
};

/**
 * Perform animation
 */
macgifer.Intro.prototype.animate_ = function() {
  var intro = document.createElement('div');
  intro.className = 'intro';

  var explosion = document.createElement('div');
  explosion.className = 'explosion';
  explosion.style.backgroundImage = 'url(' + this.explosion_ + ')';
  intro.appendChild(explosion);

  var logo = document.createElement('div');
  logo.className = 'logo';
  logo.style.backgroundImage = 'url(' + this.logo_  + ')';
  intro.appendChild(logo);

  document.body.insertBefore(intro, document.body.firstChild);
  soundManager.play(1, {volume: 100});
  this.intro_ = intro;
  setTimeout(this.stop_.bind(this), 5000);
};

/**
 * Stop player
 */
macgifer.Intro.prototype.stop_ = function() {
  this.intro_.remove();
  var hs = document.querySelectorAll('.hide');
  for (var i=0; i<hs.length; i++) {
    hs[i].classList.remove('hide');
  }
};

new macgifer.Intro();
