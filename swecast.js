function loadScript(url) {
  s=document.createElement('script');
	s.type='text/javascript';
	s.src=url;
	document.body.appendChild(s);
}

if (!window.jQuery) {
	loadScript('http://code.jquery.com/jquery-2.1.1.min.js');
}

if (!window.chrome || !window.chrome.cast) {
	loadScript('https://www.gstatic.com/cv/js/sender/v1/cast_sender.js');
}

if (!window.ChromeCastApi) {
	ChromeCastApi = {

		session: null,

		showError: function(e) {
		  if (e.code == 'cancel') {
		  	return;
		  }
		  this.setStatus('Error: '+e.code+''+e.description);
		},

		sessionListener: function(e) {
			this.session = e;
			if (this.session.media.length != 0) {
				this.onMediaDiscovered(this.session.media[0]);
		  	} else if (this.requestUrl != null) {
		  		this.loadVideo();
		  	}
		},

		receiverListener: function(e) {
			this.setStatus('reciever listener');
			if( e === chrome.cast.ReceiverAvailability.AVAILABLE) {
				this.setStatus('available');
				chrome.cast.requestSession(this.sessionListener.bind(this), this.showError.bind(this));
			} else {
				this.setStatus('Unavailable, turn on your chrome cast');
			}
		},

		onMediaDiscovered: function(media) {
			if (!this.progressUpdater) {
				this.progressUpdater = setInterval(this.onMediaStatusUpdate.bind(this), 1000);
			}
			this.setStatus('Media discovered');

			this.currentMedia = media;

			this.statusWindow.statusText.text(this.currentMedia.media.metadata.title);

			var dur = this.currentMedia.media.duration;
			this.statusWindow.progressBar.attr('max', dur);
			this.statusWindow.progressTotal.text(this.time(dur));

			this.onMediaStatusUpdate();

			this.currentMedia.addUpdateListener(this.onMediaStatusUpdate.bind(this));
		},

		onMediaStatusUpdate: function() {
			if (this.currentMedia.playerState == 'PLAYING') {
				this.statusWindow.playPauseBtn.html('&#9646;&#9646;');
			} else if (this.currentMedia.playerState == 'PAUSED') {
				this.statusWindow.playPauseBtn.html('&#9654;');
			}
			var t = this.currentMedia.getEstimatedTime();
			this.statusWindow.progressText.text(this.time(t));
			this.statusWindow.progressBar.attr('value', t);
		},

		time: function(t) {
			t = Math.floor(t);
			var h = Math.floor(t / 3600);
			t = t % 3600;
			var m = Math.floor(t / 60);
			var s = t % 60;

			function pad(i) {
				return i < 10 ? '0'+i : i;
			}

			var timeStr = pad(h)+':'+pad(m)+':'+pad(s);
			return timeStr;
		},
		
		stop: function() {
			this.currentMedia.stop(null, null, this.showError.bind(this));
		},
		
		playPause: function(e) {
		  if (this.currentMedia.playerState == 'PLAYING') {
				this.currentMedia.pause(null, null, this.showError.bind(this));
			} else {
				this.currentMedia.play(null, null, this.showError.bind(this));
			}
		},

		play: function(url, title) {
		  this.requestUrl = url;
		  this.requestTitle = title;
		  if (this.noCast === true) {
		  	window.location = url;
		  } else if (this.session) {
				this.loadVideo();
			}
		},
	
		loadVideo: function() {
			this.setStatus('Loading video');

			var mediaInfo = new chrome.cast.media.MediaInfo(this.requestUrl, "video/mp4");
			mediaInfo.metadata = new chrome.cast.media.MovieMediaMetadata();
			mediaInfo.metadata.title = this.requestTitle;
      		
      		var request = new chrome.cast.media.LoadRequest(mediaInfo);
			this.session.loadMedia(request, this.onMediaDiscovered.bind(this), this.showError.bind(this));
			this.requestUrl = null;
			this.requestTitle = null;
		},
		
		initialized: function() {
			if (!this.statusWindow) {
				this.statusWindow = document.createElement('div');
				$(this.statusWindow).css({
					position: 'fixed',
					top: '0px',
					left: '25%',
					width: '300px',
					padding: '5px',
					height: '40px',
					backgroundColor: '#000',
					color: '#fff'
				});
				
				this.statusWindow.statusText = $('<div>');
				this.statusWindow.statusText.css({
					width: '100%',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap'
				});
				this.statusWindow.statusText.appendTo(this.statusWindow);
				this.statusWindow.progress = $('<div>');
				this.statusWindow.progress.appendTo(this.statusWindow);
				this.statusWindow.progressText = $('<span>00:00:00</span>');
				this.statusWindow.progressText.appendTo(this.statusWindow.progress);
				this.statusWindow.progressBar = $('<progress value="0" max="100"></progress>');
				this.statusWindow.progressBar.click(this.seek.bind(this));
				this.statusWindow.progressBar.appendTo(this.statusWindow.progress);
				this.statusWindow.progressTotal = $('<span>00:00:00</span>');
				this.statusWindow.progressTotal.appendTo(this.statusWindow.progress);
				//$('<br>').appendTo(this.statusWindow);
				this.statusWindow.playPauseBtn = $('<button/>');

				this.statusWindow.playPauseBtn
				  .html('&#9654;')
				  .width(25)
				  .css({
				  	margin: '2px'
				  })
				  .click(this.playPause.bind(this))
				  .appendTo(this.statusWindow.progress);

				$('<button/>')
				  .html('&#9726;')
				  .width(25)
				  .css({
				  	margin: '2px'
				  })
				  .click(this.stop.bind(this))
				  .appendTo(this.statusWindow.progress);

				document.body.appendChild(this.statusWindow);
			}
		},

		seek: function(ev) {
			var el = $(ev.target);
		    var x = ev.clientX - el.offset().left;
		    var w = el.width();
		    var relX = x/w;
		    var dur = this.currentMedia.media.duration;
		    var pos = dur * relX;
		    var req = new chrome.cast.media.SeekRequest();
		    req.currentTime = pos;
		    this.currentMedia.seek(req);
		},

		setStatus: function(msg) {
			this.statusWindow.statusText.text(msg);
		},
	
		init: function() {
			window['__onGCastApiAvailable'] = function(loaded, errorInfo) {
				if (loaded) {
					var sessionRequest = new chrome.cast.SessionRequest(chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
					var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
						this.sessionListener.bind(this),
						this.receiverListener.bind(this));
					chrome.cast.initialize(apiConfig, this.initialized.bind(this), this.showError.bind(this));
				} else {
			window.location.hash="6";
				  this.noCast = true;
				}
			}.bind(this);
		}

	};
}

ChromeCastApi.init();


function loadTv4Video() {
	var videos = document.evaluate('//figure[string(@data-video-id)]', document, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
	var item;
	var elements = [];
	while (item = videos.iterateNext()) {
    	elements.push($(item));
	}


	elements.forEach(function(v){
		var videoid = v.attr('data-video-id');
		var cc = $('<img src="http://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Chromecast_cast_button_icon.svg/294px-Chromecast_cast_button_icon.svg.png"/>');
		cc.css({
			width: '30px',
			position: 'absolute',
			backgroundColor: '#fff',
			padding: 2,
			top: 0,
			left: 0
		}).click(function(e){
			e.stopPropagation();
			$.ajax('https://prima.tv4play.se/api/mobil/asset/'+videoid+'/play?protocol=hls&videoFormat=MP4+WEBVTTS',{
				success: function(data){
					var title = $(data).find('title').first().text();
				  $(data).find('url').each(function(i, url){
				    if (i == 0) {
				    	var url = $(this).text();
				    	ChromeCastApi.play(url, title);
				    }
				  });
				}
			});
		});
		cc.appendTo(v);
	});

	return;
}

if (window.location.host == 'www.tv4.se') {
	loadTv4Video();
}

