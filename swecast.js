function loadScript(url) {
  s=document.createElement('script');
	s.type='text/javascript';
	s.src=url;
	document.body.appendChild(s);
}
if (!window.jQuery) {
	loadScript('http://code.jquery.com/jquery-2.1.1.min.js');
}
if (!chrome.cast) {
	loadScript('https://www.gstatic.com/cv/js/sender/v1/cast_sender.js');
}

if (!window.ChromeCastApi) {
	ChromeCastApi = {

		session: null,

		showError: function(e) {
		  if (e.code == 'cancel') {
		  	return;
		  }
			alert("Error: "+e.code+" "+e.description);
		},

		sessionListener: function(e) {
			this.session = e;
			
			if (this.requestUrl) {
				this.loadVideo();
			} else if (this.session.media.length != 0) {
				this.onMediaDiscovered(this.session.media[0]);
		  }
		},

		onRequestSessionSuccess: function(e) {
			this.session = e;
			this.loadVideo();
		},

		receiverListener: function(e) {
			if( e === chrome.cast.ReceiverAvailability.AVAILABLE) {
				chrome.cast.requestSession(this.onRequestSessionSuccess, this.showError);
			} else {
				alert("Turn on your chromecast");
			}
		},

		onMediaDiscovered: function(media) {
			this.currentMedia = media;
			
			if (!this.statusWindow) {
				this.statusWindow = document.createElement('div');
				$(this.statusWindow).css({
					position: 'absolute',
					top: '0px',
					left: '25%',
					width: '50%',
					height: '80px',
					backgroundColor: '#000',
					color: '#fff'
				});
				
				this.statusWindow.statusText = document.createElement('div');
				this.statusWindow.appendChild(this.statusWindow.statusText);
				
				$('<button/>')
				  .text(this.currentMedia.playerState == 'PLAYING' ? 'Pause' : 'Play')
				  .click(this.playPause.bind(this))
				  .appendTo(this.statusWindow);

				$('<button/>')
				  .text('Stop')
				  .click(this.stop.bind(this))
				  .appendTo(this.statusWindow);

				document.body.appendChild(this.statusWindow);
			}
			this.statusWindow.statusText.innerHTML='Playing '+media.media.metadata.title;

		},
		
		stop: function() {
			this.currentMedia.stop(null, null, this.showError);
		},
		
		playPause: function(e) {
		  if (this.currentMedia.playerState == 'PLAYING') {
				this.currentMedia.pause(null, null, this.showError);
				$(e.target).text('Play');
			} else {
				this.currentMedia.play(null, null, this.showError);
				$(e.target).text('Pause');
			}
		},

		play: function(url, title) {
		  this.requestUrl = url;
		  this.requestTitle = title;
			if (this.session) {
				this.loadVideo();
			}
		},
	
		loadVideo: function() {
			var mediaInfo = new chrome.cast.media.MediaInfo(this.requestUrl, "video/mp4");
			mediaInfo.metadata = new chrome.cast.media.MovieMediaMetadata();
			mediaInfo.metadata.title = this.requestTitle;
      var request = new chrome.cast.media.LoadRequest(mediaInfo);
			this.session.loadMedia(request, this.onMediaDiscovered.bind(this), this.showError);
			this.requestUrl = null;
			this.requestTitle = null;
		},
		
		initialized: function() {
		},
	
		init: function() {
			window['__onGCastApiAvailable'] = function(loaded, errorInfo) {
				if (loaded) {
					var sessionRequest = new chrome.cast.SessionRequest(chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);
					var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
						this.sessionListener.bind(this),
						this.receiverListener.bind(this));
					chrome.cast.initialize(apiConfig, this.initialized, this.showError);
				} else {
					this.showError(errorInfo);
				}
			}.bind(this);
		}

	};
}

ChromeCastApi.init();


function loadTv4Video() {
	var videoid = document.evaluate('//figure/@data-video-id', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.value;

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
}

loadTv4Video();

