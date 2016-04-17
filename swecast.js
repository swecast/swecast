
function loadScript(url, cb) {
  s=document.createElement('script');
	s.type='text/javascript';
	s.src=url;
	s.onload = function(e){
		e.stopPropagation();
		e.preventDefault();
		if (cb) {
			cb();
		}
	}
	document.body.appendChild(s);
}

if (!window.SweCast) {

	if (window.chrome && window.chrome.cast) {
		// Unload the cast extension, so we can load it and get the session
		window.chrome.cast = undefined;
	}

	SweCast = {

		session: null,

		appId: null,

		videoFound: false,

		init: function() {
			try {
				var ua = window.navigator.userAgent;
				if (ua.indexOf('Chrome') === -1 && ua.indexOf('CriOS') === -1) {
					alert("SweCast can only be run from the Chrome browser. No other browsers are supported because they do not have the chromecast extensions needed.");
					return;
				}
				var handler = this.lookupHandler();

				var result = handler.call();

				if (result === false) {
					return;
				}
				if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
					this.initCast();
				} else {
					window['__onGCastApiAvailable'] = function(loaded, errorInfo) {
						if (loaded) {
							this.initCast();
						} else {
							this.noExtension();
						}
					}.bind(this);
				}

				this.logVisit();
			} catch(e) {
				this.logError(e);
			}
		},

		noExtension: function() {
			var ua = window.navigator.userAgent;
			if (ua.indexOf('Chrome') != -1 && ua.indexOf('Mobile') != -1) {
				this.noCast = true;
			} else {
				if (ua.indexOf('CriOS') != -1) {
					alert("Please update the chrome browser");
					window.location.href='https://itunes.apple.com/us/app/chrome-web-browser-by-google/id535886823?mt=8';
				} else {
					alert("You need to install the Google Cast Extension first");
					window.location.href='https://chrome.google.com/webstore/detail/google-cast/boadgeojelhgndaghljhdicfkmllpafd?hl=en';
				}
			}
		},

		initCast: function(){
			var sessionRequest = new chrome.cast.SessionRequest(
				SweCast.appId || chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID
				);
			var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
				this.sessionListener.bind(this),
				this.receiverListener.bind(this),
				chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
				chrome.cast.DefaultActionPolicy.CREATE_SESSION);
			chrome.cast.initialize(apiConfig, this.createUI.bind(this), this.showError.bind(this));
		},

		lookupHandler: function(){
			var hostname = window.location.host;
			if (hostname.indexOf('www.') === 0) {
				hostname = hostname.substring(4);
			}
			var subhost = hostname.substring(hostname.indexOf('.')+1);
			var handler = this.handlers[hostname] || this.handlers[subhost] || this.handlers.defaultHandler;

			if (typeof handler === 'string') {
				handler = this.handlers[handler];
			}
			return handler;
		},

		showError: function(e) {
		  if (e.code == 'cancel') {
		  	return;
		  }

		  this.log({
				webpageName: 'CCERR:'+e.code+' '+e.description,
				url: window.location,
		   });
		  this.setStatus('Error: '+e.code+''+e.description+(e.details ? JSON.stringify(e.details) : ''));
		},

		sessionListener: function(e) {
			this.session = e;
			this.setStatus('Connected');
			if (this.session.media.length != 0) {
				this.onMediaDiscovered(this.session.media[0]);
				if (this.requestUrl != null && this.session.media[0].media.contentId != this.requestUrl) {
					this.loadVideo();
				}
		  	} else if (this.requestUrl != null) {
		  		this.loadVideo();
		  	}
		},

		receiverListener: function(e) {
			if( e === chrome.cast.ReceiverAvailability.AVAILABLE) {
				if (this.requestUrl) {
					this.requestSession(true);
				} else {
					this.requestSessionPossible = true;
					this.setStatus('Click the cast icon above a video');
				}
			} else {
        this.setStatus('Click the cast icon above a video');
        this.noCast = true;
			}
		},

		requestSession: function(isAvailable) {
			if (this.requestSessionPossible || isAvailable) {
				this.setStatus('Select chromecast device...');
				try{
					chrome.cast.requestSession(this.sessionListener.bind(this), this.showError.bind(this));
					this.requestSessionPossible = false;
				} catch(e) {
					this.logError(e);
				}
			}
		},

		onMediaDiscovered: function(media) {
			if (!this.progressUpdater && media.getEstimatedTime) {
				this.progressUpdater = setInterval(this.onMediaStatusUpdate.bind(this), 1000);
			}
			this.setStatus('Playing...');

			this.currentMedia = media;

			if (this.currentMedia.media) {
				if (this.currentMedia.media.metadata) {
					this.statusWindow.statusText.text(this.currentMedia.media.metadata.title);
				}

				var dur = this.currentMedia.media.duration;
				this.statusWindow.progressBar.attr('max', dur);
				this.statusWindow.progressTotal.text(this.time(dur));

				this.onMediaStatusUpdate();

				this.currentMedia.addUpdateListener(this.onMediaStatusUpdate.bind(this));
			}
		},

		onMediaStatusUpdate: function() {
			if (this.currentMedia && this.session) {
				if (this.currentMedia.playerState == 'PLAYING') {
					this.statusWindow.playPauseBtn.html('&#9646;&#9646;');
				} else {
					this.statusWindow.playPauseBtn.html('&#9654;');
				}
				var t = this.currentMedia.getEstimatedTime();
				this.statusWindow.progressText.text(this.time(t));
				this.statusWindow.progressBar.attr('value', t);
			} else {
				this.statusWindow.playPauseBtn.html('&#9654;');

				this.statusWindow.progressBar.attr('max', 0);
				this.statusWindow.progressTotal.text(this.time(0));

				this.statusWindow.progressText.text(this.time(0));
				this.statusWindow.progressBar.attr('value', 0);
			}
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
			if (this.currentMedia && (this.currentMedia.playerState === 'PLAYING' || this.currentMedia.playerState === 'PAUSED')) {
				this.currentMedia.stop(null, null, this.showError.bind(this));
			} else if (this.session) {
				this.session.stop(null, this.showError.bind(this));
				this.setStatus('Disconnected');
				this.session = null;
			}
			this.onMediaStatusUpdate();
		},

		playPause: function(e) {
			if (!this.currentMedia || !this.session) {
				this.requestSession();
				return;
			}
		  	if (this.currentMedia.playerState == 'PLAYING') {
				this.currentMedia.pause(null, null, this.showError.bind(this));
			} else if (this.currentMedia.playerState == 'PAUSED') {
				this.currentMedia.play(null, null, this.showError.bind(this));
			} else if (this.currentMedia.media){
	      		var request = new chrome.cast.media.LoadRequest(this.currentMedia.media);
				this.session.loadMedia(request, this.onMediaDiscovered.bind(this), this.showError.bind(this));
				this.setStatus('Loading video...');
			} else {
				this.setStatus('Select a video');
			}
		},

		play: function(url, title) {
		  	this.requestUrl = url;
		  	this.requestTitle = title;
		  	if (this.requestUrl.indexOf('HTML:') === 0) {
		  		this.appId = '02893205';
		  	}
		  	if (this.noCast === true) {
		  		this.logVideo(url);
		  		window.location.href = url;
		  	} else if (this.session) {
				this.loadVideo();
			} else {
				this.requestSession();
			}
		},

		loadVideo: function() {
			try {
				this.setStatus('Loading video...');

				this.requestTitle = this.requestTitle || this.storedTitle || document.title;

				if (this.requestTitle == null || this.requestTitle === 'null') {
					this.requestTitle = document.title;
				}

				if (this.requestUrl.indexOf('HTML:') === 0) {
					var url = this.requestUrl.substring(5);
					this.session.sendMessage('urn:x-cast:com.google.cast.sample.helloworld', '<head><meta http-equiv="refresh" content="0;URL=\''+url+'\'" /></head>', this.onMediaDiscovered.bind(this), this.showError.bind(this));
				} else {
					var mediaInfo = new chrome.cast.media.MediaInfo(this.requestUrl, 'video/mp4');
					mediaInfo.metadata = new chrome.cast.media.MovieMediaMetadata();
					mediaInfo.metadata.title = this.requestTitle;

		      		var request = new chrome.cast.media.LoadRequest(mediaInfo);
					this.session.loadMedia(request, this.onMediaDiscovered.bind(this), this.showError.bind(this));
				}
				this.addToHistory({
					url: this.requestUrl,
					title: this.requestTitle,
					host: this.requestHost || window.location.host,
					timestamp: new Date()
				});
				this.logVideo(this.requestUrl);
				this.requestUrl = null;
				this.requestTitle = null;
				this.requestHost = null;
			} catch(e) {
				this.logError(e);
			}
		},

		addToHistory: function(videoRef) {
			if (this.userStorage && this.userStorage.postMessage) {
				this.userStorage.postMessage(videoRef, '*');
			}
		},

		onMessage: function(msg) {
			if (msg.data.castVideo) {
				this.requestHost = msg.data.castVideo.host;
				this.play(msg.data.castVideo.url, msg.data.castVideo.title);
			} else if (msg.data.storedTitle) {
				this.storedTitle = msg.data.storedTitle;
			}
		},

		storeTitle: function(){
			this.storedTitle = document.title;
			this.sendTitle();
		},

		sendTitle: function() {
			if (this.storedTitle && this.userStorage) {
				this.userStorage.postMessage({
					storeTitle: this.storedTitle
				}, '*');
			}
		},

		createUI: function() {
			if (!this.statusWindow) {

				window.addEventListener("message", this.onMessage.bind(this), false);

				var userStorageUrl = 'https://rawgit.com/swecast/swecast/master/user_storage.html';
				var userStorageIframe = $('<iframe>')
				.attr('src', userStorageUrl)
				.css({
					display: 'none',
					position: 'absolute',
					width: '300px',
					height: '150px',
					border: '0px',
					borderRadius: '10px'
				})
				.bind('load', function(){
					var el = userStorageIframe.get(0);
					SweCast.userStorage = el.contentWindow || el;
					SweCast.sendTitle();
				});

				this.statusWindow = document.createElement('div');
				$(this.statusWindow).css({
					position: 'fixed',
					top: '0px',
					left: '25%',
					width: '400px',
					height: '80px',
					backgroundColor: '#344861',
					fontSize: '12px',
					fontWeight: 'bold',
					fontFamily: 'sans-serif',
					boxSizing: 'content-box',
					color: '#fff',
					zIndex: 999999,
					borderBottomLeftRadius: '10px',
					borderBottomRightRadius: '10px',
					borderTop: '0px',
					boxShadow: '2px 2px 5px #888888'
				});

				this.statusWindow.upper = $('<div>').css({
					backgroundColor: 'rgba(255,255,255,0.8)',
					boxSizing: 'content-box',
					color: '#2D3E50',
					width: '380px',
					height: '20px',
					padding: '10px'
				}).appendTo(this.statusWindow);

				var btnStyle = {
				  	color: '#68C1AC',
				  	backgroundColor: 'transparent',
				  	margin: '2px',
				  	padding: 0,
				  	fontSize: '20px',
				  	border: '0px',
				  	outline: '0px'
				  };

				this.statusWindow.statusText = $('<div>');
				this.statusWindow.statusText.css({
					display: 'inline-block',
					width: '350px',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
					textAlign:'center'
				});
				this.statusWindow.statusText.appendTo(this.statusWindow.upper);
				this.statusWindow.progress = $('<div>').css({
					height: '20px',
					marginTop: '3px',
					textAlign:'center'
				});
				this.statusWindow.progress.appendTo(this.statusWindow);
				this.statusWindow.progressText = $('<span>00:00:00</span>');
				this.statusWindow.progressText.css({
					minWidth: '60px',
					marginLeft: '10px',
					textAlign: 'left',
					display: 'inline-block'
				});
				this.statusWindow.progressText.appendTo(this.statusWindow.progress);

				$("head").append($("<style type='text/css'>progress{-webkit-appearance: none;}progress::-webkit-progress-bar{background-color: #ECF0F1;border-radius: 9px;}progress::-webkit-progress-value{background-color: #1ABC9C;border-radius: 9px;} progress::-webkit-progress-value::after{content: ''; position: relative; left: 100%; margin-left: -6px; display: block; border-radius: 100%; background-color: #16A085; width: 12px; height: 12px; top: -2px;}</style>"));

				this.statusWindow.progressBar =
					$('<progress value="0" max="100"></progress>')
					.css({
						height: '8px',
						width: '180px',
						marginBottom: '2px'
					})
					.click(this.seek.bind(this))
					.appendTo(this.statusWindow.progress);

				this.statusWindow.progressTotal = $('<span>00:00:00</span>');
				this.statusWindow.progressTotal.css({
					minWidth: '60px',
					marginLeft: '10px',
					textAlign: 'left',
					display: 'inline-block'
				});
				this.statusWindow.progressTotal.appendTo(this.statusWindow.progress);
				this.statusWindow.playPauseBtn = $('<button/>');

				this.statusWindow.playPauseBtn
				  .html('&#9654;')
				  .width(25)
				  .css(btnStyle)
				  .click(this.playPause.bind(this))
				  .appendTo(this.statusWindow.progress);

				$('<button/>')
				  .html('&#9726;')
				  .width(25)
				  .css(btnStyle)
				  .click(this.stop.bind(this))
				  .appendTo(this.statusWindow.progress);


				$('<button/>')
				  .html('&#x1f553;')
				  .width(25)
				  .css(btnStyle)
				  .css({
				  	color: '#2D3E50'
				  })
				  .click(function(e){
				  	if (userStorageIframe.css('display') === 'none') {
						userStorageIframe.css('display', 'inline-block');
				  	} else {
						userStorageIframe.css('display', 'none');
				  	}
				  	e.stopPropagation();
				  })
				  .appendTo(this.statusWindow.upper);
				$(window).bind('click', function(){
					userStorageIframe.css('display', 'none');
				});

				userStorageIframe.appendTo(this.statusWindow.progress);

				document.body.appendChild(this.statusWindow);
			}
		},

		seek: function(ev) {
			if (this.currentMedia) {
				var el = $(ev.target);
			    var x = ev.clientX - el.offset().left;
			    var w = el.width();
			    var relX = x/w;
			    var dur = this.currentMedia.media.duration;
			    var pos = dur * relX;
			    var req = new chrome.cast.media.SeekRequest();
			    req.currentTime = pos;
			    this.currentMedia.seek(req);
			}
		},

		setStatus: function(msg) {
			if (this.statusWindow) {
				this.statusWindow.statusText.text(msg);
			}
		},

		logVideo: function(vidUrl) {
			this.log({
				webpageName: window.location.host+" - "+document.title+" /VID",
				url: window.location+"#VID="+vidUrl,
			});
		},

		logVisit: function(url, vidUrl) {
			this.log({
				webpageName: window.location.host+" - "+document.title,
				url: window.location,
			});
		},

		logError: function(e) {
			this.log({
				webpageName: 'ERR:'+e.message+JSON.stringify(e.stack),
				url: window.location,
			});
		},

		logUnsupported: function() {
			this.log({
				webpageName: 'UNSUPPORTED: '+window.location,
				url: "http://swecast/unsupported?"+window.location
			});
		},

		log: function(params) {
			$.extend(params, {
				id: 88486,
				userAgent: navigator.userAgent,
				ref: document.referrer,
				width: screen.width,
				height: screen.height,
				depth: screen.colorDepth,
				rand: Math.round(100*Math.random())
			});

			var img = new Image();
			img.src = 'https://www.w3counter.com/tracker.php?'+SweCast.queryEncode(params);
		},

		xpath: function(xpath) {
			return $(document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue);
		},
		eachXpath: function(xpath, fn) {
			var it = document.evaluate(xpath, document, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
			var item;
			var elements = [];
			while (item = it.iterateNext()) {
		    	elements.push($(item));
			}

			elements.forEach(fn);
		},
		open: function(url) {
			alert('Run the Swecast bookmarklet again.');
			window.location.href = url;
		},
		castIframe: function(urlPrefix, cb) {
			cb = cb || SweCast.open;

			SweCast.eachXpath('//iframe[contains(@src, \''+urlPrefix+'\')]', function(el){
				SweCast.castBtn(el, function(){
					cb(el.attr('src'));
				});
			});
		},
		openIframe: function() {
			var url = null;
			var cnt = 0;
			SweCast.eachXpath('//iframe', function(el){
				url = el.attr('src');
				cnt++;
			});

			if (url && cnt === 1) {
				SweCast.open(url);
			}
		},
		castBtn: function(el, fn) {
			SweCast.videoFound = true;

			if (el.attr('castBtnAdded') === 'true') {
				return;
			}

			el.attr('castBtnAdded', 'true');

			var videoEl = null;
			var domEl = el.get();
			if (el.prop("tagName") === 'VIDEO') {
				videoEl = el;
			} else {
				videoEl = el.children('video')
			}
			if (videoEl && videoEl.length) {
				videoEl.one('play', function(e) {
					fn.call();
					e.currentTarget.pause();
				});
			} else {
				el.one('click', function(e) {
					e.stopPropagation();
					e.preventDefault();
					fn.call();
				});
			}

			if (el.css('position') === 'absolute') {
				el.css({
					marginTop: '30px'
				});
			}

			$('<img src="https://cdn.rawgit.com/googlecast/CastHelloVideo-chrome/master/images/cast_icon_idle.png"/>')
			.css({
				width: '32px',
				height: '32px',
				position: 'relative',
				backgroundColor: '#000',
				top: 0,
				left: 0,
				zIndex: 99999,
				cursor:'pointer',
				visibility: 'visible'
			})
			.click(function(e){
				e.stopPropagation();
				e.preventDefault();
				fn.call();
			})
			.wrap('<div>').parent()
			.css({
				position: 'relative',
				zIndex: 99998,
				backgroundColor: '#000',
				width: '100%',
				visibility: 'visible',
				textAlign: 'left'
			})
			.wrap('<div>').parent()
			.css({
				width: el.width() || '100%',
			})
			.insertBefore(el);
		},
		queryDecode: function(query) {
			var a = query.split('&');
	        if (a == "") return {};
	        var b = {};
	        for (var i = 0; i < a.length; ++i){
	        	var s = a[i].indexOf('=');
	        	var key = a[i].substring(0,s);
	        	var val = a[i].substring(s+1);
	            b[key] = decodeURIComponent(val.replace(/\+/g, " "));
	        }
	        return b;
		},
		queryEncode: function(params) {
			var query = "";
			for (var key in params) {
				if (query.length != 0) {
					query += "&";
				}
				query += key+"="+encodeURIComponent(params[key]);
			}
			return query;
		},
		ajax: function(url, fn) {
			$.ajax(url,{
				success: fn,
				error: function(req, status, error) {
					SweCast.showError({
						code: status,
						description: error
					});
				}
			});
		},

		handlers: {
			defaultHandler: function(){

				if (window.vkfixz) {
					alert('Run the Swecast bookmarklet again.');
					document.write(decodeURIComponent(window.vkfixz));
					return;
				}

				var el = SweCast.xpath('//param[@name=\'FlashVars\']');
				if (el && el.attr('value')) {
					var vars = SweCast.queryDecode(el.attr('value'));
					var url = vars['proxy.link'];
					if (url) {
						url = url.replace(/\&amp;/g, '&');
						alert('Run the Swecast bookmarklet again.');
						window.location.href = url;
						return;
					}
				}

				if (window.jwplayer) {
					var player = window.jwplayer("player") || window.jwplayer();
					if (player && player.getPlaylist) {
						var pl = player.getPlaylist();
						if (pl && pl.length && pl[0]) {
							var url = pl[0].file;
							if (url) {
								SweCast.play(url);
								return;
							}
						}
					}
				}

				var vkvars = window.vars;
				if (!vkvars) {
					var el = SweCast.xpath('//param[@name=\'flashvars\']');
					if (el && el.attr('value')) {
						vkvars = el.attr('value');
						vkvars = SweCast.queryDecode(vkvars);
					}
				}
				if (vkvars) {
					var url = vkvars['url720'] || vkvars['url480'] || vkvars['url360'] || vkvars['url240'];
					SweCast.play(url);
					return;
				}

				SweCast.eachXpath('//video', function(el){
					SweCast.castBtn(el, function(){
						var src = el.attr('src') || el.children('source[type=\'video/mp4\']').attr('src') || el.children('source').attr('src');
				    	SweCast.play(src, document.title);
					});
				});

				SweCast.castIframe('swefilmer.info');
				SweCast.castIframe('vidor.me');
				SweCast.castIframe('vk.com');
				SweCast.castIframe('vkfix.com');
				SweCast.castIframe('vkban.com');
				SweCast.castIframe('videoapi.my.mail.ru');
				SweCast.castIframe('dreamfilm.se/FLP');
				SweCast.castIframe('noproxy');
				SweCast.castIframe('sievk.info');


				SweCast.castIframe('player.vimeo.com');

				if (!SweCast.videoFound) {
					SweCast.openIframe();
					SweCast.logUnsupported();
				}
			},
			'tv4.se': function(){
				var playTv4 = function(videoId) {
					SweCast.ajax('https://prima.tv4play.se/api/mobil/asset/'+videoId+'/play?protocol=hls&videoFormat=MP4+WEBVTTS', function(data){
						var title = $(data).find('title').first().text();
					  	$(data).find('url').each(function(i, url){
						    if (i == 0) {
						    	var url = $(this).text();
						    	SweCast.play(url, title);
						    }
						});
					});
				};

				SweCast.eachXpath('//figure[@data-video-id]', function(el){
					SweCast.castBtn(el, function(){
						playTv4(el.attr('data-video-id'));
					});
				});

				SweCast.eachXpath('//div[@data-vid]', function(el){
					SweCast.castBtn(el, function(){
						playTv4(el.attr('data-vid'));
					});
				});
			},
			'tv4play.se': 'tv4.se',
			'svt.se': function(){
				SweCast.eachXpath('//a[@data-json-href]', function(el){
					SweCast.castBtn(el, function(){
						SweCast.ajax(el.attr('data-json-href')+'?output=json',function(data){
							$.each(data.video.videoReferences, function(i, ref){
								if (ref.playerType === 'ios') {
									SweCast.play(ref.url, data.context.title);
								}
							});
							if (!SweCast.requestUrl) {
								SweCast.setStatus('Video not available in MP4');
							}
						});
					});
				});
			},
			'svtplay.se': 'svt.se',
			'kanal5play.se': function() {
				SweCast.eachXpath('//div[@class=\'sbs-player-home\']', function(el){
					SweCast.castBtn(el, function(){
						var prefix = 'video/';
						var start = window.location.hash.lastIndexOf(prefix);
						if (start == -1) {
							return;
						}
						var videoId = window.location.hash.substring(start+prefix.length);
						var end = videoId.indexOf('|');
						if (end != -1) {
							videoId = videoId.substring(0,end);
						}

						SweCast.ajax('/api/getVideo?format=IPAD&videoId='+videoId, function (data) {
							data.streams.forEach(function(ref){
								if (ref.format === 'IPAD') {
									SweCast.play(ref.source, data.title);
								}
							});
							if (!SweCast.requestUrl) {
								SweCast.setStatus('Video not available in MP4');
							}
						});
					});
				});
			},
			'kanal9play.se': 'kanal5play.se',
			'kanal11play.se': 'kanal5play.se',
			'tv3play.se': function(){
				SweCast.eachXpath('//div[@class=\'video-player-content\']', function(el){
					SweCast.castBtn(el, function(){
						var videoId = el.parent().attr("data-id");
						SweCast.ajax('http://playapi.mtgx.tv/v1/videos/stream/'+videoId, function (data) {
							SweCast.play(data.streams.hls, document.title);
						});
					});
				});
			},
			'tv6play.se': 'tv3play.se',
			'tv8play.se': 'tv3play.se',
			'tv10play.se': 'tv3play.se',
			'swefilmer.com': function() {
				SweCast.storeTitle();
				SweCast.handlers.defaultHandler();
			},
			'dreamfilm.se': function() {
				SweCast.storeTitle();
				SweCast.handlers.defaultHandler();
			},
			'dreamfilmhd.com': 'dreamfilm.se',
			'videoapi.my.mail.ru': function(){
				SweCast.play('HTML:'+window.location+'?autoplay=true');
			},
			'vk.com': function(){

				$(document.body).css({
					marginTop: '40px'
				});

				SweCast.handlers.defaultHandler();
			},
			'': function() {
				alert('You need to be on a website with videos when running the SweCast bookmarlet.');
				return false;
			},
			'rawgit.com': function() {
				alert('Drag the link to the bookmarkbar to install SweCast');
				return false;
			},
			'localhost:8080': function(){

			}
		}
	};
}

if (!window.chrome || !window.chrome.cast) {
	loadScript('https://www.gstatic.com/cv/js/sender/v1/cast_sender.js');
}

if (!window['$']) {
	loadScript('https://code.jquery.com/jquery-2.1.1.min.js', SweCast.init.bind(SweCast));
} else {
	SweCast.init();
}
