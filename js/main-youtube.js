(function() {

  var youtubeReadyCallbacks = [];
  window.onYouTubePlayerAPIReady = function() {
    if ( youtubeReadyCallbacks.length ) {
      for ( var i=0; i<youtubeReadyCallbacks.length; ++i ) {
        youtubeReadyCallbacks[ i ]();
      } //for
    } //if
  };

  var requestAnimFrame = (function(){
    return  window.requestAnimationFrame       || 
            window.webkitRequestAnimationFrame || 
            window.mozRequestAnimationFrame    || 
            window.oRequestAnimationFrame      || 
            window.msRequestAnimationFrame     || 
            function(/* function */ callback, /* DOMElement */ element){
              window.setTimeout( callback, 1000 / 60);
            };
  })();

  var removeClass = function( element, name ) {
    var classes = element.className.split( " " ),
        idx = classes.indexOf( name );
    if ( idx > -1 ) {
      classes.splice( idx, 1 );
    }
    element.className = classes.join( " " );
  }; //removeClass

  var addClass = function( element, name ) {
    var classes = element.className.split( " " ),
        idx = classes.indexOf( name );
    if ( idx === -1 ) {
      element.className += name + " ";
    }
  }; //addClass

  var metaDataUrl = 'http://gdata.youtube.com/feeds/api/videos/';

  var Segment = function( options ) {
    var contentDiv = document.createElement( "div" ),
        videoId = options.video,
        uuid = Segment.uuid++,
        videoPlayerId = "segment-video-" + uuid,
        metaData,
        thumbnail,
        ready = false,
        backgroundVolume = options.backgroundVolume,
        listeners = {},
        videoPlayer,
        that = this;

    var playerVars = {};
    if ( options.start ) {
      playerVars.start = options.start;
    }
    if ( options.end ) {
      playerVars.end = options.end;
    }

    contentDiv.id = "video-container-" + uuid;

    addClass( contentDiv, "video-container" );

    this.prepare = function( options ) {
      options = options || {};

      function init() {
        videoPlayer = new YT.Player( contentDiv.id, {
          height: '390',
          width: '640',
          videoId: videoId,
          playerVars: playerVars,
          events: {
            'onReady': segmentLoaded,
            //'onStateChange': onPlayerStateChange
          }
        });

        function segmentLoaded() {
          ready = true;
          if ( options.ready) {
            options.ready();
          }
        }
      } //init

      if ( !window.YT.Player ) {
        youtubeReadyCallbacks.push( init );
      }
      else {
        init();
      } //if
    }; //prepare

    function getMetaData() {
      var callbackName = "ThreeMosquesVideoCallback" + uuid,
          metaUrl = metaDataUrl + videoId + "?v=2&alt=json-in-script&callback=" + callbackName;

      var head = document.getElementsByTagName('head').item(0),
          script = document.createElement('script');

      script.setAttribute('type', 'text/javascript');
      script.setAttribute('src', metaUrl );

      window[ callbackName ] = function( data ) {
        var mediaData = data.entry;
        metaData = {
          description: mediaData.media$group.media$description.$t,
          duration: mediaData.media$group.yt$duration.seconds,
          title: mediaData.title.$t,
          user: mediaData.author[ 0 ].name,
          thumbnailUrl: mediaData.media$group.media$thumbnail[ 0 ].url
        };
        delete window[ callbackName ];
        head.removeChild( script );
        if ( metaData.thumbnailUrl ) {
          thumbnail = new Image();
          thumbnail.src = metaData.thumbnailUrl;
        } //if
        if ( options.metaDataReady ) {
         options.metaDataReady( metaData );
        } //if
      }; //metaData callback

      head.appendChild( script );
    } //getMetaData

    Object.defineProperty( this, "contentElement", { get: function() { return contentDiv; } } );
    Object.defineProperty( this, "description", { get: function() { return metaData.description; } } );
    Object.defineProperty( this, "title", { get: function() { return metaData.title; } } );
    Object.defineProperty( this, "duration", { get: function() { return metaData.duration; } } );
    Object.defineProperty( this, "ready", { get: function() { return ready; } } );
    Object.defineProperty( this, "user", { get: function() { return metaData.user; } } );
    Object.defineProperty( this, "metaData", { get: function() { return metaData; } } );
    Object.defineProperty( this, "backgroundVolume", { get: function() { return backgroundVolume; } } );

    var addListener = this.addListener = function( name, listener ) { 
      if ( !listeners[ name ] ) {
        listeners[ name ] = [];
        froogaloop.addEvent( name, function( data ) {
          var theseListeners = listeners[ name ];
          for ( var i=0, l=theseListeners.length; i<l; ++i ) {
            theseListeners[ i ]( data );
          } //for
        });
      } //if
      listeners[ name ].push( listener );
    }; //addListener

    var removeListener = this.removeListener = function( name, listener ) {
      if ( listeners[ name ] ) {
        var theseListeners = listeners[ name ],
            idx = theseListeners.indexOf( listener );
        if ( idx > -1 ) {
          theseListeners.splice( idx, 1 );
        }
        if ( theseListeners.length === 0 ) {
          froogaloop.removeEvent( name );
        }
      } //if
    }; //removeListener

    this.api = function( name, options ) { froogaloop.api( name, options ); };

    this.hide = function() {
      removeClass( contentDiv, "video-container-on" );
      addClass( contentDiv, "video-container-off" );
    }; //hide

    this.show = function() {
      removeClass( contentDiv, "video-container-off" );
      addClass( contentDiv, "video-container-on" );
    }; //show

    this.play = function( finishedCallback ) {
      videoPlayer.playVideo();
      function check() {
        var time = videoPlayer.getCurrentTime();
        if ( options.end && time < options.end && time < metaData.duration ) {
          setTimeout( check, 500 );
        }
        else {
          finishedCallback();
        }
      }
      check();
    }; //play

    this.stop = function() {
      videoPlayer.stopVideo();
    }; //stop

    getMetaData();

  }; //Segment
  Segment.uuid = 0;

  var Transition = function( options ) {
    var contentDiv = document.createElement( "div" ),
        finishedCallback,
        backgroundVolume = options.backgroundVolume || 1,
        that = this;

    addClass( contentDiv, "transition-container" );

    Object.defineProperty( this, "contentElement", { get: function() { return contentDiv; } } );
    Object.defineProperty( this, "backgroundVolume", { get: function() { return backgroundVolume; } } );

    this.prepare = function( options ) {
      options.ready();
    }; //prepare

    this.hide = function() {
      removeClass( contentDiv, "transition-container-on" );
      addClass( contentDiv, "transition-container-off" );
    }; //hide

    this.show = function() {
      removeClass( contentDiv, "transition-container-off" );
      addClass( contentDiv, "transition-container-on" );
    }; //show

    this.play = function( finished ) {
      options.run( that );
      finishedCallback = finished;
    }; //play

    this.end = function() {
      finishedCallback();
    }; //end

  }; //Transition

  var AudioTweener = function( audio ) {

    var tweening = false,
        target = 1;

    function doTween( to ) {
      document.getElementById("time").innerHTML = audio.volume;
      if ( Math.abs( audio.volume - target ) > 0.01 ) {
        audio.volume = audio.volume - ( audio.volume - target ) * .01;
        requestAnimFrame( doTween );
      }
      else {
        tweening = false;
      } //if
    } //tweenAudioVolume

    this.tween = function( to ) {
      target = to;
      if ( !tweening ) {
        tweening = true;
        doTween( to );
      } //if
    }; //tween

  }; //AudioTweener

  var Timeline = function( options ) {

    var targetContainer = document.getElementById( options.target ),
        descriptionContainer = document.getElementById( options.description ),
        titleContainer = document.getElementById( options.title ),
        audio = document.getElementById( options.audio ),
        segments = [],
        audioTweener = new AudioTweener( audio ),
        that = this;

    this.addTransition = function( transition ) {
      targetContainer.appendChild( transition.contentElement );
      transition.hide();
      segments.push( transition );
    }; //addTransition

    this.addSegment = function( segment ) {
      targetContainer.appendChild( segment.contentElement );
      segment.hide();
      segments.push( segment );
    }; //addSegment

    function prepareSegment( segment, readyCallback ) {
      segment.show();
      segment.prepare({
        ready: readyCallback
      });
    } //prepareSegment

    function playSegment( segment, finishedCallback ) {
      descriptionContainer.innerHTML = segment.description;
      titleContainer.innerHTML = segment.title;
      segment.play( finishedCallback );
      audioTweener.tween( segment.backgroundVolume );
    } //playSegment

    this.play = function() {
      var firstSegmentReady = false,
          audioReady = false,
          currentSegment = segments[ 0 ];

      function playNextSegment() {
        var nextSegment = segments[ segments.indexOf( currentSegment ) + 1 ];
        if ( nextSegment ) {
          audioTweener.tween( 1 );
          currentSegment.hide();
          prepareSegment( nextSegment, function() {
            playSegment( nextSegment, playNextSegment ) 
          });
          currentSegment = nextSegment;
        }
        else {
          currentSegment.stop();
        } //if
      } //playNextSegment

      function check() {
        if ( firstSegmentReady && audioReady ) {
          playSegment( currentSegment, playNextSegment );
          audio.play();
        }
        else {
          setTimeout( check, 100 );
        }
      } //check

      function audioLoaded( e ) {
        audioReady = true;
        audio.removeEventListener( 'canplaythrough', audioLoaded, false );
      } //audioReady

      if ( audio.readyState > 0 ) {
        audioLoaded();
      }
      else {
        audio.addEventListener( 'canplaythrough', audioLoaded, false );
      } //if

      prepareSegment( currentSegment, function() {
        firstSegmentReady = true;
      });

      check();

    }; //play

  }; //Timeline

  var Player = function( options ) {
    
  }; //Player

  window.ThirtyMosques = {
    Segment: Segment,
    Timeline: Timeline, 
    Transition: Transition,
    Player: Player 
  };

})();
